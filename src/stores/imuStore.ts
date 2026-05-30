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
  // Keyed by mowerId. Only `latest` is published reactively (consumed by
  // useLatestImu); chart history is polled non-reactively via getImuHistory.
  latest: Record<string, ImuSample>;
}

export const useImuStore = create<ImuState>(() => ({
  latest: {},
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

  // 3) Publish only `latest` (a tiny object) for the useLatestImu readouts.
  //    We no longer slice/publish the 600-sample history here — the charts
  //    poll the live ring via getImuHistory on their own 4 Hz cadence, so the
  //    old 11 Hz slice was pure allocation churn that nothing consumed.
  useImuStore.setState((state) => ({
    latest: {...state.latest, [mowerId]: sample},
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
    if (!(mowerId in state.latest)) return state;
    const latest = {...state.latest};
    delete latest[mowerId];
    return {latest};
  });
}

export function useLatestImu(mowerId: string | undefined): ImuSample | undefined {
  return useImuStore((s) => (mowerId ? s.latest[mowerId] : undefined));
}

// Non-reactive history read for consumers that poll on their own cadence
// (the charts refresh at ~4 Hz). Returns a fresh slice of the live ring so
// the caller's ref-equality memo recomputes; the slice cost lands on the
// chart's 4 Hz poll rather than the 11 Hz publish path.
export function getImuHistory(mowerId: string | undefined): readonly ImuSample[] {
  const ring = mowerId ? liveHistory[mowerId] : undefined;
  return ring ? ring.slice() : EMPTY_HISTORY;
}
