// Schema-driven routing of settings values across the four parameter
// sources (env / yaml-user / yaml-hw / ros).
//
// The schema annotates every leaf with one of:
//   * x-source        — which storage layer holds the value
//   * x-yaml-path     — dotted path inside mower_params.yaml (yaml-* sources)
//   * x-ros-param     — fully-qualified ROS parameter name (ros source)
//   * x-environment-variable — legacy OM_* alias (env or yaml-user)
//   * x-readonly-via-ui — value is shown but cannot be saved through the UI
//
// On read we use the schema to walk every leaf, resolve its raw value from
// either the env-var snapshot (rpc.meta.config.get) or the ROS-param
// snapshot (rpc.params.get_many), and write it back into the form's nested
// value tree. On save we split the confirmed-changes payload by source and
// hand each subset to the matching RPC: yaml-* values go through
// meta.config.set, ros values through params.set.

import {setNestedValue} from './settingsUtils';
import type {SettingRestart, SettingSource} from './types';

// Loose schema shape; we only inspect a few well-known fields.
type SchemaScalarType = 'string' | 'number' | 'integer' | 'boolean';

type SchemaNode = {
  properties?: Record<string, SchemaNode>;
  allOf?: Array<{then?: SchemaNode; else?: SchemaNode}>;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  type?: string | string[];
  'x-source'?: SettingSource;
  'x-yaml-path'?: string;
  'x-ros-param'?: string;
  'x-environment-variable'?: string;
  'x-readonly-via-ui'?: boolean;
  'x-restart-required'?: SettingRestart;
  [k: string]: unknown;
};

export interface LeafInfo {
  /** Dotted property path inside the form's nested value tree. */
  path: string;
  type: SchemaScalarType;
  source?: SettingSource;
  yamlPath?: string;
  rosParam?: string;
  envVar?: string;
  readonly?: boolean;
  restart?: SettingRestart;
}

// Walk the (dereferenced + allOf-merged) schema and emit one LeafInfo per
// leaf that has any of x-source / x-yaml-path / x-ros-param /
// x-environment-variable. The output is keyed by property path so the
// form's value tree (nested objects rooted at section names) maps 1:1.
export function collectLeafIndex(schema: unknown): Map<string, LeafInfo> {
  const out = new Map<string, LeafInfo>();
  walk(schema as SchemaNode, [], out);
  return out;
}

function walk(node: SchemaNode | undefined, prefix: string[], out: Map<string, LeafInfo>): void {
  if (!node || typeof node !== 'object') return;

  const hasMarker =
    !!node['x-source'] ||
    !!node['x-yaml-path'] ||
    !!node['x-ros-param'] ||
    !!node['x-environment-variable'];

  if (hasMarker && prefix.length > 0) {
    out.set(prefix.join('.'), {
      path: prefix.join('.'),
      type: scalarType(node.type),
      source: node['x-source'],
      yamlPath: node['x-yaml-path'],
      rosParam: node['x-ros-param'],
      envVar: node['x-environment-variable'],
      readonly: !!node['x-readonly-via-ui'],
      restart: node['x-restart-required'],
    });
  }

  if (node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      walk(child, [...prefix, key], out);
    }
  }

  for (const branchKey of ['allOf', 'anyOf', 'oneOf'] as const) {
    const branches = node[branchKey];
    if (!Array.isArray(branches)) continue;
    for (const subUnknown of branches) {
      if (!subUnknown || typeof subUnknown !== 'object') continue;
      const sub = subUnknown as SchemaNode;
      if (sub.then) walk(sub.then as SchemaNode, prefix, out);
      if (sub.else) walk(sub.else as SchemaNode, prefix, out);
      walk(sub, prefix, out);
    }
  }
}

function scalarType(t: string | string[] | undefined): SchemaScalarType {
  const single = Array.isArray(t) ? t.find((x) => x !== 'null') : t;
  if (single === 'number' || single === 'integer' || single === 'boolean') return single;
  return 'string';
}

function coerceValue(raw: unknown, type: SchemaScalarType): unknown {
  if (raw === undefined || raw === null) return raw;
  if (typeof raw === 'number' && (type === 'number' || type === 'integer')) return raw;
  if (typeof raw === 'boolean' && type === 'boolean') return raw;
  const s = typeof raw === 'string' ? raw : String(raw);
  if (type === 'number' || type === 'integer') {
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  if (type === 'boolean') {
    if (s === 'true' || s === '1' || s === 'True') return true;
    if (s === 'false' || s === '0' || s === 'False' || s === '') return false;
    return s;
  }
  return s;
}

// Take the flat {OM_VAR_or_yamlPath: value} snapshot from
// rpc.meta.config.get() plus the {/ros/param: value} snapshot from
// rpc.params.get_many() and rebuild the nested form value tree.
export function unflattenSnapshots(
  envSnapshot: Record<string, unknown>,
  rosSnapshot: Record<string, unknown>,
  index: Map<string, LeafInfo>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const leaf of index.values()) {
    let raw: unknown = undefined;
    if (leaf.source === 'ros' && leaf.rosParam !== undefined) {
      raw = rosSnapshot[leaf.rosParam];
    } else {
      // env / yaml-user / yaml-hw all live in the env-snapshot which the
      // backend builds out of the env file *and* the merged YAML.
      if (leaf.envVar !== undefined && envSnapshot[leaf.envVar] !== undefined) {
        raw = envSnapshot[leaf.envVar];
      } else if (leaf.yamlPath !== undefined && envSnapshot[leaf.yamlPath] !== undefined) {
        raw = envSnapshot[leaf.yamlPath];
      }
    }
    // null means the backend knows the leaf but has no live value yet
    // (e.g. a ROS param that hasn't been published). Skip rather than
    // coerce so the form falls back to the schema default.
    if (raw === undefined || raw === null) continue;
    setNestedValue(out, leaf.path, coerceValue(raw, leaf.type));
  }
  return out;
}

export interface RoutedChanges {
  yamlChanges: Record<string, unknown>;
  rosChanges: Record<string, unknown>;
  skipped: string[];
}

// Walk the form's confirmed-values tree and split each leaf according to
// the schema's x-source. Read-only fields are dropped (the UI is supposed
// to prevent them from ever entering the confirmed set, but we belt-and-
// brace it here too).
export function routeChanges(
  values: Record<string, unknown>,
  index: Map<string, LeafInfo>,
): RoutedChanges {
  const yamlChanges: Record<string, unknown> = {};
  const rosChanges: Record<string, unknown> = {};
  const skipped: string[] = [];

  const walkValues = (node: unknown, path: string[]): void => {
    if (node === null || node === undefined) return;
    if (typeof node !== 'object' || Array.isArray(node)) {
      const dotted = path.join('.');
      const leaf = index.get(dotted);
      if (!leaf) return;
      if (leaf.readonly) {
        skipped.push(dotted);
        return;
      }
      if (leaf.source === 'ros' && leaf.rosParam) {
        rosChanges[leaf.rosParam] = node;
      } else if (leaf.source === 'yaml-user' || leaf.source === 'yaml-hw') {
        // Prefer the legacy OM_* key when present so the backend can route
        // through the existing yaml_mapping.json (covers backwards-compat
        // with old fields). For new fields without an OM_* alias the
        // YAML path is the wire key.
        const wireKey = leaf.envVar ?? leaf.yamlPath;
        if (wireKey) yamlChanges[wireKey] = node;
      } else if (leaf.source === 'env') {
        // env fields are read-only in the UI by design — they reach this
        // branch only if a developer accidentally drops the readonly flag.
        skipped.push(dotted);
      }
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walkValues(v, [...path, k]);
    }
  };
  walkValues(values, []);

  return {yamlChanges, rosChanges, skipped};
}

// Highest-impact restart level among the confirmed paths. Used to decide
// whether the post-save banner reads "no restart needed", "restart the
// service" or "restart the full stack".
export function aggregateRestart(
  confirmedPaths: Iterable<string>,
  index: Map<string, LeafInfo>,
): SettingRestart {
  let level: SettingRestart = 'none';
  for (const p of confirmedPaths) {
    const leaf = index.get(p);
    if (!leaf || !leaf.restart) continue;
    if (leaf.restart === 'stack') return 'stack';
    if (leaf.restart === 'service') level = 'service';
  }
  return level;
}
