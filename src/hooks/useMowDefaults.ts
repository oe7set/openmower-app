import {useSelectedMower} from '@/stores/mowersStore';
import {DEFAULT_GLOBAL_MOW, parseGlobalMowDefaults} from '@/utils/area-mow-params';
import {useEffect, useState} from 'react';

// The mower's effective default mowing parameters, resolved for the override
// editors so a toggled-off field can show the real default the run would use
// instead of a hard-coded guess. Values mirror the per-run override fields.
export interface MowDefaults {
  // FTC speed_slow / speed_fast (m/s). Read from the live FTC planner params.
  mowSpeedMps: number;
  travelSpeedMps: number;
  // Absolute mowing angle in degrees, from OM_MOWING_ANGLE_OFFSET. Only a
  // meaningful "default" when the global angle is absolute; otherwise the run
  // auto-detects the angle per area, so we expose the offset as the best guess.
  angleDeg: number;
  // Perimeter (outline) passes, from OM_OUTLINE_COUNT.
  outlineCount: number;
}

// FTC local-planner speed params. These are dynamic_reconfigure values mirrored
// onto the ROS param server, not OM_* env vars, so they are read via
// params.get_many rather than meta.config.get.
const FTC_SPEED_SLOW = '/move_base_flex/FTCPlanner/speed_slow';
const FTC_SPEED_FAST = '/move_base_flex/FTCPlanner/speed_fast';

// Matches the FTC planner yaml defaults (ftc_local_planner.yaml). Used as a
// last-resort fallback when neither the live params nor the global config are
// reachable (older backend / broker down).
const FALLBACK_MOW_SPEED = 0.15;
const FALLBACK_TRAVEL_SPEED = 0.4;

export const DEFAULT_MOW_DEFAULTS: MowDefaults = {
  mowSpeedMps: FALLBACK_MOW_SPEED,
  travelSpeedMps: FALLBACK_TRAVEL_SPEED,
  angleDeg: DEFAULT_GLOBAL_MOW.angleOffsetDeg,
  outlineCount: DEFAULT_GLOBAL_MOW.outlineCount,
};

// Per-mower cache so re-opening a dialog doesn't refetch the (rarely changing)
// global defaults. Keyed by the mower's MQTT prefix, which is stable per mower.
const cache = new Map<string, MowDefaults>();

function toNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// Fetch the mower's effective default mowing parameters: the FTC planner speeds
// via params.get_many and the OM_* coverage defaults via meta.config.get. Both
// degrade independently to the built-in fallbacks so a partial backend still
// yields a usable set. The result is cached per mower; `loaded` flips true once
// a fetch has settled (success or fallback) so callers can avoid pre-filling
// with stale guesses before the real values land.
export function useMowDefaults(): {defaults: MowDefaults; loaded: boolean} {
  const rpc = useSelectedMower((s) => s?.rpc);
  const prefix = useSelectedMower((s) => s?.mqttPrefix);

  // Bumped after a successful fetch to pull the freshly cached value into the
  // render. The cache is read during render (below) so a cache hit — including
  // a mower switch to an already-fetched prefix — needs no setState in the
  // effect; only an actual fetch flips this.
  const [, setFetched] = useState(0);

  const cached = prefix ? cache.get(prefix) : undefined;
  const defaults = cached ?? DEFAULT_MOW_DEFAULTS;
  const loaded = !!cached;

  useEffect(() => {
    if (!rpc || !prefix) return;
    if (cache.has(prefix)) return;
    let cancelled = false;

    (async () => {
      const next: MowDefaults = {...DEFAULT_MOW_DEFAULTS};

      // Coverage defaults (angle offset, outline count) from the env-var config.
      try {
        const cfg = (await rpc.meta.config.get()) as Record<string, unknown> | undefined;
        const globals = parseGlobalMowDefaults(cfg);
        next.angleDeg = globals.angleOffsetDeg;
        next.outlineCount = globals.outlineCount;
      } catch {
        // Older backend / broker down — keep the built-in coverage fallbacks.
      }

      // FTC planner speeds from the live ROS params.
      try {
        const res = (await rpc.params.get_many({names: [FTC_SPEED_SLOW, FTC_SPEED_FAST]})) as {
          values?: Record<string, unknown>;
        };
        const values = res?.values ?? {};
        next.mowSpeedMps = toNumber(values[FTC_SPEED_SLOW], FALLBACK_MOW_SPEED);
        next.travelSpeedMps = toNumber(values[FTC_SPEED_FAST], FALLBACK_TRAVEL_SPEED);
      } catch {
        // params.get_many unavailable — keep the yaml-default speeds.
      }

      if (cancelled) return;
      cache.set(prefix, next);
      setFetched((n) => n + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [rpc, prefix]);

  return {defaults, loaded};
}
