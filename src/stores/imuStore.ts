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
  useImuStore.setState((state) => {
    const previous = state.history[mowerId] ?? [];
    const next = previous.length >= RING_CAPACITY ? previous.slice(1) : previous.slice();
    next.push(sample);
    return {
      latest: {...state.latest, [mowerId]: sample},
      history: {...state.history, [mowerId]: next},
    };
  });
}

export function clearImuStream(mowerId: string): void {
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
