'use client';

import {fixTypeShort} from '@/lib/gps';
import {useSelectedMower} from '@/stores/mowersStore';
import type {SensorInfo} from '@/stores/schemas';
import {seedSensorHistory, useSensorHistory, type SensorSample} from '@/stores/sensorsStore';
import {
  Close as CloseIcon,
  OpenInFull as OpenInFullIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  TrendingDown as TrendDownIcon,
  TrendingFlat as TrendFlatIcon,
  TrendingUp as TrendUpIcon,
  ZoomOutMap as ZoomOutMapIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip as MuiTooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {colorFor, computeStats, formatRelativeTime, formatValue, resolveRange, type SensorStatus} from './sensorFormatting';

interface SensorHistoryDialogProps {
  mowerId: string;
  info: SensorInfo;
  open: boolean;
  onClose: () => void;
}

type WindowMs = number | 'all';

const WINDOW_OPTIONS: Array<{value: WindowMs; label: string}> = [
  {value: 5 * 60_000, label: '5m'},
  {value: 15 * 60_000, label: '15m'},
  {value: 60 * 60_000, label: '1h'},
  {value: 'all', label: 'All'},
];

interface ChartPoint {
  ts: number;
  value: number;
}

// MUI palette key per status — used for Chip color and reference line strokes.
function statusToPaletteKey(status: SensorStatus): 'success' | 'warning' | 'error' {
  return status;
}

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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const samples = useSensorHistory(mowerId, info.sensor_id);
  const rpc = useSelectedMower((s) => s?.rpc);

  const [windowMs, setWindowMs] = useState<WindowMs>(60 * 60_000);
  // When paused, frozenAt holds the Date.now() of the moment the user paused.
  // The visible window is anchored to that value instead of advancing with
  // wall-clock time, so the chart stops scrolling. Setting back to null
  // resumes live behaviour. State (not ref) so memoised slices recompute.
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const paused = frozenAt !== null;
  const [yMode, setYMode] = useState<'auto' | 'range'>('auto');

  // We hold off rendering the recharts <ResponsiveContainer> until the MUI
  // Dialog enter-transition has finished. During the transition the Paper
  // has scale(0)/opacity(0) and getBoundingClientRect() returns 0×0 (or
  // even -1×-1), which makes recharts log
  //   "The width(-1) and height(-1) of chart should be greater than 0..."
  // even though the chart later renders correctly. Gating on `mounted`
  // ensures recharts only ever measures a stable, visible container.
  const [mounted, setMounted] = useState(false);

  // Reset transient state every time the dialog re-opens for a different
  // sensor — otherwise a previous Pause carries over and confuses users.
  useEffect(() => {
    if (open) {
      setFrozenAt(null);
      setYMode('auto');
    } else {
      setMounted(false);
    }
  }, [open, info.sensor_id]);

  // Backend history seed. Two modes:
  //  - Thin local buffer (< 60 samples or < 30 s span) → request the entire
  //    server ring buffer (`since_ts: undefined`). This covers the case
  //    where a fresh browser has just connected and the boot-time
  //    `history_bulk` either failed or hasn't run yet.
  //  - Healthy local buffer → request only the period BEFORE our buffer
  //    starts (`since_ts: firstLiveTs - 1`). This still extends history if
  //    we have less than the full hour, and the strictly backfill-only
  //    merge in `seedSensorHistory` will silently drop anything that
  //    overlaps our existing live data.
  useEffect(() => {
    if (!open || !rpc) return;
    let cancelled = false;
    let sinceTs: number | undefined;
    const firstTs = samples.length > 0 ? samples[0].ts : undefined;
    const lastTs = samples.length > 0 ? samples[samples.length - 1].ts : undefined;
    const span = firstTs !== undefined && lastTs !== undefined ? lastTs - firstTs : 0;
    const thin = samples.length < 60 || span < 30_000;
    if (!thin && firstTs !== undefined) {
      sinceTs = firstTs - 1;
    }
    rpc.sensors
      .history({sensor_id: info.sensor_id, since_ts: sinceTs})
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mowerId, info.sensor_id, rpc]);

  // The visible "now" — anchor for both the X-axis right edge and the
  // sliding-window cutoff. While paused it is `frozenAt` (set once when the
  // user clicked Pause) and stays fixed forever. While live we anchor to the
  // *latest sample* timestamp, NOT `Date.now()` directly: re-evaluating
  // `Date.now()` on every render would scroll the chart smoothly even after
  // pausing (because re-renders happen for unrelated state changes), and it
  // would also cause a jitter when the browser clock and the sample clocks
  // disagree. Anchoring to the freshest sample makes the right edge advance
  // only when truly new data arrives.
  const numericAll: ChartPoint[] = useMemo(() => {
    const out: ChartPoint[] = [];
    for (const s of samples) {
      if (typeof s.value === 'number') out.push({ts: s.ts, value: s.value});
    }
    return out;
  }, [samples]);

  const now = useMemo(() => {
    if (frozenAt !== null) return frozenAt;
    if (numericAll.length > 0) return numericAll[numericAll.length - 1].ts;
    return Date.now();
  }, [frozenAt, numericAll]);

  const numericSamples: ChartPoint[] = useMemo(() => {
    if (numericAll.length === 0) return numericAll;
    const cutoff = windowMs === 'all' ? -Infinity : now - windowMs;
    // While paused, also exclude any live samples that arrived AFTER the
    // freeze instant — they do not belong on the visible chart.
    const upper = frozenAt !== null ? frozenAt : Infinity;
    return numericAll.filter((p) => p.ts >= cutoff && p.ts <= upper);
  }, [numericAll, windowMs, now, frozenAt]);

  const stats = useMemo(() => computeStats(numericSamples as SensorSample[]), [numericSamples]);

  const status: SensorStatus = stats.current !== null ? colorFor(info, stats.current) : 'success';
  const statusKey = statusToPaletteKey(status);
  const lineColor = theme.palette[statusKey].main;

  // Y-domain: auto-fit (recharts default) vs. sensor-defined range.
  const yDomain: [number | string, number | string] = useMemo(() => {
    if (yMode === 'range' && stats.current !== null) {
      const [low, high] = resolveRange(info, stats.current);
      return [low, high];
    }
    return ['auto', 'auto'];
  }, [yMode, info, stats]);

  const isGpsFix = info.sensor_id === 'om_gps_fix_type';
  const formatChartValue = (v: number): string => {
    if (isGpsFix) return fixTypeShort(v);
    return formatValue(v, info.unit);
  };

  // Render the latest value either as raw formatted number or — for the GPS
  // fix sensor — as the friendly chip ("3D fix").
  const currentDisplay = useMemo(() => {
    if (stats.current === null) return '—';
    if (isGpsFix) return fixTypeShort(stats.current);
    return formatValue(stats.current, info.unit);
  }, [stats, isGpsFix, info.unit]);

  const trendIcon = (() => {
    if (stats.trend === null) return null;
    // Threshold to call "flat": 0.5% of the resolved range, or 0.01 if no
    // range is defined. Avoids meaningless ↑/↓ on noisy battery readings.
    const reference = stats.current ?? 0;
    const [low, high] = resolveRange(info, reference);
    const range = Math.max(0.01, Math.abs(high - low));
    const flat = range * 0.005;
    if (Math.abs(stats.trend) < flat) return <TrendFlatIcon fontSize="small" />;
    return stats.trend > 0 ? <TrendUpIcon fontSize="small" /> : <TrendDownIcon fontSize="small" />;
  })();

  const trendLabel = stats.trend !== null
    ? `${stats.trend >= 0 ? '+' : ''}${stats.trend.toFixed(info.unit === 'm' ? 3 : 2)} ${info.unit}`.trim() + ' / 5 min'
    : null;

  const hasData = numericSamples.length > 0;

  const xDomain: [number, number] = useMemo(() => {
    if (numericSamples.length === 0) return [now - 60_000, now];
    const min = numericSamples[0].ts;
    return [min, now];
  }, [numericSamples, now]);

  const gradientId = `sensorGradient-${info.sensor_id}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      slotProps={{
        paper: {sx: {overflow: 'hidden'}},
        transition: {onEntered: () => setMounted(true)},
      }}
    >
      <DialogTitle sx={{display: 'flex', alignItems: 'center', gap: 1, pr: 1}}>
        <Box sx={{flex: 1, minWidth: 0}}>
          <Typography variant="h6" component="div" noWrap>
            {info.sensor_name || info.sensor_id}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
            {info.unit && `${info.unit} · `}
            {info.value_description?.toLowerCase() || 'value'}
            {hasData ? ` · ${numericSamples.length} sample${numericSamples.length === 1 ? '' : 's'}` : ''}
            {hasData && numericSamples.length > 1
              ? ` · ${formatDuration(numericSamples[numericSamples.length - 1].ts - numericSamples[0].ts)}`
              : ''}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="close" edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pb: 2,
          // On mobile (fullScreen) the DialogContent must own the remaining
          // vertical space so the chart wrapper can grow via flex:1 with a
          // measurable, non-zero height.
          ...(isMobile && {flex: 1, minHeight: 0}),
        }}
      >
        {/* Current value + trend header */}
        <Box>
          <Stack direction="row" alignItems="baseline" gap={1.5} flexWrap="wrap">
            <Typography
              variant="h3"
              fontWeight={600}
              color={`${statusKey}.main`}
              sx={{fontFamily: 'monospace', lineHeight: 1.1}}
            >
              {currentDisplay}
            </Typography>
            {trendIcon && trendLabel && (
              <Stack direction="row" alignItems="center" gap={0.5} sx={{color: 'text.secondary'}}>
                {trendIcon}
                <Typography variant="body2">{trendLabel}</Typography>
              </Stack>
            )}
          </Stack>

          {/* GPS fix legend — preserved from previous implementation. */}
          {isGpsFix && (
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
              0=no fix · 1=2D · 2=3D · 3=DGPS · 4=RTK float · 5=RTK fixed
            </Typography>
          )}
        </Box>

        {/* Stats chips */}
        <Stack direction="row" gap={1} flexWrap="wrap">
          {stats.min !== null && (
            <Chip size="small" label={`min ${formatChartValue(stats.min)}`} variant="outlined" />
          )}
          {stats.max !== null && (
            <Chip size="small" label={`max ${formatChartValue(stats.max)}`} variant="outlined" />
          )}
          {stats.avg !== null && (
            <Chip size="small" label={`avg ${formatChartValue(stats.avg)}`} variant="outlined" />
          )}
        </Stack>

        {/* Toolbar */}
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={windowMs}
            onChange={(_, v: WindowMs | null) => v !== null && setWindowMs(v)}
            aria-label="time window"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <ToggleButton key={String(opt.value)} value={opt.value} sx={{px: 1.5, py: 0.25}}>
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{flex: 1}} />
          <MuiTooltip title={paused ? 'Resume live updates' : 'Pause live updates'}>
            <IconButton
              size="small"
              onClick={() => setFrozenAt((prev) => (prev === null ? Date.now() : null))}
              color={paused ? 'primary' : 'default'}
            >
              {paused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title={yMode === 'auto' ? 'Switch to sensor range Y-axis' : 'Switch to auto-fit Y-axis'}>
            <IconButton
              size="small"
              onClick={() => setYMode((m) => (m === 'auto' ? 'range' : 'auto'))}
              color={yMode === 'range' ? 'primary' : 'default'}
            >
              {yMode === 'auto' ? <OpenInFullIcon fontSize="small" /> : <ZoomOutMapIcon fontSize="small" />}
            </IconButton>
          </MuiTooltip>
        </Stack>

        {/* Chart */}
        {!hasData ? (
          <Box sx={{py: 6, textAlign: 'center'}}>
            <Typography color="text.disabled">Waiting for data…</Typography>
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              // Mobile: flex-stretch into remaining DialogContent height so
              // ResponsiveContainer always sees a measurable parent.
              // Desktop: fixed 320px height for predictable layout.
              ...(isMobile ? {flex: 1, minHeight: 200} : {height: 320}),
            }}
          >
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <ComposedChart data={numericSamples} margin={{top: 8, right: 16, left: 0, bottom: 8}}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={xDomain}
                  scale="time"
                  tick={{fontSize: 11, fill: theme.palette.text.secondary}}
                  stroke={theme.palette.divider}
                  tickFormatter={(ts: number) => formatRelativeTime(ts, now)}
                  minTickGap={48}
                />
                <YAxis
                  domain={yDomain}
                  tick={{fontSize: 11, fill: theme.palette.text.secondary}}
                  stroke={theme.palette.divider}
                  width={56}
                  tickFormatter={(v: number) => formatChartValue(v)}
                />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{stroke: theme.palette.text.disabled, strokeDasharray: '3 3'}}
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                    fontSize: 12,
                  }}
                  labelFormatter={(ts) => (typeof ts === 'number' ? formatRelativeTime(ts, now) : '')}
                  formatter={(value) => [
                    typeof value === 'number' ? formatChartValue(value) : String(value),
                    info.value_description?.toLowerCase() || 'value',
                  ]}
                />
                {/* Threshold lines — only when the corresponding flag is set. */}
                {info.has_critical_low && (
                  <ReferenceLine
                    y={info.lower_critical_value}
                    stroke={theme.palette.error.main}
                    strokeDasharray="4 4"
                    label={{
                      value: 'critical low',
                      position: 'insideBottomLeft',
                      fill: theme.palette.error.main,
                      fontSize: 10,
                    }}
                  />
                )}
                {info.has_critical_high && (
                  <ReferenceLine
                    y={info.upper_critical_value}
                    stroke={theme.palette.error.main}
                    strokeDasharray="4 4"
                    label={{
                      value: 'critical high',
                      position: 'insideTopLeft',
                      fill: theme.palette.error.main,
                      fontSize: 10,
                    }}
                  />
                )}
                {info.has_min_max && (
                  <>
                    <ReferenceLine
                      y={info.min_value}
                      stroke={theme.palette.warning.main}
                      strokeDasharray="2 6"
                      strokeOpacity={0.6}
                    />
                    <ReferenceLine
                      y={info.max_value}
                      stroke={theme.palette.warning.main}
                      strokeDasharray="2 6"
                      strokeOpacity={0.6}
                    />
                  </>
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="none"
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{r: 4, stroke: lineColor, strokeWidth: 2, fill: theme.palette.background.paper}}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            )}
          </Box>
        )}
      </DialogContent>
      {isMobile && (
        <DialogActions
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            px: 2,
            py: 1.5,
            zIndex: 1,
          }}
        >
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="primary"
            startIcon={<CloseIcon />}
            onClick={onClose}
          >
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
