import {inferno, rdYlGn} from './colors';

// Single sample as it arrives from telemetry.get_session — all fields beyond
// {ts, x, y} are optional because older recorder builds may not capture every
// metric. Keep the shape forgiving so the page never crashes on partial data.
export interface Sample {
  ts: number;
  x: number;
  y: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  gps_fix_type?: number;
  gps_satellite_count?: number;
  gps_hdop?: number;
  wifi_dbm?: number;
  wifi_q?: number;
  mow_motor_current?: number;
  mow_motor_temp?: number;
  esc_temp?: number;
  battery_voltage?: number;
}

// Each metric can be toggled on/off and produces a per-sample colour. Some
// metrics require a rolling-window calculation (IMU jerk) — those see the
// full samples array via `precompute`.
export interface MetricDef {
  id: MetricId;
  label: string;
  /** Tooltip / legend caption — units, what "high" means, etc. */
  description: string;
  /** Color-ramp choice. */
  ramp: 'rdYlGn' | 'inferno';
  /** When using rdYlGn: true if "high value = good" (e.g. signal quality). */
  goodGreen?: boolean;
  /** Optional precompute pass — returns a per-index normalised value [0..1]. */
  precompute?: (samples: Sample[]) => Float32Array;
  /** Per-sample value extractor when no precompute is needed. */
  value?: (s: Sample) => number | undefined;
  /** Manual range when the natural domain is known (avoids min/max scan). */
  range?: [number, number];
}

export type MetricId =
  | 'gps'
  | 'wifi'
  | 'imu'
  | 'mow_current'
  | 'mow_temp'
  | 'esc_temp'
  | 'battery'
  | 'composite';

// GPS quality blend: fix-type weight (0..5 → 0..1) ANDed with a satellite
// floor (24 sats = perfect for u-blox F9P). Anything missing falls back to
// a low score so the user spots gaps in the recording.
function gpsScore(s: Sample): number {
  const fix = (s.gps_fix_type ?? 0) / 5; // 5 = RTK Fixed
  const sats = Math.min(1, (s.gps_satellite_count ?? 0) / 24);
  const hdop = s.gps_hdop !== undefined ? Math.max(0, 1 - s.gps_hdop / 5) : 0.5;
  return Math.min(fix, sats * 0.5 + hdop * 0.5);
}

function wifiScore(s: Sample): number {
  if (s.wifi_q !== undefined) return s.wifi_q;
  if (s.wifi_dbm !== undefined) {
    if (s.wifi_dbm >= -50) return 1;
    if (s.wifi_dbm <= -90) return 0;
    return (s.wifi_dbm + 90) / 40;
  }
  return 0;
}

// IMU jerk: stddev of yaw within a 1-second sliding window. High values =
// vibrations/impacts, useful for finding bumps in the lawn or hidden roots.
function imuJerkPrecompute(samples: Sample[]): Float32Array {
  const n = samples.length;
  const out = new Float32Array(n);
  const WINDOW = 4; // 1 s at 4 Hz capture rate
  let max = 0;

  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - WINDOW);
    const hi = Math.min(n - 1, i + WINDOW);
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      const y = samples[j].yaw;
      if (y === undefined) continue;
      sum += y;
      sumSq += y * y;
      count++;
    }
    if (count > 1) {
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      const std = Math.sqrt(Math.max(0, variance));
      out[i] = std;
      if (std > max) max = std;
    }
  }
  // Normalise so the legend stays meaningful per session.
  if (max > 0) {
    for (let i = 0; i < n; i++) out[i] /= max;
  }
  return out;
}

export const METRICS: Record<MetricId, MetricDef> = {
  gps: {
    id: 'gps',
    label: 'GPS quality',
    description: 'Combination of fix type, satellite count, and HDOP. Green = RTK Fixed with many sats.',
    ramp: 'rdYlGn',
    goodGreen: true,
    value: gpsScore,
    range: [0, 1],
  },
  wifi: {
    id: 'wifi',
    label: 'WLAN signal',
    description: 'Link quality from /proc/net/wireless or signal strength in dBm.',
    ramp: 'rdYlGn',
    goodGreen: true,
    value: wifiScore,
    range: [0, 1],
  },
  imu: {
    id: 'imu',
    label: 'IMU jerk',
    description: 'Rolling stddev of yaw — spikes mean shocks or hard turns. Per-session normalised.',
    ramp: 'inferno',
    precompute: imuJerkPrecompute,
  },
  mow_current: {
    id: 'mow_current',
    label: 'Mow motor current',
    description: 'Higher current = denser grass or obstruction. Useful for finding tough spots.',
    ramp: 'inferno',
    value: (s) => s.mow_motor_current,
  },
  mow_temp: {
    id: 'mow_temp',
    label: 'Mow motor temp',
    description: 'Hotspots indicate prolonged high load.',
    ramp: 'inferno',
    value: (s) => s.mow_motor_temp,
  },
  esc_temp: {
    id: 'esc_temp',
    label: 'ESC temperature',
    description: 'Drive ESC temperatures. Spikes correlate with steep terrain.',
    ramp: 'inferno',
    value: (s) => s.esc_temp,
  },
  battery: {
    id: 'battery',
    label: 'Battery voltage',
    description: 'Drops under load — useful to spot voltage sag in difficult sections.',
    ramp: 'rdYlGn',
    goodGreen: true,
    value: (s) => s.battery_voltage,
  },
  composite: {
    id: 'composite',
    label: 'Health composite',
    description: 'Worst of GPS quality, WLAN signal, and (1 − IMU jerk). Red = something is wrong.',
    ramp: 'rdYlGn',
    goodGreen: true,
    precompute: (samples) => {
      const imuNorm = imuJerkPrecompute(samples);
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        out[i] = Math.min(gpsScore(samples[i]), wifiScore(samples[i]), 1 - imuNorm[i]);
      }
      return out;
    },
  },
};

// Resolve [min, max] for a metric over a sample set. Falls back to the
// metric's declared range when the data is empty or constant.
export function resolveRange(metric: MetricDef, samples: Sample[], values?: Float32Array): [number, number] {
  if (metric.range) return metric.range;
  let min = Infinity;
  let max = -Infinity;

  if (values) {
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  } else if (metric.value) {
    for (const s of samples) {
      const v = metric.value(s);
      if (v !== undefined && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [0, 1];
  return [min, max];
}

export function colorFor(metric: MetricDef, normalised: number): string {
  return metric.ramp === 'rdYlGn' ? rdYlGn(normalised, metric.goodGreen) : inferno(normalised);
}
