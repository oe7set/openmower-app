'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import {getSensorHistory, seedSensorHistory, type SensorSample} from '@/stores/sensorsStore';
import {Box, Typography, useTheme} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {formatRelativeTime} from '../sensors/sensorFormatting';

// Battery time-series charts. Each series is backed by an om_* sensor in the
// xbot_monitoring pipeline, so we get the live ring buffer plus a 1 h backend
// history (sensors.history) for free. We poll the local ring at 4 Hz rather
// than subscribing reactively, mirroring ImuCharts — the BMS stream is only
// ~1 Hz so this is gentle, but the discipline keeps route transitions snappy.

const CHART_REFRESH_MS = 250;
const MAX_POINTS = 150;

interface SeriesPoint {
  ts: number;
  value: number;
}

// Downsample the ring to at most MAX_POINTS (stride sampling preserves shape).
function buildSeries(history: readonly SensorSample[]): SeriesPoint[] {
  const stride = Math.max(1, Math.ceil(history.length / MAX_POINTS));
  const out: SeriesPoint[] = [];
  for (let i = 0; i < history.length; i += stride) {
    const s = history[i];
    if (typeof s.value === 'number') out.push({ts: s.ts, value: s.value});
  }
  return out;
}

// Poll the sensor ring on CHART_REFRESH_MS rather than re-rendering on every
// store publish. Returns the latest ring snapshot; the caller memoizes off it.
function useThrottledSensorHistory(mowerId: string | undefined, sensorId: string): readonly SensorSample[] {
  const [history, setHistory] = useState<readonly SensorSample[]>(() => getSensorHistory(mowerId, sensorId));
  useEffect(() => {
    // Tick immediately (covers a mowerId/sensor switch) then on the cadence.
    const tick = () => setHistory(getSensorHistory(mowerId, sensorId));
    const lead = setTimeout(tick, 0);
    const id = setInterval(tick, CHART_REFRESH_MS);
    return () => {
      clearTimeout(lead);
      clearInterval(id);
    };
  }, [mowerId, sensorId]);
  return history;
}

interface ChartPanelProps {
  title: string;
  unit: string;
  mowerId: string | undefined;
  sensorId: string;
  digits?: number;
}

function ChartPanel({title, unit, mowerId, sensorId, digits = 2}: ChartPanelProps) {
  const theme = useTheme();
  const rpc = useSelectedMower((s) => s?.rpc);
  const history = useThrottledSensorHistory(mowerId, sensorId);
  const data = useMemo(() => buildSeries(history), [history]);

  // Seed the trailing-hour backend history once on mount so the chart isn't
  // empty before enough live samples have streamed in. Backfill-only merge in
  // seedSensorHistory drops anything overlapping the live data.
  useEffect(() => {
    if (!rpc || !mowerId) return;
    let cancelled = false;
    rpc.sensors
      .history({sensor_id: sensorId})
      .then((res) => {
        if (cancelled) return;
        const incoming = (res as {samples?: Array<{ts_ms: number; value: number}>}).samples;
        if (incoming && incoming.length > 0) {
          seedSensorHistory(mowerId, sensorId, incoming);
        }
      })
      .catch(() => {
        // Older xbot_monitoring without sensors.history — live-only fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [rpc, mowerId, sensorId]);

  // Reference "now" for relative-time labels = the latest sample's timestamp.
  // Only read when data exists (the empty branch renders a placeholder, not the
  // chart), so we never need an impure Date.now() in render.
  const now = data.length > 0 ? data[data.length - 1].ts : 0;
  const xDomain: [number, number] | undefined =
    data.length > 0 ? [data[0].ts, data[data.length - 1].ts] : undefined;
  const gradientId = `batteryGradient-${sensorId}`;
  const lineColor = theme.palette.primary.main;

  return (
    <Box sx={{width: '100%'}}>
      <Typography variant="subtitle2" sx={{mb: 0.5, color: 'text.secondary'}}>
        {title} ({unit})
      </Typography>
      <Box sx={{width: '100%', height: 160}}>
        {data.length === 0 ? (
          <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
            <Typography variant="body2" color="text.disabled">
              Waiting for data…
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <ComposedChart data={data} margin={{top: 4, right: 8, left: 0, bottom: 0}}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={xDomain}
                scale="time"
                tick={{fontSize: 10, fill: theme.palette.text.secondary}}
                stroke={theme.palette.divider}
                tickFormatter={(ts: number) => formatRelativeTime(ts, now)}
                minTickGap={48}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{fontSize: 10, fill: theme.palette.text.secondary}}
                stroke={theme.palette.divider}
                width={48}
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
                labelFormatter={(ts) => (typeof ts === 'number' ? formatRelativeTime(ts, now) : '')}
                formatter={(value) => [typeof value === 'number' ? `${value.toFixed(digits)} ${unit}` : String(value), title]}
              />
              <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${gradientId})`} isAnimationActive={false} />
              <Line type="monotone" dataKey="value" stroke={lineColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
}

interface BatteryChartsProps {
  mowerId: string | undefined;
  /** When true, include the BMS-only series (current, temperature). */
  hasBms: boolean;
}

export default function BatteryCharts({mowerId, hasBms}: BatteryChartsProps) {
  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
      <ChartPanel title="Voltage" unit="V" mowerId={mowerId} sensorId="om_v_battery" digits={1} />
      {hasBms && <ChartPanel title="Current" unit="A" mowerId={mowerId} sensorId="om_bms_current" digits={2} />}
      {hasBms && <ChartPanel title="Temperature" unit="°C" mowerId={mowerId} sensorId="om_bms_temp" digits={1} />}
      {!hasBms && <ChartPanel title="Charge current" unit="A" mowerId={mowerId} sensorId="om_charge_current" digits={2} />}
    </Box>
  );
}
