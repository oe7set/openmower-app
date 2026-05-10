'use client';

import type {SensorInfo} from '@/stores/schemas';
import {useSensorHistory} from '@/stores/sensorsStore';
import {Box, Dialog, DialogContent, DialogTitle, Typography, useTheme} from '@mui/material';
import {useMemo} from 'react';

interface SensorHistoryDialogProps {
  mowerId: string;
  info: SensorInfo;
  open: boolean;
  onClose: () => void;
}

const WIDTH = 560;
const HEIGHT = 200;
const PAD = 24;

export default function SensorHistoryDialog({mowerId, info, open, onClose}: SensorHistoryDialogProps) {
  const theme = useTheme();
  const samples = useSensorHistory(mowerId, info.sensor_id);

  const path = useMemo(() => {
    const numeric = samples.filter((s) => typeof s.value === 'number') as Array<{value: number; ts: number}>;
    if (numeric.length === 0) return null;

    const tsMin = numeric[0].ts;
    const tsMax = numeric[numeric.length - 1].ts;
    const tsSpan = Math.max(1, tsMax - tsMin);
    const values = numeric.map((s) => s.value);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const vSpan = Math.max(1e-6, vMax - vMin);

    const points = numeric.map((s) => {
      const x = PAD + ((s.ts - tsMin) / tsSpan) * (WIDTH - 2 * PAD);
      const y = HEIGHT - PAD - ((s.value - vMin) / vSpan) * (HEIGHT - 2 * PAD);
      return [x, y] as const;
    });

    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return {d, vMin, vMax, count: numeric.length};
  }, [samples]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{info.sensor_name || info.sensor_id}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
          {info.unit} · {info.value_description?.toLowerCase()} · last {samples.length} sample
          {samples.length === 1 ? '' : 's'}
        </Typography>
        {path === null ? (
          <Box sx={{py: 6, textAlign: 'center'}}>
            <Typography color="text.disabled">Waiting for data…</Typography>
          </Box>
        ) : (
          <Box>
            <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{display: 'block'}}>
              <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={theme.palette.background.paper} />
              {/* Mid-line for visual reference */}
              <line
                x1={PAD}
                x2={WIDTH - PAD}
                y1={HEIGHT / 2}
                y2={HEIGHT / 2}
                stroke={theme.palette.divider}
                strokeDasharray="4 4"
              />
              <path d={path.d} fill="none" stroke={theme.palette.primary.main} strokeWidth={2} />
            </svg>
            <Box sx={{display: 'flex', justifyContent: 'space-between', mt: 1, fontFamily: 'monospace'}}>
              <Typography variant="caption">min {path.vMin.toFixed(2)}</Typography>
              <Typography variant="caption">max {path.vMax.toFixed(2)}</Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
