'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSensorValue} from '@/stores/sensorsStore';
import type {SensorInfo} from '@/stores/schemas';
import {Box, Card, CardActionArea, CardContent, LinearProgress, Typography, useTheme} from '@mui/material';

interface SensorGaugeProps {
  mowerId: string;
  info: SensorInfo;
  onClick: () => void;
}

// Resolves a [low, high] range used to draw the gauge bar. We prefer
// has_min_max boundaries; fall back to critical-low/high if min/max are
// missing; final fallback is a [0, latest*1.2] best-effort range so we
// never end up with an unreadable empty bar.
function resolveRange(info: SensorInfo, latest: number): [number, number] {
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

function colorFor(info: SensorInfo, value: number): 'success' | 'warning' | 'error' {
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

function formatValue(value: number | string, unit: string): string {
  if (typeof value === 'string') return value;
  // 3 decimals for metres, 2 for everything else — same convention the Flutter
  // app used. Helps RPM and temperature readings stay readable.
  const decimals = unit === 'm' ? 3 : 2;
  return `${value.toFixed(decimals)} ${unit}`.trim();
}

export default function SensorGauge({mowerId, info, onClick}: SensorGaugeProps) {
  const theme = useTheme();
  const sample = useSensorValue(mowerId, info.sensor_id);
  const value = sample?.value;

  const numericValue = typeof value === 'number' ? value : 0;
  const [low, high] = resolveRange(info, numericValue);
  const span = high - low || 1;
  const pct = Math.max(0, Math.min(100, ((numericValue - low) / span) * 100));
  const color = typeof value === 'number' ? colorFor(info, numericValue) : 'success';

  const label = info.sensor_name || info.sensor_id;

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 240px', minWidth: 0}}>
      <CardActionArea onClick={onClick} sx={{height: '100%'}}>
        <CardContent>
          <Typography variant="caption" color="text.secondary" noWrap sx={{display: 'block'}}>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight="600" color={`${color}.main`} sx={{mt: 0.5, fontFamily: 'monospace'}}>
            {value === undefined ? '—' : formatValue(value, info.unit)}
          </Typography>
          {typeof value === 'number' && (
            <Box sx={{mt: 1.5}}>
              <LinearProgress
                variant="determinate"
                value={pct}
                color={color}
                sx={{height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': {borderRadius: 4}}}
              />
              <Box sx={{display: 'flex', justifyContent: 'space-between', mt: 0.5}}>
                <Typography variant="caption" color="text.disabled">
                  {low.toFixed(0)}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {high.toFixed(0)}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
