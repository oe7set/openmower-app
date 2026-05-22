import {create} from 'zustand';

// Sensor values arrive on `sensors/<id>/data` at potentially several Hz per
// sensor. We keep them in a dedicated store so subscribers to other parts of
// the app (mowers state, map, dashboard) don't re-render on every tick.
//
// Each entry holds the latest value plus a ring buffer used by the chart
// dialog. Capacity covers ~1 h at the worst-case 2 Hz publish rate to match
// the backend `sensors.history*` ring buffer (xbot_monitoring); older samples
// are dropped silently.

const RING_CAPACITY = 7200;

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

// Merge backend-replayed samples into the ring buffer for a single sensor.
// Samples come oldest→newest with strictly numeric values. The merge is
// idempotent: if the live MQTT stream has already pushed identical
// timestamps we drop the duplicates so the chart does not double-plot.
export function seedSensorHistory(
  mowerId: string,
  sensorId: string,
  samples: ReadonlyArray<{ts_ms: number; value: number}>,
): void {
  if (samples.length === 0) return;

  useSensorsStore.setState((state) => {
    const mowerHistory = {...(state.history[mowerId] ?? {})};
    const existing = mowerHistory[sensorId] ?? [];

    // Build a {ts -> sample} map so duplicates get overwritten by the live
    // value (which is what is on screen anyway). Then resort and trim.
    const byTs = new Map<number, SensorSample>();
    for (const s of existing) {
      byTs.set(s.ts, s);
    }
    for (const s of samples) {
      // Live samples win on ts conflict — they were the source of truth and
      // came with whatever raw shape the MQTT producer sent (numeric or
      // string). Backend-replayed samples are always numeric.
      if (!byTs.has(s.ts_ms)) {
        byTs.set(s.ts_ms, {value: s.value, ts: s.ts_ms});
      }
    }
    const merged = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
    mowerHistory[sensorId] =
      merged.length > RING_CAPACITY ? merged.slice(merged.length - RING_CAPACITY) : merged;

    // Latest value: keep whatever the live stream has most recently
    // delivered if it is newer than the seeded data; otherwise use the
    // newest seeded sample.
    const mowerValues = {...(state.values[mowerId] ?? {})};
    const seedNewest = samples[samples.length - 1];
    const liveLatest = mowerValues[sensorId];
    if (!liveLatest || liveLatest.ts < seedNewest.ts_ms) {
      mowerValues[sensorId] = {value: seedNewest.value, ts: seedNewest.ts_ms};
    }

    return {
      values: {...state.values, [mowerId]: mowerValues},
      history: {...state.history, [mowerId]: mowerHistory},
    };
  });
}

// Bulk variant for the boot-time replay. Accepts the `sensors` map returned
// by `rpc.sensors.history_bulk()`.
export function seedAllSensorHistory(
  mowerId: string,
  sensorsById: Record<string, ReadonlyArray<{ts_ms: number; value: number}>>,
): void {
  for (const [sensorId, samples] of Object.entries(sensorsById)) {
    seedSensorHistory(mowerId, sensorId, samples);
  }
}

// Hook helpers — selectors keep re-renders narrow.
export function useSensorValue(mowerId: string | undefined, sensorId: string): SensorSample | undefined {
  return useSensorsStore((s) => (mowerId ? s.values[mowerId]?.[sensorId] : undefined));
}

export function useSensorHistory(mowerId: string | undefined, sensorId: string): SensorSample[] {
  return useSensorsStore((s) => (mowerId ? s.history[mowerId]?.[sensorId] ?? [] : []));
}
