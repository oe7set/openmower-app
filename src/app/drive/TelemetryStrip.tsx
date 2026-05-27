'use client';

import {fmtAccuracy, fmtDeg} from '@/lib/format';
import {fixTypeShort} from '@/lib/gps';
import {qualityColor, resolveWifiQuality} from '@/lib/wifi';
import {useSelectedMower} from '@/stores/mowersStore';
import {useSensorsStore} from '@/stores/sensorsStore';
import {
  BatteryChargingFull as BatteryChargingIcon,
  Battery5Bar as BatteryIcon,
  Bolt as BoltIcon,
  ElectricalServices as CurrentIcon,
  GpsFixed as GpsIcon,
  NearMe as HeadingIcon,
  PinDrop as PinDropIcon,
  Satellite as SatelliteIcon,
  Speed as SpeedIcon,
  Thunderstorm as RainIcon,
  Warning as WarningIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
} from '@mui/icons-material';
import {Box, Chip, Typography, useTheme} from '@mui/material';
import {ReactNode, useMemo} from 'react';

// Sensors that contribute to the "total current draw" reading. We allow-list
// the sensor IDs we know about (xbot_monitoring publishes these on
// production OpenMower hardware) plus a generic "*_current" fallback so new
// firmware revisions light up automatically without code changes.
const KNOWN_CURRENT_SENSORS = new Set([
  'om_charge_current',
  'om_mow_motor_current',
  'om_left_esc_current',
  'om_right_esc_current',
]);

interface DerivedPower {
  totalCurrentA: number | null;
  voltageV: number | null;
  powerW: number | null;
}

// zustand v5 dropped equality-fn-as-third-arg, so we keep the selector
// returning a stable per-mower bucket reference (sensorsStore replaces the
// inner record on every push) and derive numbers via useMemo. That avoids the
// "Maximum update depth exceeded" trap a fresh object from the selector
// would cause.
function useDerivedPower(mowerId: string | undefined): DerivedPower {
  const values = useSensorsStore((s) => (mowerId ? s.values[mowerId] : undefined));
  return useMemo(() => {
    if (!values) return {totalCurrentA: null, voltageV: null, powerW: null};

    let totalCurrent = 0;
    let sawCurrent = false;
    for (const [sensorId, sample] of Object.entries(values)) {
      if (typeof sample.value !== 'number') continue;
      if (KNOWN_CURRENT_SENSORS.has(sensorId) || sensorId.endsWith('_current')) {
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
  }, [values]);
}

function batteryColor(pct: number, charging: boolean): 'success' | 'warning' | 'error' | 'info' {
  if (charging) return 'info';
  if (pct < 20) return 'error';
  if (pct < 40) return 'warning';
  return 'success';
}

function gpsColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 75) return 'success';
  if (pct >= 40) return 'warning';
  return 'error';
}

interface MetricPillProps {
  icon: ReactNode;
  label: string;
  value: string;
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

function MetricPill({icon, label, value, color = 'default'}: MetricPillProps) {
  const theme = useTheme();
  const accent =
    color === 'default'
      ? theme.palette.text.primary
      : theme.palette[color].main;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${theme.palette.divider}`,
        flex: '0 0 auto',
        minWidth: 'fit-content',
      }}
    >
      <Box sx={{color: accent, display: 'flex', alignItems: 'center', '& svg': {fontSize: 16}}}>
        {icon}
      </Box>
      <Box sx={{display: 'flex', flexDirection: 'column', lineHeight: 1.1}}>
        <Typography
          variant="caption"
          sx={{fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4}}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{fontFamily: 'var(--font-dm-mono), monospace', fontWeight: 600, color: accent}}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function TelemetryStrip() {
  const theme = useTheme();
  const mowerId = useSelectedMower((s) => s?.id);
  // Subscribe to scalar slices instead of the whole state object so the strip
  // only re-renders when the value displayed actually changes — the state
  // object reference is rewritten by immer on every robot_state message.
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const rainDetected = useSelectedMower((s) => s?.state.rain_detected ?? false);
  const battery = useSelectedMower((s) => s?.state.battery_percentage ?? null);
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);
  const wifiSignalDbm = useSelectedMower((s) => s?.state.wifi_signal_dbm);
  const wifiLinkQuality = useSelectedMower((s) => s?.state.wifi_link_quality);
  const gpsPct = useSelectedMower((s) => s?.state.gps_percentage ?? null);
  const fixType = useSelectedMower((s) => s?.state.gps_fix_type);
  const sats = useSelectedMower((s) => s?.state.gps_satellite_count);
  const posAccuracy = useSelectedMower((s) => s?.state.pose.pos_accuracy);
  const heading = useSelectedMower((s) => s?.state.pose.heading);
  const currentState = useSelectedMower((s) => s?.state.current_state);
  const power = useDerivedPower(mowerId);

  const wifi = useMemo(
    () => resolveWifiQuality(wifiSignalDbm, wifiLinkQuality),
    [wifiSignalDbm, wifiLinkQuality],
  );

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 3,
        // Pull out to the PageContent edges so the strip looks like a banner.
        mx: {xs: -2, md: -3},
        px: {xs: 2, md: 3},
        py: 1,
        backdropFilter: 'blur(8px)',
        bgcolor:
          theme.palette.mode === 'dark'
            ? 'rgba(15,17,18,0.78)'
            : 'rgba(255,255,255,0.78)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        // Mobile: let the strip scroll horizontally instead of wrapping —
        // each pill stays readable, the user swipes to see the rest.
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        '&::-webkit-scrollbar': {height: 4},
        '&::-webkit-scrollbar-thumb': {
          bgcolor: theme.palette.divider,
          borderRadius: 2,
        },
      }}
    >
      {emergency && (
        <Chip
          icon={<WarningIcon />}
          label="EMERGENCY"
          color="error"
          size="small"
          sx={{fontWeight: 700, flex: '0 0 auto'}}
        />
      )}
      {rainDetected && (
        <Chip
          icon={<RainIcon />}
          label="Rain"
          color="info"
          size="small"
          sx={{fontWeight: 600, flex: '0 0 auto'}}
        />
      )}

      <MetricPill
        icon={isCharging ? <BatteryChargingIcon /> : <BatteryIcon />}
        label={isCharging ? 'Charging' : 'Battery'}
        value={battery !== null ? `${battery}%` : '—'}
        color={battery !== null ? batteryColor(battery, isCharging) : 'default'}
      />

      <MetricPill
        icon={wifi && wifi.quality > 0 ? <WifiIcon /> : <WifiOffIcon />}
        label="WLAN"
        value={
          wifi
            ? wifi.signalDbm !== null
              ? `${wifi.quality}% · ${wifi.signalDbm} dBm`
              : `${wifi.quality}%`
            : '—'
        }
        color={wifi ? qualityColor(wifi.quality) : 'default'}
      />

      <MetricPill
        icon={<GpsIcon />}
        label="GPS"
        value={
          gpsPct !== null
            ? fixType !== undefined
              ? `${gpsPct}% · ${fixTypeShort(fixType)}`
              : `${gpsPct}%`
            : '—'
        }
        color={gpsPct !== null ? gpsColor(gpsPct) : 'default'}
      />

      {sats !== undefined && (
        <MetricPill icon={<SatelliteIcon />} label="Sats" value={String(sats)} />
      )}

      <MetricPill
        icon={<PinDropIcon />}
        label="Accuracy"
        value={fmtAccuracy(posAccuracy)}
      />

      <MetricPill
        icon={<HeadingIcon />}
        label="Heading"
        value={fmtDeg(heading)}
      />

      <MetricPill
        icon={<CurrentIcon />}
        label="Current"
        value={power.totalCurrentA !== null ? `${power.totalCurrentA.toFixed(2)} A` : '—'}
      />

      <MetricPill
        icon={<BoltIcon />}
        label="Power"
        value={power.powerW !== null ? `${power.powerW.toFixed(1)} W` : '—'}
      />

      <MetricPill
        icon={<SpeedIcon />}
        label="State"
        value={currentState ?? '—'}
      />
    </Box>
  );
}
