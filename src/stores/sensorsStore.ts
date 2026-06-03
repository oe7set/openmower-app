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

// Safety gap (ms) we leave in front of the first live sample. Backend
// replay samples whose timestamp falls inside this window are dropped.
// Browser clock and mower clock can drift by a second or two, and the
// merge below is strictly *backfill-only* — backend samples may only fill
// in time before our live data starts, never overlap it. Without this
// gap a slightly-skewed backend timestamp lands between two live points
// and the chart line draws a visible kink backwards in time.
const BACKFILL_SAFETY_MS = 100;

// Merge backend-replayed samples into the ring buffer for a single sensor.
// Strictly backfill-only: the live MQTT stream is authoritative for any
// timeframe it has already covered, so we drop any backend sample whose
// timestamp is at or after the first live sample (minus a small safety
// gap to absorb clock drift). On a cold buffer (no live data yet) all
// backend samples are accepted.
export function seedSensorHistory(
  mowerId: string,
  sensorId: string,
  samples: ReadonlyArray<{ts_ms: number; value: number}>,
): void {
  if (samples.length === 0) return;

  useSensorsStore.setState((state) => {
    const mowerHistory = {...(state.history[mowerId] ?? {})};
    const existing = mowerHistory[sensorId] ?? [];

    // Cutoff: anything strictly older than this is safe to backfill.
    // When `existing` is empty there is no live data yet → take everything.
    const backfillCutoff = existing.length > 0 ? existing[0].ts - BACKFILL_SAFETY_MS : Infinity;

    const byTs = new Map<number, SensorSample>();
    for (const s of existing) {
      byTs.set(s.ts, s);
    }
    let accepted = 0;
    for (const s of samples) {
      if (s.ts_ms >= backfillCutoff) continue;
      if (byTs.has(s.ts_ms)) continue;
      byTs.set(s.ts_ms, {value: s.value, ts: s.ts_ms});
      accepted++;
    }
    if (accepted === 0) {
      // Nothing to merge — return current state untouched to avoid a
      // pointless re-render of every subscriber.
      return state;
    }
    const merged = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
    mowerHistory[sensorId] =
      merged.length > RING_CAPACITY ? merged.slice(merged.length - RING_CAPACITY) : merged;

    // Latest value: only seed a "current" sample on cold-start (no live
    // data yet). If the live stream is already running, its values are
    // authoritative for the head of the buffer.
    const mowerValues = {...(state.values[mowerId] ?? {})};
    if (!mowerValues[sensorId]) {
      const seedNewest = samples[samples.length - 1];
      if (seedNewest.ts_ms < backfillCutoff) {
        mowerValues[sensorId] = {value: seedNewest.value, ts: seedNewest.ts_ms};
      }
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

// Drop all values + history for a mower. Called from mowersStore.loadMowers
// when a mower is removed from config so its per-sensor ring buffers (up to
// RING_CAPACITY each) don't leak across reconfigurations.
export function pruneSensorMower(mowerId: string): void {
  useSensorsStore.setState((state) => {
    if (!(mowerId in state.values) && !(mowerId in state.history)) return state;
    const values = {...state.values};
    const history = {...state.history};
    delete values[mowerId];
    delete history[mowerId];
    return {values, history};
  });
}

// Hook helpers — selectors keep re-renders narrow.
export function useSensorValue(mowerId: string | undefined, sensorId: string): SensorSample | undefined {
  return useSensorsStore((s) => (mowerId ? s.values[mowerId]?.[sensorId] : undefined));
}

export function useSensorHistory(mowerId: string | undefined, sensorId: string): SensorSample[] {
  return useSensorsStore((s) => (mowerId ? s.history[mowerId]?.[sensorId] ?? [] : []));
}

// Stable empty array so non-reactive readers don't see a fresh `[]` each call.
const EMPTY_SENSOR_HISTORY: readonly SensorSample[] = [];

// Non-reactive read for consumers that poll on their own cadence (e.g. the
// battery charts refresh at ~4 Hz). Returns the current ring without
// subscribing, so polling does not register a React dependency on every tick.
export function getSensorHistory(mowerId: string | undefined, sensorId: string): readonly SensorSample[] {
  if (!mowerId) return EMPTY_SENSOR_HISTORY;
  return useSensorsStore.getState().history[mowerId]?.[sensorId] ?? EMPTY_SENSOR_HISTORY;
}
