import {inferno, rdYlGn} from './colors';

// Single sample as it arrives from telemetry.get_session. The recorder writes
// known telemetry fields plus the latest value for every configured sensor
// (default Sabo set: om_mow_motor_current, om_mow_motor_temp, om_left_esc_temp,
// om_right_esc_temp, om_v_battery). Sensor IDs vary per build, so we type the
// rest as an open record and reach for known IDs in the metric extractors.
interface KnownSample {
  ts: number;
  x: number;
  y: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  gps_fix_type?: number;
  gps_satellite_count?: number;
  gps_pdop?: number;
  // GPS position accuracy in metres (RobotState.robot_pose.position_accuracy).
  // Present only in sessions recorded after the recorder gained the field.
  gps_accuracy?: number;
  wifi_dbm?: number;
  wifi_q?: number;
  // Raw IMU (newer recorder only): orientation quaternion, angular velocity
  // (rad/s) and linear acceleration (m/s²).
  qw?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  gx?: number;
  gy?: number;
  gz?: number;
  ax?: number;
  ay?: number;
  az?: number;
  // Localisation-debug fields (recorder run with record_all_states=true only).
  // raw_gps_* is the unfiltered antenna fix; ekf_* the fused EKF state;
  // gps_dx/dy the antenna correction vector (raw - fused). Used to diagnose
  // antenna-offset / heading (theta) bugs. Absent on normal recordings.
  raw_gps_x?: number;
  raw_gps_y?: number;
  gps_motion_heading?: number;
  gps_vehicle_heading?: number;
  raw_gps_acc?: number;
  ekf_x?: number;
  ekf_y?: number;
  ekf_theta?: number;
  ekf_vx?: number;
  ekf_vr?: number;
  gps_dx?: number;
  gps_dy?: number;
  // Fused heading from the EKF pose carried in RobotState — present on every
  // recording (unlike ekf_theta which needs the debug topic). Used as the
  // heading source when ekf_theta is absent.
  fused_theta?: number;
  fused_heading?: number;
}
// The numeric known fields plus an open record of per-sensor numeric values.
// `state` (the one string field) is kept off this type so the open record
// stays numeric — read it via `sampleState()`.
export type Sample = KnownSample & Record<string, number | undefined>;

// Mowing state ('MOWING' | 'PAUSED' | undefined for pre-state sessions). Stored
// in the raw JSONL as a string field; accessed through this helper so the
// numeric Sample index signature is not widened to include strings.
export function sampleState(s: Sample): string | undefined {
  const v = (s as unknown as {state?: unknown}).state;
  return typeof v === 'string' ? v : undefined;
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
  | 'gps_accuracy'
  | 'wifi'
  | 'imu'
  | 'speed'
  | 'vibration'
  | 'tilt'
  | 'turn_rate'
  | 'state'
  | 'mow_current'
  | 'mow_rpm'
  | 'mow_temp'
  | 'mow_esc_temp'
  | 'esc_temp'
  | 'battery'
  | 'heading_error'
  | 'offset_error'
  | 'composite';

// GPS quality blend: fix-type weight (0..5 → 0..1) ANDed with a satellite
// floor (24 sats = perfect for u-blox F9P). Anything missing falls back to
// a low score so the user spots gaps in the recording.
function gpsScore(s: Sample): number {
  const fix = (s.gps_fix_type ?? 0) / 5; // 5 = RTK Fixed
  const sats = Math.min(1, (s.gps_satellite_count ?? 0) / 24);
  // PDOP < 2 = excellent, < 5 = ok. Same /5 normalisation as before.
  const pdop = s.gps_pdop !== undefined ? Math.max(0, 1 - s.gps_pdop / 5) : 0.5;
  return Math.min(fix, sats * 0.5 + pdop * 0.5);
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

// Ground speed (m/s) derived from consecutive positions: distance / dt over a
// small centred window for smoothing. Uses only x, y, ts, so it works on every
// session including those recorded before the IMU/state fields existed. Returns
// raw m/s (not normalised) so resolveRange can autoscale the legend.
function speedPrecompute(samples: Sample[]): Float32Array {
  const n = samples.length;
  const out = new Float32Array(n);
  const WINDOW = 2; // ±2 samples ≈ ±0.5 s at 4 Hz
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - WINDOW);
    const hi = Math.min(n - 1, i + WINDOW);
    const a = samples[lo];
    const b = samples[hi];
    const dt = b.ts - a.ts;
    if (dt > 0) {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      out[i] = d / dt;
    }
  }
  return out;
}

// Magnitude of the gravity-removed linear acceleration (m/s²) — a proxy for
// vibration / shocks. Needs the raw accel fields (newer recorder); falls back
// to 0 when absent so the layer renders nothing meaningful rather than crash.
const GRAVITY = 9.81;
function vibration(s: Sample): number | undefined {
  if (s.ax === undefined && s.ay === undefined && s.az === undefined) return undefined;
  const mag = Math.hypot(s.ax ?? 0, s.ay ?? 0, s.az ?? 0);
  return Math.abs(mag - GRAVITY);
}

// Tilt angle (degrees from level) from pitch & roll, which the recorder already
// provides on every session. tilt = acos(cos(pitch)*cos(roll)).
function tiltDeg(s: Sample): number | undefined {
  if (s.pitch === undefined && s.roll === undefined) return undefined;
  const c = Math.cos(s.pitch ?? 0) * Math.cos(s.roll ?? 0);
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
}

// Turn / rotation rate magnitude (rad/s) from the gyro. Newer recorder only.
function turnRate(s: Sample): number | undefined {
  if (s.gx === undefined && s.gy === undefined && s.gz === undefined) return undefined;
  return Math.hypot(s.gx ?? 0, s.gy ?? 0, s.gz ?? 0);
}

// Wrap an angle difference into [-pi, pi].
function wrapPi(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

// Localisation-debug: absolute heading error (deg) between the fused heading
// (ekf_theta when present, else fused_theta from RobotState) and the GPS motion
// heading (direction of travel). A consistent non-zero value is a heading bias;
// spikes in turns reveal theta dynamics problems. Only meaningful while moving.
function headingErrorDeg(s: Sample): number | undefined {
  const theta = s.ekf_theta ?? s.fused_theta;
  if (theta === undefined || s.gps_motion_heading === undefined) return undefined;
  // Only meaningful while moving — a stationary GPS motion heading is noise.
  const speed = s.ekf_vx !== undefined ? Math.abs(s.ekf_vx) : undefined;
  if (speed !== undefined && speed < 0.1) return undefined;
  return Math.abs((wrapPi(theta - s.gps_motion_heading) * 180) / Math.PI);
}

// Localisation-debug: magnitude of the antenna correction vector (raw antenna -
// fused centre), in metres. Should equal the physical antenna offset distance
// and stay constant; a varying value as the robot turns means the offset is
// being applied with a wrong frame/heading. Only on record_all_states sessions.
function offsetErrorM(s: Sample): number | undefined {
  if (s.gps_dx === undefined || s.gps_dy === undefined) return undefined;
  return Math.hypot(s.gps_dx, s.gps_dy);
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
  gps_accuracy: {
    id: 'gps_accuracy',
    label: 'GPS accuracy',
    description: 'Reported position accuracy in metres. Green = a few cm (RTK fix); red ≥10 cm. Newer recordings only.',
    ramp: 'rdYlGn',
    goodGreen: false, // smaller = better
    value: (s) => s.gps_accuracy,
    range: [0, 0.1],
  },
  speed: {
    id: 'speed',
    label: 'Speed',
    description: 'Ground speed derived from position over time (m/s). Dark = slow/stopped, bright = fast.',
    ramp: 'inferno',
    precompute: speedPrecompute,
  },
  state: {
    id: 'state',
    label: 'Mowing state',
    description: 'Green = mowing, orange = paused (e.g. RTK lost). Newer recordings only.',
    ramp: 'rdYlGn',
    goodGreen: true,
    value: (s) => (sampleState(s) === 'PAUSED' ? 0 : sampleState(s) === undefined ? undefined : 1),
    range: [0, 1],
  },
  vibration: {
    id: 'vibration',
    label: 'Vibration',
    description: 'Magnitude of gravity-removed acceleration (m/s²) — shocks/rough ground. Newer recordings only.',
    ramp: 'inferno',
    value: vibration,
  },
  tilt: {
    id: 'tilt',
    label: 'Tilt',
    description: 'Slope angle from level in degrees (from pitch & roll). Bright = steep.',
    ramp: 'inferno',
    value: tiltDeg,
  },
  turn_rate: {
    id: 'turn_rate',
    label: 'Turn rate',
    description: 'Gyro rotation-rate magnitude (rad/s) — high at turns. Newer recordings only.',
    ramp: 'inferno',
    value: turnRate,
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
    value: (s) => s.om_mow_motor_current,
  },
  mow_rpm: {
    id: 'mow_rpm',
    label: 'Mow motor RPM',
    description: 'Blade motor speed. Drops under load — red marks dense grass / tough spots. Newer recordings only.',
    ramp: 'rdYlGn',
    goodGreen: true, // high RPM = free-running = good; low = bogged down
    value: (s) => s.om_mow_motor_rpm,
  },
  mow_temp: {
    id: 'mow_temp',
    label: 'Mow motor temp',
    description: 'Hotspots indicate prolonged high load.',
    ramp: 'inferno',
    value: (s) => s.om_mow_motor_temp,
  },
  mow_esc_temp: {
    id: 'mow_esc_temp',
    label: 'Mow ESC temp',
    description: 'Temperature of the ESC driving the blade motor. Hotspots indicate prolonged high load. Newer recordings only.',
    ramp: 'inferno',
    value: (s) => s.om_mow_esc_temp,
  },
  esc_temp: {
    id: 'esc_temp',
    label: 'ESC temperature',
    // The Sabo build records both drive ESCs separately — show whichever ran
    // hotter at each sample so a single layer covers both motors.
    description: 'Drive ESC temperatures (max of left/right). Spikes correlate with steep terrain.',
    ramp: 'inferno',
    value: (s) => {
      const l = s.om_left_esc_temp;
      const r = s.om_right_esc_temp;
      if (l === undefined && r === undefined) return undefined;
      return Math.max(l ?? -Infinity, r ?? -Infinity);
    },
  },
  battery: {
    id: 'battery',
    label: 'Battery voltage',
    description: 'Drops under load — useful to spot voltage sag in difficult sections.',
    ramp: 'rdYlGn',
    goodGreen: true,
    value: (s) => s.om_v_battery,
  },
  heading_error: {
    id: 'heading_error',
    label: 'Heading error (debug)',
    description:
      'Absolute angle between fused EKF heading and GPS direction of travel, in degrees. Localisation-debug sessions only. A constant offset = heading bias; spikes in turns = theta dynamics issue.',
    ramp: 'rdYlGn',
    goodGreen: false, // smaller = better
    value: headingErrorDeg,
    range: [0, 45],
  },
  offset_error: {
    id: 'offset_error',
    label: 'Antenna offset vec (debug)',
    description:
      'Magnitude of the antenna correction vector (raw antenna − fused centre), in metres. Localisation-debug sessions only. Should stay constant ≈ the physical offset; variation when turning means a wrong offset frame/heading.',
    ramp: 'inferno',
    value: offsetErrorM,
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
