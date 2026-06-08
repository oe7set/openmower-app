import {fmtAccuracy, fmtDeg} from '@/lib/format';
import {fixTypeShort} from '@/lib/gps';
import {qualityColor, resolveWifiQuality} from '@/lib/wifi';
import type {State} from '@/stores/schemas';
import type {ReactElement} from 'react';
import {
  Battery5Bar as BatteryIcon,
  BatteryChargingFull as BatteryChargingIcon,
  Bolt as BoltIcon,
  ContentCut as MowIcon,
  DeviceThermostat as TempIcon,
  ElectricalServices as CurrentIcon,
  GpsFixed as GpsIcon,
  NearMe as HeadingIcon,
  Power as PowerIcon,
  RotateRight as RpmIcon,
  Satellite as SatelliteIcon,
  Speed as SpeedIcon,
  Wifi as WifiIcon,
} from '@mui/icons-material';
import {createElement} from 'react';

// A single, central registry of every value the Pilot page's sensor bar can
// show. Keeping it in one place means the bar renderer and the config panel
// agree on the available metrics, their labels and how each is read.
//
// Values come from two live sources already wired into the app:
//   - robot_state (the Mower `state` object) — battery %, gps %, pose, …
//   - the sensors store (om_* numeric sensors) — motor rpm/current, battery V/A
// plus a small set of derived numbers (total current draw, power).
//
// React hooks can't be called per-metric, so the bar gathers everything once
// via stable hooks and hands each metric a MetricContext to read from.

export interface DerivedPower {
  totalCurrentA: number | null;
  voltageV: number | null;
  powerW: number | null;
}

export interface MetricContext {
  /** robot_state slice; undefined before the first robot_state/json arrives. */
  state: State | undefined;
  /** Latest numeric value for an om_* sensor id, or undefined if absent. */
  num: (sensorId: string) => number | undefined;
  /** Derived aggregates (total current, battery voltage, power). */
  power: DerivedPower;
}

export type MetricColor = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface MetricResult {
  value: string;
  color?: MetricColor;
}

export interface PilotMetric {
  id: string;
  /** Short label shown above the value in the pill. */
  label: string;
  icon: ReactElement;
  read: (ctx: MetricContext) => MetricResult;
}

// Sensor ids contributing to the "total current draw" reading. Mirrors the
// /drive TelemetryStrip allow-list so both surfaces agree.
export const KNOWN_CURRENT_SENSORS = [
  'om_charge_current',
  'om_mow_motor_current',
  'om_left_esc_current',
  'om_right_esc_current',
] as const;

function batteryColor(pct: number, charging: boolean): MetricColor {
  if (charging) return 'info';
  if (pct < 20) return 'error';
  if (pct < 40) return 'warning';
  return 'success';
}

function gpsColor(pct: number): MetricColor {
  if (pct >= 75) return 'success';
  if (pct >= 40) return 'warning';
  return 'error';
}

function fmtAmps(v: number | undefined | null): string {
  return typeof v === 'number' ? `${v.toFixed(2)} A` : '—';
}

function fmtVolts(v: number | undefined | null): string {
  return typeof v === 'number' ? `${v.toFixed(1)} V` : '—';
}

function fmtCelsius(v: number | undefined): string {
  return typeof v === 'number' ? `${v.toFixed(1)} °C` : '—';
}

function fmtRpm(v: number | undefined): string {
  return typeof v === 'number' ? `${Math.round(v)} rpm` : '—';
}

// Build the catalog with createElement so this stays a plain .ts module (no
// JSX) — the icons are still real MUI elements.
function icon(Comp: typeof BatteryIcon): ReactElement {
  return createElement(Comp);
}

export const PILOT_METRICS: PilotMetric[] = [
  {
    id: 'battery',
    label: 'Battery',
    icon: icon(BatteryIcon),
    read: (ctx) => {
      const pct = ctx.state?.battery_percentage ?? null;
      const charging = ctx.state?.is_charging ?? false;
      return {
        value: pct !== null ? `${pct}%` : '—',
        color: pct !== null ? batteryColor(pct, charging) : 'default',
      };
    },
  },
  {
    id: 'battery_voltage',
    label: 'Batt V',
    icon: icon(BatteryChargingIcon),
    read: (ctx) => ({value: fmtVolts(ctx.num('om_v_battery') ?? ctx.power.voltageV)}),
  },
  {
    id: 'bms_current',
    label: 'Batt A',
    icon: icon(PowerIcon),
    read: (ctx) => {
      // om_bms_current sign convention: + = charging, − = discharging.
      const a = ctx.num('om_bms_current');
      if (typeof a !== 'number') return {value: '—'};
      const suffix = a > 0.01 ? ' (chg)' : a < -0.01 ? ' (dis)' : '';
      return {value: `${a.toFixed(2)} A${suffix}`, color: a < -0.01 ? 'warning' : 'default'};
    },
  },
  {
    id: 'current',
    label: 'Current',
    icon: icon(CurrentIcon),
    read: (ctx) => ({value: fmtAmps(ctx.power.totalCurrentA)}),
  },
  {
    id: 'power',
    label: 'Power',
    icon: icon(BoltIcon),
    read: (ctx) => ({value: ctx.power.powerW !== null ? `${ctx.power.powerW.toFixed(1)} W` : '—'}),
  },
  {
    id: 'mow_rpm',
    label: 'Mow RPM',
    icon: icon(RpmIcon),
    read: (ctx) => ({value: fmtRpm(ctx.num('om_mow_motor_rpm'))}),
  },
  {
    id: 'mow_current',
    label: 'Mow A',
    icon: icon(MowIcon),
    read: (ctx) => ({value: fmtAmps(ctx.num('om_mow_motor_current'))}),
  },
  {
    id: 'mow_temp',
    label: 'Mow °C',
    icon: icon(TempIcon),
    read: (ctx) => ({value: fmtCelsius(ctx.num('om_mow_motor_temp'))}),
  },
  {
    id: 'mow_esc_temp',
    label: 'Mow ESC',
    icon: icon(TempIcon),
    read: (ctx) => ({value: fmtCelsius(ctx.num('om_mow_esc_temp'))}),
  },
  {
    id: 'left_esc_temp',
    label: 'L ESC',
    icon: icon(TempIcon),
    read: (ctx) => ({value: fmtCelsius(ctx.num('om_left_esc_temp'))}),
  },
  {
    id: 'right_esc_temp',
    label: 'R ESC',
    icon: icon(TempIcon),
    read: (ctx) => ({value: fmtCelsius(ctx.num('om_right_esc_temp'))}),
  },
  {
    id: 'gps',
    label: 'GPS',
    icon: icon(GpsIcon),
    read: (ctx) => {
      const pct = ctx.state?.gps_percentage ?? null;
      const fix = ctx.state?.gps_fix_type;
      if (pct === null) return {value: '—', color: 'default'};
      return {
        value: fix !== undefined ? `${pct}% · ${fixTypeShort(fix)}` : `${pct}%`,
        color: gpsColor(pct),
      };
    },
  },
  {
    id: 'wifi',
    label: 'WLAN',
    icon: icon(WifiIcon),
    read: (ctx) => {
      const wifi = resolveWifiQuality(ctx.state?.wifi_signal_dbm, ctx.state?.wifi_link_quality);
      if (!wifi) return {value: '—', color: 'default'};
      const value = wifi.signalDbm !== null ? `${wifi.quality}% · ${wifi.signalDbm} dBm` : `${wifi.quality}%`;
      return {value, color: qualityColor(wifi.quality)};
    },
  },
  {
    id: 'sats',
    label: 'Sats',
    icon: icon(SatelliteIcon),
    read: (ctx) => ({value: ctx.state?.gps_satellite_count !== undefined ? String(ctx.state.gps_satellite_count) : '—'}),
  },
  {
    id: 'accuracy',
    label: 'Accuracy',
    icon: icon(GpsIcon),
    read: (ctx) => ({value: fmtAccuracy(ctx.state?.pose.pos_accuracy)}),
  },
  {
    id: 'heading',
    label: 'Heading',
    icon: icon(HeadingIcon),
    read: (ctx) => ({value: fmtDeg(ctx.state?.pose.heading)}),
  },
  {
    id: 'state',
    label: 'State',
    icon: icon(SpeedIcon),
    read: (ctx) => ({value: ctx.state?.current_state ?? '—'}),
  },
];

export const PILOT_METRICS_BY_ID: Record<string, PilotMetric> = Object.fromEntries(
  PILOT_METRICS.map((m) => [m.id, m]),
);

// Shipped default: driving basics + mow motor + battery/current, per the
// user's choice. Order here is the display order.
export const DEFAULT_PILOT_METRIC_IDS: string[] = [
  'battery',
  'gps',
  'wifi',
  'accuracy',
  'heading',
  'state',
  'mow_rpm',
  'mow_current',
  'battery_voltage',
  'bms_current',
  'current',
];

// Pure derived-power computation shared with the bar. Mirrors the /drive
// TelemetryStrip's useDerivedPower so both read the same way.
export function computeDerivedPower(values: Record<string, {value: number | string}> | undefined): DerivedPower {
  if (!values) return {totalCurrentA: null, voltageV: null, powerW: null};

  let totalCurrent = 0;
  let sawCurrent = false;
  for (const [sensorId, sample] of Object.entries(values)) {
    if (typeof sample.value !== 'number') continue;
    if ((KNOWN_CURRENT_SENSORS as readonly string[]).includes(sensorId) || sensorId.endsWith('_current')) {
      totalCurrent += Math.abs(sample.value);
      sawCurrent = true;
    }
  }

  const vSample = values['om_v_battery'];
  const voltage = vSample && typeof vSample.value === 'number' ? vSample.value : null;

  return {
    totalCurrentA: sawCurrent ? totalCurrent : null,
    voltageV: voltage,
    powerW: sawCurrent && voltage !== null ? voltage * totalCurrent : null,
  };
}
