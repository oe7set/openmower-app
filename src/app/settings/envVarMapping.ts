// Utilities to translate the Settings form's nested value tree into the flat
// {OM_FOO: value} payload that the meta.config.* RPCs expect.
//
// The mower_config.schema.json annotates each leaf with `x-environment-variable`
// pointing to the shell variable in mower_config.sh. We resolve that mapping
// once and cache it; saving then becomes a straightforward path lookup.

// Loose schema shape — we only inspect a few well-known fields and don't need
// strict typing here. The form's schema source is JSONSchema6 from
// json-schema-merge-allof; trying to match that type exactly produces noisy
// covariance errors on `type` (string | string[]). A weak structural type
// keeps the call site clean.
type SchemaNode = {
  properties?: Record<string, SchemaNode>;
  allOf?: Array<{then?: SchemaNode; else?: SchemaNode}>;
  'x-environment-variable'?: string;
  type?: string | string[];
  [k: string]: unknown;
};

export type SchemaScalarType = 'string' | 'number' | 'integer' | 'boolean';

export interface EnvVarInfo {
  /** Dotted property path that identifies the leaf in the form's value tree. */
  path: string;
  /** Best-effort scalar type so string values from the backend can be coerced. */
  type: SchemaScalarType;
}

// Recursively walk the schema and build a `propertyPath → envVarName` map.
// Property path uses dots (e.g. "important_settings.OM_DATUM_LAT").
export function buildEnvVarMap(schema: unknown, prefix: string[] = []): Record<string, string> {
  return buildEnvVarMapInner(schema as SchemaNode, prefix);
}

function buildEnvVarMapInner(schema: SchemaNode, prefix: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};

  if (!schema || typeof schema !== 'object') return out;

  if (typeof schema['x-environment-variable'] === 'string' && prefix.length > 0) {
    out[prefix.join('.')] = schema['x-environment-variable'] as string;
  }

  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      Object.assign(out, buildEnvVarMapInner(child, [...prefix, key]));
    }
  }

  // allOf branches contain conditional sub-schemas (if/then/else). Walk both
  // sides — env-var hints in either branch should still register so a value
  // changed under a then-branch can still be persisted.
  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      if (branch?.then) Object.assign(out, buildEnvVarMapInner(branch.then, prefix));
      if (branch?.else) Object.assign(out, buildEnvVarMapInner(branch.else, prefix));
    }
  }

  return out;
}

// Walk a nested values object and emit a {envVar: value} map for every leaf
// whose path resolves to an env-var via the cached map. Values that don't
// have an x-environment-variable annotation are silently skipped — they're
// either YAML-only or organisational containers.
export function flattenToEnvVars(
  values: Record<string, unknown>,
  envVarMap: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (node: unknown, path: string[]) => {
    if (node === null || node === undefined) return;
    if (typeof node !== 'object' || Array.isArray(node)) {
      const envVar = envVarMap[path.join('.')];
      if (envVar) out[envVar] = node;
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walk(v, [...path, k]);
    }
  };
  walk(values, []);
  return out;
}

// Reverse of buildEnvVarMap: produces {envVar: {path, type}} so we can take
// the backend's flat env-var snapshot (rpc.meta.config.get()) and rebuild the
// nested values object that the form renders against. The captured `type`
// lets us coerce strings ("0.13") into numbers/booleans before merging.
export function buildEnvVarReverseMap(schema: unknown): Record<string, EnvVarInfo> {
  const out: Record<string, EnvVarInfo> = {};
  walkReverse(schema as SchemaNode, [], out);
  return out;
}

function walkReverse(schema: SchemaNode | undefined, prefix: string[], out: Record<string, EnvVarInfo>): void {
  if (!schema || typeof schema !== 'object') return;

  if (typeof schema['x-environment-variable'] === 'string' && prefix.length > 0) {
    const envVar = schema['x-environment-variable'] as string;
    out[envVar] = {
      path: prefix.join('.'),
      type: scalarType(schema.type),
    };
  }

  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      walkReverse(child, [...prefix, key], out);
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      if (branch?.then) walkReverse(branch.then, prefix, out);
      if (branch?.else) walkReverse(branch.else, prefix, out);
    }
  }
}

function scalarType(t: string | string[] | undefined): SchemaScalarType {
  const single = Array.isArray(t) ? t.find((x) => x !== 'null') : t;
  if (single === 'number' || single === 'integer' || single === 'boolean') return single;
  return 'string';
}

// Take the {ENV_VAR: stringValue} snapshot from rpc.meta.config.get() and
// rebuild the nested form value tree. Unknown env-vars (not in the schema)
// are silently dropped — they exist in mower_config.sh but the UI doesn't
// expose them. Coercion is best-effort: invalid numbers fall through as
// strings so the form doesn't choke on weird input.
export function unflattenFromEnvVars(
  envSnapshot: Record<string, unknown>,
  reverseMap: Record<string, EnvVarInfo>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [envVar, raw] of Object.entries(envSnapshot)) {
    const info = reverseMap[envVar];
    if (!info) continue;

    const coerced = coerceValue(raw, info.type);
    setNested(out, info.path, coerced);
  }

  return out;
}

function coerceValue(raw: unknown, type: SchemaScalarType): unknown {
  if (raw === undefined || raw === null) return raw;
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

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in cur) || typeof cur[key] !== 'object' || cur[key] === null || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}
