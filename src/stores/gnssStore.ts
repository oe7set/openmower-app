import {create} from 'zustand';

import type {GnssSample} from './schemas';

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

// ~2 min at the ~2 Hz publish rate. The charts only trend accuracy / avg-C/N0 /
// sats-used, so this is plenty without holding the satellite arrays.
const RING_CAPACITY = 240;

// The GNSS stream is slow (~1-4 Hz), so unlike the 30 Hz IMU stream we don't
// need to throttle the reactive publish — every sample can drive the skyplot.
// We still publish only the `latest` object reactively; charts poll history.

// A trimmed-down history point. Storing the full satellite array per point
// would balloon memory for no benefit — the charts only need these scalars.
export interface GnssHistoryPoint {
  ts: number;
  hacc: number;
  avgCn0: number;
  used: number;
  fix: number;
}

// Stable empty array reused across renders. Returning a fresh `[]` from a
// Zustand selector each call would make React's getSnapshot detect a new value
// every render and abort with "Maximum update depth exceeded".
const EMPTY_HISTORY: readonly GnssHistoryPoint[] = [];

// Module-private buffers, updated on every sample. Never read by React, so
// mutating them in place is free; the reactive store mirrors only `latest`.
const liveLatest: Record<string, GnssSample> = {};
const liveHistory: Record<string, GnssHistoryPoint[]> = {};

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

export function pushGnssSample(mowerId: string, sample: GnssSample): void {
  // 1) Update the full-rate buffers (no React cost for the history ring).
  liveLatest[mowerId] = sample;
  const ring = liveHistory[mowerId] ?? (liveHistory[mowerId] = []);
  if (ring.length >= RING_CAPACITY) ring.shift();
  ring.push({
    ts: sample.ts_ms,
    hacc: sample.hacc,
    avgCn0: averageCn0(sample),
    used: sample.used,
    fix: sample.ft,
  });

  // 2) Publish the latest full sample for the reactive readouts (skyplot, bars,
  //    DOP). This object is small enough (~30 sats) to publish every sample at
  //    the GNSS stream's modest rate.
  useGnssStore.setState((state) => ({
    latest: {...state.latest, [mowerId]: sample},
  }));
}

export function clearGnssStream(mowerId: string): void {
  delete liveLatest[mowerId];
  delete liveHistory[mowerId];
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

// Non-reactive read for the latest sample (skyplot / bars can poll per frame if
// they prefer, though reactive useLatestGnss is fine at this rate).
export function getLatestGnss(mowerId: string | undefined): GnssSample | undefined {
  return mowerId ? liveLatest[mowerId] : undefined;
}

// Non-reactive history read for the charts, which poll on their own cadence.
// Returns a fresh slice so the caller's ref-equality memo recomputes.
export function getGnssHistory(mowerId: string | undefined): readonly GnssHistoryPoint[] {
  const ring = mowerId ? liveHistory[mowerId] : undefined;
  return ring ? ring.slice() : EMPTY_HISTORY;
}
