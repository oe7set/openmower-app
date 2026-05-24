import type {SensorInfo} from '@/stores/schemas';
import type {SensorSample} from '@/stores/sensorsStore';

export type SensorStatus = 'success' | 'warning' | 'error';

// Resolves a [low, high] range used to draw the gauge bar and the optional
// "fixed range" Y axis on the chart. Prefer has_min_max boundaries; fall back
// to critical-low/high if min/max are missing; final fallback is a
// [0, latest*1.2] best-effort range so the bar/axis is never unreadable.
export function resolveRange(info: SensorInfo, latest: number): [number, number] {
  if (info.has_min_max && info.max_value > info.min_value) {
    return [info.min_value, info.max_value];
  }
  if (info.has_critical_low && info.has_critical_high && info.upper_critical_value > info.lower_critical_value) {
    return [info.lower_critical_value, info.upper_critical_value];
  }
  if (latest === 0) return [0, 1];
  const padded = Math.abs(latest) * 1.2;
  return latest >= 0 ? [0, padded] : [-padded, 0];
}

export function colorFor(info: SensorInfo, value: number): SensorStatus {
  if (info.has_critical_low && value <= info.lower_critical_value) return 'error';
  if (info.has_critical_high && value >= info.upper_critical_value) return 'error';
  if (info.has_min_max) {
    const span = info.max_value - info.min_value;
    if (span > 0) {
      const lowEdge = info.min_value + 0.1 * span;
      const highEdge = info.max_value - 0.1 * span;
      if (value < lowEdge || value > highEdge) return 'warning';
    }
  }
  return 'success';
}

// 3 decimals for metres, 2 for everything else — same convention the Flutter
// app used. Helps RPM and temperature readings stay readable.
export function formatValue(value: number | string, unit: string): string {
  if (typeof value === 'string') return value;
  const decimals = unit === 'm' ? 3 : 2;
  return `${value.toFixed(decimals)} ${unit}`.trim();
}

// Compact "now / -12s / -3 min / -1 h 5 min" labels for the chart x-axis and
// tooltip. Anything within the last 5 seconds collapses to "now" so the live
// edge of the chart doesn't flicker between -1s/-2s/-3s every tick.
export function formatRelativeTime(ts: number, now: number): string {
  const deltaSec = Math.max(0, Math.round((now - ts) / 1000));
  if (deltaSec < 5) return 'now';
  if (deltaSec < 60) return `-${deltaSec}s`;
  const min = Math.floor(deltaSec / 60);
  const sec = deltaSec % 60;
  if (min < 60) return sec >= 30 && min < 10 ? `-${min}m ${sec}s` : `-${min}m`;
  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `-${hours}h ${remMin}m` : `-${hours}h`;
}

export interface SensorStats {
  current: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  // Trend over the last 5 minutes: difference current - sample(t = now - 5min).
  // null when we don't have a sample older than 30 s — too short a window to
  // be meaningful.
  trend: number | null;
}

// Computes summary stats over the visible sample window. Skips non-numeric
// samples (string-valued sensors) without crashing.
export function computeStats(samples: ReadonlyArray<SensorSample>): SensorStats {
  const numeric: Array<{value: number; ts: number}> = [];
  for (const s of samples) {
    if (typeof s.value === 'number') numeric.push({value: s.value, ts: s.ts});
  }
  if (numeric.length === 0) {
    return {current: null, min: null, max: null, avg: null, trend: null};
  }
  let min = numeric[0].value;
  let max = numeric[0].value;
  let sum = 0;
  for (const s of numeric) {
    if (s.value < min) min = s.value;
    if (s.value > max) max = s.value;
    sum += s.value;
  }
  const current = numeric[numeric.length - 1].value;
  const latestTs = numeric[numeric.length - 1].ts;
  // Trend reference point: oldest sample whose ts is >= (latest - 5 min).
  const trendCutoff = latestTs - 5 * 60_000;
  let trendBase: number | null = null;
  for (const s of numeric) {
    if (s.ts >= trendCutoff) {
      trendBase = s.value;
      break;
    }
  }
  const oldestTs = numeric[0].ts;
  const haveEnoughSpan = latestTs - oldestTs >= 30_000;
  return {
    current,
    min,
    max,
    avg: sum / numeric.length,
    trend: trendBase !== null && haveEnoughSpan ? current - trendBase : null,
  };
}
