'use client';

import {fixTypeShort} from '@/lib/gps';
import {useSelectedMower} from '@/stores/mowersStore';
import type {SensorInfo} from '@/stores/schemas';
import {seedSensorHistory, useSensorHistory} from '@/stores/sensorsStore';
import {Box, Dialog, DialogContent, DialogTitle, Typography, useTheme} from '@mui/material';
import {useEffect, useMemo} from 'react';

interface SensorHistoryDialogProps {
  mowerId: string;
  info: SensorInfo;
  open: boolean;
  onClose: () => void;
}

const WIDTH = 560;
const HEIGHT = 200;
const PAD = 24;

// Format a millisecond duration into a human-readable "1 h 12 min" / "32 min"
// / "45 s" string for the chart subtitle. The chart window can span anywhere
// from a single sample (just connected) to the full 1 h backend ring buffer,
// so we adapt the unit to whichever is dominant.
function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return s > 10 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export default function SensorHistoryDialog({mowerId, info, open, onClose}: SensorHistoryDialogProps) {
  const theme = useTheme();
  const samples = useSensorHistory(mowerId, info.sensor_id);
  const rpc = useSelectedMower((s) => s?.rpc);

  // On open, ask the backend for any history we don't already have. This
  // covers the case where the user freshly loaded the app and immediately
  // opened a chart — without this nudge they would see "Waiting for data…"
  // until the next live tick. We pass `since_ts` set to our most recent
  // sample so the response only carries delta data when the live stream
  // already filled the buffer.
  useEffect(() => {
    if (!open || !rpc) return;
    const lastTs = samples.length > 0 ? samples[samples.length - 1].ts : undefined;
    let cancelled = false;
    rpc.sensors
      .history({sensor_id: info.sensor_id, since_ts: lastTs})
      .then((res) => {
        if (cancelled) return;
        const incoming = (res as {samples?: Array<{ts_ms: number; value: number}>}).samples;
        if (incoming && incoming.length > 0) {
          seedSensorHistory(mowerId, info.sensor_id, incoming);
        }
      })
      .catch(() => {
        // Older xbot_monitoring without sensors.history — fall through to
        // live-only behaviour.
      });
    return () => {
      cancelled = true;
    };
    // We deliberately depend on `open`/`mowerId`/`info.sensor_id` only — we
    // don't want every live sample push to retrigger the RPC.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mowerId, info.sensor_id, rpc]);

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
    return {d, vMin, vMax, count: numeric.length, durationMs: tsMax - tsMin};
  }, [samples]);

  // Friendly fix-type chip for the GPS fix sensor — the raw 0..5 number
  // tells the user nothing without the lookup.
  const fixTypeSubtitle = useMemo(() => {
    if (info.sensor_id !== 'om_gps_fix_type') return null;
    if (samples.length === 0) return null;
    const latest = samples[samples.length - 1];
    if (typeof latest.value !== 'number') return null;
    return `current: ${fixTypeShort(latest.value)} (legend: 0=no fix · 1=2D · 2=3D · 3=DGPS · 4=RTK float · 5=RTK fixed)`;
  }, [info.sensor_id, samples]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{info.sensor_name || info.sensor_id}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: fixTypeSubtitle ? 0.25 : 1}}>
          {info.unit && `${info.unit} · `}
          {info.value_description?.toLowerCase() || 'value'} · {samples.length} sample
          {samples.length === 1 ? '' : 's'}
          {path && path.durationMs > 0 ? ` · ${formatDuration(path.durationMs)}` : ''}
        </Typography>
        {fixTypeSubtitle && (
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
            {fixTypeSubtitle}
          </Typography>
        )}
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
