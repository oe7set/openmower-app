'use client';

import {useImuHistory} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {Box, Typography, useTheme} from '@mui/material';
import {useMemo} from 'react';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

interface SeriesPoint {
  ts: number;
  x: number;
  y: number;
  z: number;
}

// We rebuild a small chart-friendly array from the IMU ring buffer on each
// render. The ring is bounded (600 samples) and re-renders are gated by
// the imuStore subscription, so the cost stays in the single-digit ms
// range.
function buildSeries(history: ReturnType<typeof useImuHistory>, kind: 'accel' | 'gyro'): SeriesPoint[] {
  const out: SeriesPoint[] = new Array(history.length);
  for (let i = 0; i < history.length; i++) {
    const s = history[i];
    out[i] =
      kind === 'accel'
        ? {ts: s.ts_ms, x: s.ax, y: s.ay, z: s.az}
        : {ts: s.ts_ms, x: s.gx, y: s.gy, z: s.gz};
  }
  return out;
}

interface ChartPanelProps {
  title: string;
  unit: string;
  data: SeriesPoint[];
  yDomain?: [number, number] | ['auto', 'auto'];
}

function ChartPanel({title, unit, data, yDomain = ['auto', 'auto']}: ChartPanelProps) {
  const theme = useTheme();
  const colors = {
    x: theme.palette.error.main,
    y: theme.palette.success.main,
    z: theme.palette.info.main,
  };

  const xDomain: [number, number] | undefined =
    data.length > 0 ? [data[0].ts, data[data.length - 1].ts] : undefined;

  return (
    <Box sx={{width: '100%'}}>
      <Typography variant="subtitle2" sx={{mb: 0.5, color: 'text.secondary'}}>
        {title} ({unit})
      </Typography>
      <Box sx={{width: '100%', height: 180}}>
        {data.length === 0 ? (
          <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
            <Typography variant="body2" color="text.disabled">
              Waiting for data…
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <LineChart data={data} margin={{top: 4, right: 8, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={xDomain}
                scale="time"
                tick={false}
                stroke={theme.palette.divider}
                height={4}
              />
              <YAxis
                domain={yDomain}
                tick={{fontSize: 10, fill: theme.palette.text.secondary}}
                stroke={theme.palette.divider}
                width={48}
                tickFormatter={(v: number) => v.toFixed(unit === 'rad/s' ? 2 : 1)}
              />
              <Tooltip
                isAnimationActive={false}
                contentStyle={{
                  background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius,
                  fontSize: 12,
                }}
                labelFormatter={(ts) =>
                  typeof ts === 'number' ? new Date(ts).toLocaleTimeString() : ''
                }
                formatter={(value, name) => [
                  typeof value === 'number' ? `${value.toFixed(3)} ${unit}` : String(value),
                  String(name),
                ]}
              />
              <Legend
                verticalAlign="top"
                height={20}
                iconSize={8}
                wrapperStyle={{fontSize: 11, color: theme.palette.text.secondary}}
              />
              <Line type="monotone" dataKey="x" stroke={colors.x} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="y" stroke={colors.y} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="z" stroke={colors.z} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
}

export default function ImuCharts() {
  const mowerId = useSelectedMower((s) => s?.id);
  const history = useImuHistory(mowerId);

  const accel = useMemo(() => buildSeries(history, 'accel'), [history]);
  const gyro = useMemo(() => buildSeries(history, 'gyro'), [history]);

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
      <ChartPanel title="Acceleration" unit="m/s²" data={accel} />
      <ChartPanel title="Angular velocity" unit="rad/s" data={gyro} />
    </Box>
  );
}
