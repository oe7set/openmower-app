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
  [k: string]: unknown;
};

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
