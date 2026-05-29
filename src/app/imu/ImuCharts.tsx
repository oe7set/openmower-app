'use client';

import {getImuHistory} from '@/stores/imuStore';
import type {ImuSample} from '@/stores/schemas';
import {useSelectedMower} from '@/stores/mowersStore';
import {Box, Typography, useTheme} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

interface SeriesPoint {
  ts: number;
  x: number;
  y: number;
  z: number;
}

// Charts refresh at this cadence instead of subscribing to every ~11 Hz IMU
// publish. Two 600-point recharts LineCharts reconciling at 11 Hz saturated
// the main thread and starved App Router route transitions (leaving /imu took
// minutes). 4 Hz is plenty for a live trend and frees the thread between ticks.
const CHART_REFRESH_MS = 250;

// recharts can't resolve more points than the chart is pixels wide, and the
// reconcile cost scales with point count. Downsample the 600-sample ring to
// at most this many points (stride sampling preserves the trend shape).
const MAX_POINTS = 150;

// Build a chart-friendly, downsampled array from the IMU ring buffer.
function buildSeries(history: readonly ImuSample[], kind: 'accel' | 'gyro'): SeriesPoint[] {
  const stride = Math.max(1, Math.ceil(history.length / MAX_POINTS));
  const out: SeriesPoint[] = [];
  for (let i = 0; i < history.length; i += stride) {
    const s = history[i];
    out.push(
      kind === 'accel'
        ? {ts: s.ts_ms, x: s.ax, y: s.ay, z: s.az}
        : {ts: s.ts_ms, x: s.gx, y: s.gy, z: s.gz},
    );
  }
  return out;
}

// Poll the IMU history at CHART_REFRESH_MS rather than re-rendering on every
// store publish. Returns the latest ring snapshot; the caller memoizes the
// derived series off it.
function useThrottledImuHistory(mowerId: string | undefined): readonly ImuSample[] {
  const [history, setHistory] = useState<readonly ImuSample[]>(() => getImuHistory(mowerId));
  useEffect(() => {
    // Tick immediately (covers a mowerId switch) then on the refresh cadence.
    // Wrapped in the interval-arming so we don't setState directly in the
    // effect body. The leading 0ms timer fires after paint, not synchronously.
    const tick = () => setHistory(getImuHistory(mowerId));
    const lead = setTimeout(tick, 0);
    const id = setInterval(tick, CHART_REFRESH_MS);
    return () => {
      clearTimeout(lead);
      clearInterval(id);
    };
  }, [mowerId]);
  return history;
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
  const history = useThrottledImuHistory(mowerId);

  const accel = useMemo(() => buildSeries(history, 'accel'), [history]);
  const gyro = useMemo(() => buildSeries(history, 'gyro'), [history]);

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
      <ChartPanel title="Acceleration" unit="m/s²" data={accel} />
      <ChartPanel title="Angular velocity" unit="rad/s" data={gyro} />
    </Box>
  );
}
