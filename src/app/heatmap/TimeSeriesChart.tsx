'use client';

import {Box, Chip, Stack, Typography, useTheme} from '@mui/material';
import {forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef} from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import {SIGNALS, availableSignals, buildChartData, buildChartOpts, type ChartTheme} from './timeseries';
import type {Sample} from './metrics';

export interface TimeSeriesChartHandle {
  /** Move the chart cursor to a sample index (or clear it) — driven by the map. */
  setCursorIndex: (idx: number | null) => void;
}

interface TimeSeriesChartProps {
  samples: Sample[];
  /** Selected signal keys (independent of the heatmap metric). */
  selectedSignals: Set<string>;
  onToggleSignal: (key: string) => void;
  /** Reports the hovered sample index back for map sync (null on leave). */
  onCursor?: (idx: number | null) => void;
  /** Plot height in px (excluding the signal chips + legend). */
  height?: number;
}

// uPlot's `height` sizes only the plot canvas; the legend (and our flipped
// layout) stack above it, so reserve room or the x-axis labels get clipped.
const LEGEND_RESERVE = 36;

// React wrapper around uPlot for the heatmap time-series panel. Twin of the
// standalone viewer's chart wiring (openmower-heatmap-viewer/src/main.ts). The
// map→chart cursor is driven imperatively via the ref (setCursorIndex) so a
// map hover never re-renders this component or the heatmap page.
const TimeSeriesChart = forwardRef<TimeSeriesChartHandle, TimeSeriesChartProps>(function TimeSeriesChart(
  {samples, selectedSignals, onToggleSignal, onCursor, height = 260},
  ref,
) {
  const theme = useTheme();
  const plotRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  // Keep the latest onCursor in a ref so the uPlot hook closure stays stable
  // without re-creating the chart on every render.
  const onCursorRef = useRef(onCursor);
  useEffect(() => {
    onCursorRef.current = onCursor;
  }, [onCursor]);
  // Set true while we move the cursor programmatically (from the map) so the
  // resulting setCursor hook doesn't echo back through onCursor.
  const programmaticCursorRef = useRef(false);

  const available = useMemo(() => availableSignals(samples), [samples]);
  // Stable, ordered list of the active signal keys actually present in the data.
  const activeKeys = useMemo(
    () => SIGNALS.filter((s) => selectedSignals.has(s.key) && available.has(s.key)).map((s) => s.key),
    [selectedSignals, available],
  );

  const chartTheme: ChartTheme = useMemo(
    () => ({
      axis: theme.palette.text.secondary,
      grid: theme.palette.divider,
      ticks: theme.palette.divider,
    }),
    [theme.palette.text.secondary, theme.palette.divider],
  );

  // (Re)build the uPlot instance whenever the data, selection, or height change.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }
    if (samples.length === 0 || activeKeys.length === 0) return;

    const width = el.clientWidth || 600;
    const plotH = Math.max(140, height - LEGEND_RESERVE);
    const data = buildChartData(samples, activeKeys);
    const opts = buildChartOpts(
      activeKeys,
      width,
      plotH,
      (idx) => {
        // Swallow the echo from a programmatic (map-driven) cursor move.
        if (programmaticCursorRef.current) return;
        onCursorRef.current?.(idx);
      },
      chartTheme,
    );
    uplotRef.current = new uPlot(opts, data, el);

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  }, [samples, activeKeys, height, chartTheme]);

  // Keep the chart sized to its container.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const u = uplotRef.current;
      if (!u) return;
      u.setSize({width: el.clientWidth || 600, height: Math.max(140, height - LEGEND_RESERVE)});
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  // Map → chart: move the chart cursor imperatively (no prop/state, no re-render).
  // Guarded so the resulting setCursor hook doesn't echo back via onCursor.
  useImperativeHandle(ref, () => ({
    setCursorIndex: (idx: number | null) => {
      const u = uplotRef.current;
      if (!u) return;
      programmaticCursorRef.current = true;
      if (idx == null) {
        u.setCursor({left: -10, top: -10});
      } else {
        const left = u.valToPos(idx, 'x');
        u.setCursor({left, top: u.bbox.height / 2 / (window.devicePixelRatio || 1)});
      }
      programmaticCursorRef.current = false;
    },
  }));

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%'}}>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{mb: 1}}>
        {SIGNALS.map((sig) => {
          const has = available.has(sig.key);
          const on = selectedSignals.has(sig.key);
          return (
            <Chip
              key={sig.key}
              label={sig.unit ? `${sig.label} (${sig.unit})` : sig.label}
              size="small"
              disabled={!has}
              onClick={() => onToggleSignal(sig.key)}
              variant={on ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.72rem',
                ...(on && {bgcolor: sig.color, color: '#fff', '&:hover': {bgcolor: sig.color, filter: 'brightness(1.1)'}}),
                '& .MuiChip-label': {px: 1},
                // Coloured dot for the outlined (off) state.
                '&::before': {
                  content: '""',
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '2px',
                  marginLeft: '6px',
                  backgroundColor: sig.color,
                  opacity: on ? 0 : 1,
                },
              }}
            />
          );
        })}
      </Stack>
      <Box sx={{flex: 1, minHeight: 0, position: 'relative'}}>
        {activeKeys.length === 0 ? (
          <Box sx={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Typography variant="body2" color="text.secondary">
              {samples.length === 0 ? 'No samples loaded for this session.' : 'Pick one or more signals to plot.'}
            </Typography>
          </Box>
        ) : (
          <Box ref={plotRef} sx={{width: '100%', height: '100%', '& .uplot': {display: 'flex', flexDirection: 'column-reverse'}}} />
        )}
      </Box>
    </Box>
  );
});

// Memoised: with the map→chart cursor now imperative, this component's props no
// longer change on hover, so a page render won't re-render it.
export default memo(TimeSeriesChart);
