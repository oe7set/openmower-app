import {create} from 'zustand';

import type {ImuSample} from './schemas';

// Live IMU stream owned by its own store so other parts of the app
// (Map, Dashboard cards that don't render IMU) don't re-render on every
// 30 Hz tick. The MQTT handler in mowersStore decodes the BSON payload
// and pushes it through pushImuSample().
//
// History capacity is 600 samples = 20 s @ 30 Hz, which is plenty for
// the live mini-charts on /imu. A longer recording would belong in the
// sensors.history* RPC pipeline, not in this in-memory ring.

const RING_CAPACITY = 600;

// Stable empty array reused across renders. Returning a fresh `[]` from a
// Zustand selector each call would make React's getSnapshot detect a new
// value every render and abort with "Maximum update depth exceeded".
const EMPTY_HISTORY: readonly ImuSample[] = [];

// React-notification rate for the reactive store. The IMU stream arrives at
// 30 Hz, but committing a new store snapshot 30x/s drives a blocking
// useSyncExternalStore update on every subscriber — that starved App
// Router's router.push transition on /imu (it never committed) and made the
// whole page sluggish. We publish to React at ~11 Hz instead, leaving ≥90 ms
// scheduler gaps for pending route transitions to flush. The 3D model reads
// the full-rate buffer below (getLiveImuSample) so it stays 60-fps-live.
const IMU_PUBLISH_INTERVAL_MS = 90;

// Module-private full-rate buffers, updated on every 30 Hz sample. These are
// never read by React, so mutating them in place costs nothing. The reactive
// store is published from these on the throttle interval.
const liveLatest: Record<string, ImuSample> = {};
const liveHistory: Record<string, ImuSample[]> = {};
const lastImuPublish: Record<string, number> = {};

interface ImuState {
  // Keyed by mowerId.
  latest: Record<string, ImuSample>;
  history: Record<string, ImuSample[]>;
}

export const useImuStore = create<ImuState>(() => ({
  latest: {},
  history: {},
}));

export function pushImuSample(mowerId: string, sample: ImuSample): void {
  // 1) Update the full-rate buffers every sample (no React cost).
  liveLatest[mowerId] = sample;
  const ring = liveHistory[mowerId] ?? (liveHistory[mowerId] = []);
  if (ring.length >= RING_CAPACITY) ring.shift();
  ring.push(sample);

  // 2) Gate the reactive publish to ~11 Hz. Date.now() is allowed here — this
  //    runs in the MQTT message handler, outside React's render path.
  const now = Date.now();
  if (now - (lastImuPublish[mowerId] ?? 0) < IMU_PUBLISH_INTERVAL_MS) return;
  lastImuPublish[mowerId] = now;

  // 3) Publish an immutable snapshot. history is sliced so charts get a fresh
  //    ref (re-render) while the live ring keeps mutating; the slice still
  //    carries the complete 600-sample window, so chart resolution is intact.
  useImuStore.setState((state) => ({
    latest: {...state.latest, [mowerId]: sample},
    history: {...state.history, [mowerId]: ring.slice()},
  }));
}

// Per-frame read for the 3D model: synchronous, non-reactive, full-rate. The
// visualizer's useFrame slerp oversamples this at 60 fps, so the model tracks
// the IMU with no added latency even though the reactive store is throttled.
export function getLiveImuSample(mowerId: string | undefined): ImuSample | undefined {
  return mowerId ? liveLatest[mowerId] : undefined;
}

export function clearImuStream(mowerId: string): void {
  delete liveLatest[mowerId];
  delete liveHistory[mowerId];
  delete lastImuPublish[mowerId];
  useImuStore.setState((state) => {
    if (!(mowerId in state.latest) && !(mowerId in state.history)) return state;
    const latest = {...state.latest};
    const history = {...state.history};
    delete latest[mowerId];
    delete history[mowerId];
    return {latest, history};
  });
}

export function useLatestImu(mowerId: string | undefined): ImuSample | undefined {
  return useImuStore((s) => (mowerId ? s.latest[mowerId] : undefined));
}

export function useImuHistory(mowerId: string | undefined): readonly ImuSample[] {
  return useImuStore((s) => (mowerId ? s.history[mowerId] ?? EMPTY_HISTORY : EMPTY_HISTORY));
}

// Non-reactive history read for consumers that poll on their own cadence
// (e.g. the charts, which refresh at ~4 Hz instead of subscribing to every
// ~11 Hz publish — two 600-point recharts reconciles at 11 Hz saturated the
// main thread and starved route transitions on /imu).
export function getImuHistory(mowerId: string | undefined): readonly ImuSample[] {
  return mowerId ? useImuStore.getState().history[mowerId] ?? EMPTY_HISTORY : EMPTY_HISTORY;
}
