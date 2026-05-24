'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSensorValue} from '@/stores/sensorsStore';
import type {SensorInfo} from '@/stores/schemas';
import {Box, Card, CardActionArea, CardContent, LinearProgress, Typography, useTheme} from '@mui/material';
import {colorFor, formatValue, resolveRange} from './sensorFormatting';

interface SensorGaugeProps {
  mowerId: string;
  info: SensorInfo;
  onClick: () => void;
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
