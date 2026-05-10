import {create} from 'zustand';

// Sensor values arrive on `sensors/<id>/data` at potentially several Hz per
// sensor. We keep them in a dedicated store so subscribers to other parts of
// the app (mowers state, map, dashboard) don't re-render on every tick.
//
// Each entry holds the latest value plus a 60-sample ring buffer used by the
// chart dialog. Older samples are dropped silently.

const RING_CAPACITY = 60;

export interface SensorSample {
  value: number | string;
  /** Wall-clock millisecond timestamp when the value was received. */
  ts: number;
}

interface SensorsState {
  // Keyed by mowerId, then sensorId.
  values: Record<string, Record<string, SensorSample>>;
  history: Record<string, Record<string, SensorSample[]>>;
}

export const useSensorsStore = create<SensorsState>(() => ({
  values: {},
  history: {},
}));

// Imperative helper so the MQTT handler can push values without going through
// React. Called from src/stores/mowersStore.ts.
export function pushSensorValue(mowerId: string, sensorId: string, raw: string): void {
  const numeric = Number.parseFloat(raw);
  const value: number | string = Number.isFinite(numeric) ? numeric : raw;
  const ts = Date.now();
  const sample: SensorSample = {value, ts};

  useSensorsStore.setState((state) => {
    const mowerValues = {...(state.values[mowerId] ?? {})};
    mowerValues[sensorId] = sample;

    const mowerHistory = {...(state.history[mowerId] ?? {})};
    const previous = mowerHistory[sensorId] ?? [];
    const next = previous.length >= RING_CAPACITY ? previous.slice(1) : previous.slice();
    next.push(sample);
    mowerHistory[sensorId] = next;

    return {
      values: {...state.values, [mowerId]: mowerValues},
      history: {...state.history, [mowerId]: mowerHistory},
    };
  });
}

// Hook helpers — selectors keep re-renders narrow.
export function useSensorValue(mowerId: string | undefined, sensorId: string): SensorSample | undefined {
  return useSensorsStore((s) => (mowerId ? s.values[mowerId]?.[sensorId] : undefined));
}

export function useSensorHistory(mowerId: string | undefined, sensorId: string): SensorSample[] {
  return useSensorsStore((s) => (mowerId ? s.history[mowerId]?.[sensorId] ?? [] : []));
}
