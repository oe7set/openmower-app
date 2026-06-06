import {create} from 'zustand';

import {satsShallowEqual} from '@/lib/gnss';
import type {GnssSample, GnssSatellite} from './schemas';

// Live GNSS stream owned by its own store, mirroring imuStore. The MQTT handler
// in mowersStore decodes the BSON payload from xbot_monitoring's gnss/stream and
// pushes it through pushGnssSample(). Keeping it out of the main mowersStore
// means the Map/Dashboard don't re-render on every GNSS tick.
//
// Two shapes are kept:
//   - `latest`: the full sample incl. the per-signal satellite array. Consumed
//     reactively by the skyplot / signal bars / DOP panel via useLatestGnss().
//   - a non-reactive history ring of small derived points, polled by the charts
//     at their own cadence (see getGnssHistory) — the heavy satellite array is
//     never stored per-history-point.

// History ring depth. The ring is filled at the full MQTT ingest rate (~4 Hz),
// independent of the reactive publish throttle below — 1200 points ≈ 5 min,
// enough for the Trends charts to show accuracy converging after RTK comes up.
const RING_CAPACITY = 1200;

// React-notification rate for the reactive store. The GNSS stream arrives at
// ~4 Hz; committing a snapshot on every sample forced every useLatestGnss
// subscriber (skyplot SVG, two recharts trees, the maplibre map) to reconcile
// 4x/s, which is the GNSS-page lag. Mirrors imuStore's IMU_PUBLISH_INTERVAL_MS.
// ~2.5 Hz halves the heavy-panel reconcile rate while staying live for the
// readouts (the data only changes meaningfully at ~1 Hz). Per-frame consumers
// (the mini-map) read getLatestGnss on their own poll instead.
const GNSS_PUBLISH_INTERVAL_MS = 400;
const lastGnssPublish: Record<string, number> = {};

// Stable empty satellite array — same getSnapshot-loop guard as EMPTY_HISTORY.
const EMPTY_SATS: readonly GnssSatellite[] = [];

// A trimmed-down history point. Storing the full satellite array per point
// would balloon memory for no benefit — the charts only need these scalars.
export interface GnssHistoryPoint {
  ts: number;
  hacc: number;
  avgCn0: number;
  used: number;
  vis: number;
  fix: number;
}

// A position-only history point for the discrete-trajectory jitter plot. Kept in
// a separate, decimated ring (see POS_RING_CAPACITY / POS_PUSH_INTERVAL_MS) so a
// longer time window can be retained than the full-rate trends ring above without
// blowing up memory — the plot only needs lat/lon and the reported accuracy.
export interface GnssPosPoint {
  ts: number;
  lat: number;
  lon: number;
  hacc: number;
}

// Position-ring depth and decimation. The trajectory plot keeps up to an hour of
// fixes; at ~2 Hz that is 7200 points (~0.2 MB), enough to watch stationary RTK
// jitter accumulate over a long observation. Decimated from the ~4 Hz stream.
const POS_RING_CAPACITY = 7200;
const POS_PUSH_INTERVAL_MS = 500;
const lastPosPush: Record<string, number> = {};

// Stable empty array reused across renders. Returning a fresh `[]` from a
// Zustand selector each call would make React's getSnapshot detect a new value
// every render and abort with "Maximum update depth exceeded".
const EMPTY_HISTORY: readonly GnssHistoryPoint[] = [];

// Module-private buffers, updated on every sample. Never read by React, so
// mutating them in place is free; the reactive store mirrors only `latest`.
const liveLatest: Record<string, GnssSample> = {};
const liveHistory: Record<string, GnssHistoryPoint[]> = {};
const livePosHistory: Record<string, GnssPosPoint[]> = {};

interface GnssState {
  // Keyed by mowerId. Only `latest` is published reactively (consumed by
  // useLatestGnss); chart history is polled non-reactively via getGnssHistory.
  latest: Record<string, GnssSample>;
}

export const useGnssStore = create<GnssState>(() => ({
  latest: {},
}));

// Mean C/N0 over the tracked signals with a non-zero value (used for the chart
// trend; 0 when nothing is tracked yet).
function averageCn0(sample: GnssSample): number {
  let sum = 0;
  let n = 0;
  for (const s of sample.sats) {
    if (s.c > 0) {
      sum += s.c;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

export function pushGnssSample(mowerId: string, sampleIn: GnssSample): void {
  const prev = liveLatest[mowerId];
  // Reuse the previous satellite array reference when the sky is unchanged, so
  // the memoized skyplot/scatter/bars panels (keyed on the sats prop identity)
  // don't reconcile when only hacc/age/lat/lon ticked. Two cases collapse into
  // one: (a) a momentary empty-sats tick while a valid fix continues — carry the
  // last sky forward so the panels don't blank ~1×/s; (b) a fresh array that is
  // shallow-equal to the previous one — keep the old reference. Either way every
  // other field stays fresh from the new sample.
  const reuseSats =
    prev !== undefined &&
    prev.sats.length > 0 &&
    ((sampleIn.sats.length === 0 && sampleIn.ft > 0) || satsShallowEqual(prev.sats, sampleIn.sats));
  const sample: GnssSample = reuseSats ? {...sampleIn, sats: prev.sats, vis: prev.vis} : sampleIn;

  // 1) Full-rate buffers — updated on every sample (no React cost). The history
  //    ring stays full-rate so the charts (which poll it) see every point.
  liveLatest[mowerId] = sample;
  const ring = liveHistory[mowerId] ?? (liveHistory[mowerId] = []);
  if (ring.length >= RING_CAPACITY) ring.shift();
  ring.push({
    ts: sample.ts_ms,
    hacc: sample.hacc,
    avgCn0: averageCn0(sample),
    used: sample.used,
    vis: sample.vis,
    fix: sample.ft,
  });

  // 2) Decimated position ring for the discrete-trajectory plot. Only fixes with
  //    a real position are kept, and only at ~2 Hz, so an hour of jitter fits in
  //    a bounded buffer. Date.now() is fine here — outside React's render path.
  const nowPos = Date.now();
  if (
    (sample.lat !== 0 || sample.lon !== 0) &&
    nowPos - (lastPosPush[mowerId] ?? 0) >= POS_PUSH_INTERVAL_MS
  ) {
    lastPosPush[mowerId] = nowPos;
    const posRing = livePosHistory[mowerId] ?? (livePosHistory[mowerId] = []);
    if (posRing.length >= POS_RING_CAPACITY) posRing.shift();
    posRing.push({ts: sample.ts_ms, lat: sample.lat, lon: sample.lon, hacc: sample.hacc});
  }

  // 3) Gate the reactive publish to ~2.5 Hz so the heavy panels reconcile at
  //    most that often. Date.now() is fine here — runs in the MQTT message
  //    handler, outside React's render path.
  const now = Date.now();
  if (now - (lastGnssPublish[mowerId] ?? 0) < GNSS_PUBLISH_INTERVAL_MS) return;
  lastGnssPublish[mowerId] = now;
  useGnssStore.setState((state) => ({
    latest: {...state.latest, [mowerId]: sample},
  }));
}

export function clearGnssStream(mowerId: string): void {
  delete liveLatest[mowerId];
  delete liveHistory[mowerId];
  delete livePosHistory[mowerId];
  delete lastPosPush[mowerId];
  delete lastGnssPublish[mowerId];
  useGnssStore.setState((state) => {
    if (!(mowerId in state.latest)) return state;
    const latest = {...state.latest};
    delete latest[mowerId];
    return {latest};
  });
}

export function useLatestGnss(mowerId: string | undefined): GnssSample | undefined {
  return useGnssStore((s) => (mowerId ? s.latest[mowerId] : undefined));
}

// Narrow reactive selectors so a panel only re-renders when its slice changes.
// zustand short-circuits via Object.is, and pushGnssSample keeps the sats array
// reference stable across unchanged epochs, so the satellite panels stay put
// when only position/accuracy tick.
export function useGnssSats(mowerId: string | undefined): readonly GnssSatellite[] {
  return useGnssStore((s) => (mowerId ? s.latest[mowerId]?.sats : undefined) ?? EMPTY_SATS);
}
export function useGnssDop(mowerId: string | undefined): GnssSample['dop'] | undefined {
  return useGnssStore((s) => (mowerId ? s.latest[mowerId]?.dop : undefined));
}
export function useHasGnss(mowerId: string | undefined): boolean {
  return useGnssStore((s) => (mowerId ? s.latest[mowerId] !== undefined : false));
}

// Non-reactive read for the latest sample — the mini-map polls this on its own
// cadence instead of subscribing (keeps maplibre off the reactive path).
export function getLatestGnss(mowerId: string | undefined): GnssSample | undefined {
  return mowerId ? liveLatest[mowerId] : undefined;
}

// Non-reactive history read for the charts, which poll on their own cadence.
// Returns a fresh slice so the caller's ref-equality memo recomputes.
export function getGnssHistory(mowerId: string | undefined): readonly GnssHistoryPoint[] {
  const ring = mowerId ? liveHistory[mowerId] : undefined;
  return ring ? ring.slice() : EMPTY_HISTORY;
}

// Stable empty array — same getSnapshot-loop guard as EMPTY_HISTORY.
const EMPTY_POS_HISTORY: readonly GnssPosPoint[] = [];

// Non-reactive position-history read for the discrete-trajectory plot, polled on
// its own cadence. Returns a fresh slice so the caller's memo recomputes.
export function getGnssPositionHistory(mowerId: string | undefined): readonly GnssPosPoint[] {
  const ring = mowerId ? livePosHistory[mowerId] : undefined;
  return ring ? ring.slice() : EMPTY_POS_HISTORY;
}

// Reset just the trajectory ring (the plot's clear button) without tearing down
// the live stream or the trends history.
export function clearGnssPositionHistory(mowerId: string | undefined): void {
  if (!mowerId) return;
  delete livePosHistory[mowerId];
  delete lastPosPush[mowerId];
}
