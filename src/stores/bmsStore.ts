import {create} from 'zustand';

import type {BmsTelemetry} from './schemas';

// Live battery/BMS telemetry owned by its own store so the rest of the app
// (Map, other dashboard cards) doesn't re-render on every update. The MQTT
// handler in mowersStore parses the `<prefix>bms/json` payload and pushes it
// here via pushBmsTelemetry().
//
// Unlike the IMU stream this arrives at only ~1 Hz, so no throttling or ring
// buffer is needed — the Battery page reads the latest snapshot reactively and
// gets its time-series from the sensors.history* pipeline (om_bms_* sensors).

interface BmsState {
  // Keyed by mowerId. Holds the most recent telemetry snapshot.
  latest: Record<string, BmsTelemetry>;
}

export const useBmsStore = create<BmsState>(() => ({
  latest: {},
}));

// Imperative push from the MQTT handler (outside React's render path).
export function pushBmsTelemetry(mowerId: string, telemetry: BmsTelemetry): void {
  useBmsStore.setState((state) => ({
    latest: {...state.latest, [mowerId]: telemetry},
  }));
}

// Drop a mower's telemetry. Called from mowersStore.loadMowers when a mower is
// removed from config so its snapshot doesn't leak across reconfigurations.
export function clearBmsTelemetry(mowerId: string): void {
  useBmsStore.setState((state) => {
    if (!(mowerId in state.latest)) return state;
    const latest = {...state.latest};
    delete latest[mowerId];
    return {latest};
  });
}

// Reactive selector — re-renders only when this mower's telemetry changes.
export function useLatestBms(mowerId: string | undefined): BmsTelemetry | undefined {
  return useBmsStore((s) => (mowerId ? s.latest[mowerId] : undefined));
}
