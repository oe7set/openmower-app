'use client';

import {Box, useTheme} from '@mui/material';
import {forwardRef, useImperativeHandle, useState} from 'react';
import {sampleState, type Sample} from './metrics';

export interface CellInfo {
  mean: number;
  count: number;
}

export interface HoverInfoHandle {
  showSample: (sample: Sample) => void;
  showCell: (info: CellInfo) => void;
  clear: () => void;
}

interface HoverInfoProps {
  isMobile: boolean;
  /** Metric label for the grid-cell tooltip. */
  metricLabel: string;
  /** Grid cell size (m) for the grid-cell tooltip caption. */
  cellSizeM: number;
}

// Isolated hover tooltip overlay. Owns its own state so a hover only re-renders
// this small component, never the heavy heatmap page. The page drives it through
// the imperative handle (showSample / showCell / clear).
const HoverInfo = forwardRef<HoverInfoHandle, HoverInfoProps>(function HoverInfo(
  {isMobile, metricLabel, cellSizeM},
  ref,
) {
  const theme = useTheme();
  const [sample, setSample] = useState<Sample | null>(null);
  const [cell, setCell] = useState<CellInfo | null>(null);

  useImperativeHandle(ref, () => ({
    showSample: (s) => {
      setSample(s);
      setCell(null);
    },
    showCell: (info) => {
      setCell(info);
      setSample(null);
    },
    clear: () => {
      setSample(null);
      setCell(null);
    },
  }));

  const boxSx = {
    position: 'absolute' as const,
    ...(isMobile ? {bottom: 12, left: 12, right: 12, maxWidth: 'unset'} : {top: 12, right: 12, maxWidth: 280}),
    bgcolor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 1,
    px: 1.5,
    py: 1,
    fontSize: '0.78rem',
    fontFamily: 'var(--font-dm-mono), monospace',
    pointerEvents: 'none' as const,
    zIndex: 5,
  };

  if (sample) {
    const s = sample;
    return (
      <Box sx={boxSx}>
        <div>{new Date(s.ts * 1000).toLocaleTimeString()}</div>
        <div style={{opacity: 0.7}}>
          x={s.x.toFixed(2)}, y={s.y.toFixed(2)}
        </div>
        {sampleState(s) !== undefined && <div>State: {sampleState(s)}</div>}
        {s.gps_fix_type !== undefined && (
          <div>
            GPS fix: {s.gps_fix_type} · sats {s.gps_satellite_count ?? '—'} · PDOP {s.gps_pdop?.toFixed(2) ?? '—'}
          </div>
        )}
        {s.gps_accuracy !== undefined && <div>GPS acc: ±{s.gps_accuracy.toFixed(2)}m</div>}
        {(s.wifi_dbm !== undefined || s.wifi_q !== undefined) && (
          <div>
            WLAN: {s.wifi_dbm ?? '—'}dBm ({((s.wifi_q ?? 0) * 100).toFixed(0)}%)
          </div>
        )}
        {(s.qw !== undefined || s.pitch !== undefined) && (
          <div>
            Orient: roll {radToDeg(s.roll)}° · pitch {radToDeg(s.pitch)}° · yaw {radToDeg(s.yaw)}°
          </div>
        )}
        {s.om_mow_motor_current !== undefined && <div>Mow current: {s.om_mow_motor_current.toFixed(2)}A</div>}
        {s.om_mow_motor_rpm !== undefined && <div>Mow RPM: {s.om_mow_motor_rpm.toFixed(0)}</div>}
        {s.om_mow_motor_temp !== undefined && <div>Mow temp: {s.om_mow_motor_temp.toFixed(1)}°C</div>}
        {s.om_mow_esc_temp !== undefined && <div>Mow ESC: {s.om_mow_esc_temp.toFixed(1)}°C</div>}
        {(s.om_left_esc_temp !== undefined || s.om_right_esc_temp !== undefined) && (
          <div>
            ESC: L {s.om_left_esc_temp?.toFixed(1) ?? '—'}°C · R {s.om_right_esc_temp?.toFixed(1) ?? '—'}°C
          </div>
        )}
        {s.om_v_battery !== undefined && <div>Battery: {s.om_v_battery.toFixed(2)}V</div>}
      </Box>
    );
  }

  if (cell) {
    return (
      <Box sx={boxSx}>
        <div>{metricLabel}</div>
        <div style={{opacity: 0.7}}>
          Ø {cell.mean.toFixed(2)} · {cell.count} pts / {cellSizeM}m cell
        </div>
      </Box>
    );
  }

  return null;
});

export default HoverInfo;

// Radians → whole degrees for the orientation tooltip; em-dash when absent.
function radToDeg(rad: number | undefined): string {
  if (rad === undefined || !Number.isFinite(rad)) return '—';
  return Math.round((rad * 180) / Math.PI).toString();
}
