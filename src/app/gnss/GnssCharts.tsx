'use client';

import {getGnssHistory, type GnssHistoryPoint} from '@/stores/gnssStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {Box, Typography, useTheme} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

// Charts refresh on their own cadence rather than re-rendering on every GNSS
// publish (mirrors ImuCharts — keeps recharts reconciliation off the stream
// path). The GNSS stream is ~1-4 Hz so 500 ms is plenty.
const CHART_REFRESH_MS = 500;
const MAX_POINTS = 150;

interface SeriesPoint {
  ts: number;
  v: number;
}

function downsample(history: readonly GnssHistoryPoint[], pick: (p: GnssHistoryPoint) => number): SeriesPoint[] {
  const stride = Math.max(1, Math.ceil(history.length / MAX_POINTS));
  const out: SeriesPoint[] = [];
  for (let i = 0; i < history.length; i += stride) {
    out.push({ts: history[i].ts, v: pick(history[i])});
  }
  return out;
}

function useThrottledGnssHistory(mowerId: string | undefined): readonly GnssHistoryPoint[] {
  const [history, setHistory] = useState<readonly GnssHistoryPoint[]>(() => getGnssHistory(mowerId));
  useEffect(() => {
    const tick = () => setHistory(getGnssHistory(mowerId));
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
  color: string;
  digits?: number;
}

function ChartPanel({title, unit, data, color, digits = 2}: ChartPanelProps) {
  const theme = useTheme();
  const xDomain: [number, number] | undefined =
    data.length > 0 ? [data[0].ts, data[data.length - 1].ts] : undefined;

  return (
    <Box sx={{width: '100%'}}>
      <Typography variant="subtitle2" sx={{mb: 0.5, color: 'text.secondary'}}>
        {title} ({unit})
      </Typography>
      <Box sx={{width: '100%', height: 150}}>
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
              <XAxis dataKey="ts" type="number" domain={xDomain} scale="time" tick={false} stroke={theme.palette.divider} height={4} />
              <YAxis
                tick={{fontSize: 10, fill: theme.palette.text.secondary}}
                stroke={theme.palette.divider}
                width={44}
                tickFormatter={(v: number) => v.toFixed(digits)}
              />
              <Tooltip
                isAnimationActive={false}
                contentStyle={{
                  background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius,
                  fontSize: 12,
                }}
                labelFormatter={(ts) => (typeof ts === 'number' ? new Date(ts).toLocaleTimeString() : '')}
                formatter={(value) => [typeof value === 'number' ? `${value.toFixed(digits)} ${unit}` : String(value), title]}
              />
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
}

export default function GnssCharts() {
  const theme = useTheme();
  const mowerId = useSelectedMower((s) => s?.id);
  const history = useThrottledGnssHistory(mowerId);

  const accuracy = useMemo(() => downsample(history, (p) => p.hacc), [history]);
  const cn0 = useMemo(() => downsample(history, (p) => p.avgCn0), [history]);
  const used = useMemo(() => downsample(history, (p) => p.used), [history]);

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
      <ChartPanel title="Horizontal accuracy" unit="m" data={accuracy} color={theme.palette.info.main} digits={2} />
      <ChartPanel title="Average C/N0" unit="dB-Hz" data={cn0} color={theme.palette.success.main} digits={0} />
      <ChartPanel title="Satellites used" unit="" data={used} color={theme.palette.warning.main} digits={0} />
    </Box>
  );
}
