import type {MowPattern} from '@/app/tasks/ScheduleEditor';
import {fillToPattern, patternToFill} from '@/app/tasks/patterns';
import type {AreaProps} from '@/stores/schemas';

// Bridges between the per-area mowing-parameter overrides as the UI works with
// them (degrees, MowPattern strings) and as they are stored on the area's
// GeoJSON properties / ROS MapArea (radians, slic3r fill enum int). The stored
// shape is the contract with mower_map_service.cpp; the UI shape mirrors the
// per-run ScheduleOverrides so the same controls (MowParamRows) can drive both.

// UI-facing per-area overrides. Every field is optional: an absent field means
// "use the mower's global default" (the corresponding property is omitted from
// the area, exactly like the per-run overrides behave).
export interface AreaMowOverrides {
  speed_mps?: number;
  // Travel/approach speed (FTC speed_fast). Per-run only — it is intentionally
  // NOT part of PARAM_KEYS below and is never written to an area's stored
  // properties, so the per-area settings dialog does not expose it. It rides
  // along here only so the shared MowParamRows component (driven on this
  // superset) can render the per-run "Travel speed" override.
  travel_speed_mps?: number;
  pattern?: MowPattern;
  angle_deg?: number;
  outline_count?: number;
  outline_overlap_count?: number;
  outline_offset?: number;
  distance?: number;
}

// The subset of area-property keys this module owns. Listed explicitly so
// applyOverridesToProps can clear a key when its toggle is switched off.
const PARAM_KEYS = [
  'angle',
  'fill_type',
  'outline_count',
  'outline_overlap_count',
  'outline_offset',
  'distance',
  'speed_mps',
] as const;

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;

// Read the per-area overrides out of an area's stored properties, converting
// radians -> degrees and the fill enum -> MowPattern for the UI.
export function areaPropsToOverrides(props: Partial<AreaProps> | undefined): AreaMowOverrides {
  const p = (props ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

  const angleRad = num(p.angle);
  const fill = num(p.fill_type);
  return {
    speed_mps: num(p.speed_mps),
    pattern: fillToPattern(fill),
    angle_deg: angleRad == null ? undefined : angleRad * DEG_PER_RAD,
    outline_count: num(p.outline_count),
    outline_overlap_count: num(p.outline_overlap_count),
    outline_offset: num(p.outline_offset),
    distance: num(p.distance),
  };
}

// Produce a new properties object with the stored parameter keys set from the
// given overrides. A field left undefined in `ov` clears its stored key so the
// area falls back to the global default — the reason we delete rather than
// leave stale values behind.
export function applyOverridesToProps<T extends Partial<AreaProps>>(props: T, ov: AreaMowOverrides): T {
  const next = {...props} as Record<string, unknown>;
  for (const key of PARAM_KEYS) {
    delete next[key];
  }
  if (ov.angle_deg != null) next.angle = ov.angle_deg * RAD_PER_DEG;
  if (ov.pattern != null) next.fill_type = patternToFill(ov.pattern);
  if (ov.outline_count != null) next.outline_count = ov.outline_count;
  if (ov.outline_overlap_count != null) next.outline_overlap_count = ov.outline_overlap_count;
  if (ov.outline_offset != null) next.outline_offset = ov.outline_offset;
  if (ov.distance != null) next.distance = ov.distance;
  if (ov.speed_mps != null) next.speed_mps = ov.speed_mps;
  return next as T;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Coverage-preview request resolution
//
// The coverage.preview RPC is a stateless slic3r proxy: the backend does not
// read any global config, so the frontend must resolve every "use default"
// value here exactly the way MowingBehavior::create_mowing_plan would, then
// send concrete numbers. This keeps the preview faithful to a real run.
////////////////////////////////////////////////////////////////////////////////////////////////////

type Pt = {x: number; y: number};

// The mower's global mowing defaults, resolved from the env-var config snapshot
// (rpc.meta.config.get). Names mirror mower_config.yaml_mapping.json. The fill
// pattern has no OM_ env var (it is a dynamic_reconfigure default), so it falls
// back to linear when the area carries no per-area pattern.
export interface GlobalMowDefaults {
  angleOffsetDeg: number;
  angleOffsetIsAbsolute: boolean;
  toolWidthM: number;
  outlineCount: number;
  outlineOverlapCount: number;
  outlineOffsetM: number;
  fillType: number;
}

export const DEFAULT_GLOBAL_MOW: GlobalMowDefaults = {
  angleOffsetDeg: 0,
  angleOffsetIsAbsolute: false,
  toolWidthM: 0.13,
  outlineCount: 3,
  outlineOverlapCount: 0,
  outlineOffsetM: 0,
  fillType: 0,
};

// Parse the env-var config snapshot (string values) into typed global defaults.
// Anything missing or unparseable falls back to DEFAULT_GLOBAL_MOW, so a
// degraded preview is still produced on older backends.
export function parseGlobalMowDefaults(cfg: Record<string, unknown> | undefined): GlobalMowDefaults {
  const c = cfg ?? {};
  const numVar = (key: string, fallback: number): number => {
    const v = c[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  };
  const boolVar = (key: string, fallback: boolean): boolean => {
    const v = c[key];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    if (typeof v === 'number') return v !== 0;
    return fallback;
  };
  return {
    angleOffsetDeg: numVar('OM_MOWING_ANGLE_OFFSET', DEFAULT_GLOBAL_MOW.angleOffsetDeg),
    angleOffsetIsAbsolute: boolVar('OM_MOWING_ANGLE_OFFSET_IS_ABSOLUTE', DEFAULT_GLOBAL_MOW.angleOffsetIsAbsolute),
    toolWidthM: numVar('OM_TOOL_WIDTH', DEFAULT_GLOBAL_MOW.toolWidthM),
    outlineCount: numVar('OM_OUTLINE_COUNT', DEFAULT_GLOBAL_MOW.outlineCount),
    outlineOverlapCount: numVar('OM_OUTLINE_OVERLAP_COUNT', DEFAULT_GLOBAL_MOW.outlineOverlapCount),
    outlineOffsetM: numVar('OM_OUTLINE_OFFSET', DEFAULT_GLOBAL_MOW.outlineOffsetM),
    fillType: DEFAULT_GLOBAL_MOW.fillType,
  };
}

// Auto-detect the mowing angle (radians) from the polygon's first edge longer
// than 2 m, mirroring MowingBehavior::create_mowing_plan. Returns 0 when no
// such edge exists (degenerate / tiny polygon).
export function autoDetectAngleRad(outline: Pt[]): number {
  if (outline.length < 2) return 0;
  const first = outline[0];
  for (const p of outline) {
    const dx = p.x - first.x;
    const dy = p.y - first.y;
    if (Math.hypot(dx, dy) > 2.0) {
      return Math.atan2(dy, dx);
    }
  }
  return 0;
}

// Concrete coverage.preview request params (matches the openrpc schema). Points
// are [x, y] in mower-relative metres.
export interface CoveragePreviewArgs {
  outline: number[][];
  holes: number[][][];
  fill_type: number;
  angle_rad: number;
  distance: number;
  outer_offset: number;
  outline_count: number;
  outline_overlap_count: number;
}

const toPairs = (pts: Pt[]): number[][] => pts.map((p) => [p.x, p.y]);

// Resolve a coverage.preview request from per-area overrides + global defaults,
// applying the same precedence and angle maths as MowingBehavior so the preview
// matches what a real run would mow. The per-area angle is the base direction
// (auto-detected from the polygon when unset); the global offset is then added
// unless the global "absolute angle" flag is set. The cumulative per-map angle
// increment is intentionally ignored — it is 0 at the start of a run and only
// drifts across whole-map repeats.
export function resolvePreviewArgs(
  overrides: AreaMowOverrides,
  outline: Pt[],
  holes: Pt[][],
  globals: GlobalMowDefaults,
): CoveragePreviewArgs {
  const baseRad = overrides.angle_deg != null ? overrides.angle_deg * RAD_PER_DEG : autoDetectAngleRad(outline);
  const offsetRad = globals.angleOffsetDeg * RAD_PER_DEG;
  const angleRad = globals.angleOffsetIsAbsolute ? offsetRad : baseRad + offsetRad;

  return {
    outline: toPairs(outline),
    holes: holes.map(toPairs),
    fill_type: overrides.pattern != null ? patternToFill(overrides.pattern) : globals.fillType,
    angle_rad: angleRad,
    distance: overrides.distance ?? globals.toolWidthM,
    outer_offset: overrides.outline_offset ?? globals.outlineOffsetM,
    outline_count: overrides.outline_count ?? globals.outlineCount,
    outline_overlap_count: overrides.outline_overlap_count ?? globals.outlineOverlapCount,
  };
}
