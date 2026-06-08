'use client';

import {MAP_OVERLAY_PANEL} from '@/components/map/zIndex';
import {useSelectedMower} from '@/stores/mowersStore';
import {useSensorsStore} from '@/stores/sensorsStore';
import {useUiStore} from '@/stores/uiStore';
import {DragIndicator as DragIcon} from '@mui/icons-material';
import {Box, Typography, useTheme, type Theme} from '@mui/material';
import {ReactElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  computeDerivedPower,
  PILOT_METRICS_BY_ID,
  type MetricColor,
  type MetricContext,
} from './sensorMetrics';

// The Pilot page's configurable sensor bar. It renders its own pills (rather
// than embedding /drive's TelemetryStrip) so the bar and its config panel share
// one metric catalog. Placement, row count, opacity and which metrics show are
// all driven from uiStore and persisted. The config gear lives on the page
// (always reachable), not here; this component is display-only and reports its
// rendered height so the page can shift other controls out from under it when
// docked top/bottom.

interface Position {
  x: number;
  y: number;
}

// Approximate height of a single pill row incl. vertical padding, used to cap
// the '2 rows' mode. Pills are ~38px tall; two rows + gap + container padding.
const TWO_ROW_MAX_HEIGHT = 88;

interface FloatingSensorBarProps {
  /** Reports the bar's rendered height when docked (0 while floating). */
  onHeight?: (px: number) => void;
}

function pillColor(theme: Theme, color: MetricColor | undefined): string {
  if (!color || color === 'default') return theme.palette.text.primary;
  return theme.palette[color].main;
}

function MetricPill({icon, label, value, color}: {icon: ReactElement; label: string; value: string; color?: MetricColor}) {
  const theme = useTheme();
  const accent = pillColor(theme, color);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        border: `1px solid ${theme.palette.divider}`,
        flex: '0 0 auto',
        minWidth: 'fit-content',
      }}
    >
      <Box sx={{color: accent, display: 'flex', alignItems: 'center', '& svg': {fontSize: 16}}}>{icon}</Box>
      <Box sx={{display: 'flex', flexDirection: 'column', lineHeight: 1.1}}>
        <Typography
          variant="caption"
          sx={{fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4}}
        >
          {label}
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'var(--font-dm-mono), monospace', fontWeight: 600, color: accent}}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function FloatingSensorBar({onHeight}: FloatingSensorBarProps) {
  const theme = useTheme();
  const rows = useUiStore((s) => s.pilotSensorRows);
  const metricIds = useUiStore((s) => s.pilotSensorMetricIds);
  const opacity = useUiStore((s) => s.pilotSensorOpacity);
  const position = useUiStore((s) => s.pilotSensorPosition);

  // Gather data once via stable hooks; each metric reads from this context.
  const mowerId = useSelectedMower((s) => s?.id);
  const state = useSelectedMower((s) => s?.state);
  const values = useSensorsStore((s) => (mowerId ? s.values[mowerId] : undefined));
  const ctx = useMemo<MetricContext>(
    () => ({
      state,
      num: (id) => {
        const v = values?.[id]?.value;
        return typeof v === 'number' ? v : undefined;
      },
      power: computeDerivedPower(values),
    }),
    [state, values],
  );

  const activeMetrics = useMemo(
    () => metricIds.map((id) => PILOT_METRICS_BY_ID[id]).filter(Boolean),
    [metricIds],
  );

  const [pos, setPos] = useState<Position>({x: 8, y: 8});
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const grabOffset = useRef<Position>({x: 0, y: 0});

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== null) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      pointerId.current = e.pointerId;
      dragging.current = true;
      grabOffset.current = {x: e.clientX - pos.x, y: e.clientY - pos.y};
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || e.pointerId !== pointerId.current) return;
    setPos({
      x: Math.max(0, e.clientX - grabOffset.current.x),
      y: Math.max(0, e.clientY - grabOffset.current.y),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    dragging.current = false;
  }, []);

  const floating = position === 'floating';

  // Report the bar's rendered height to the page so it can offset other
  // controls out from under a docked bar. Floating mode reports 0 (no shift).
  const rootRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!onHeight) return;
    if (floating) {
      onHeight(0);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const report = () => onHeight(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight, floating]);

  // Ensure the page resets its offset when this component unmounts.
  useEffect(() => () => onHeight?.(0), [onHeight]);

  // Outer container position: floating uses an absolute, draggable box; the
  // docked modes pin the bar full-width to the top or bottom edge.
  const containerSx = floating
    ? {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        maxWidth: 'calc(100% - 16px)',
        borderRadius: 2,
      }
    : {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        ...(position === 'top' ? {top: 0} : {bottom: 0}),
        borderRadius: 0,
      };

  const bg = theme.palette.mode === 'dark' ? `rgba(15,17,18,${opacity})` : `rgba(255,255,255,${opacity})`;

  // Row-mode layout for the pills container.
  const pillsLayout =
    rows === 1
      ? {flexWrap: 'nowrap' as const, overflowX: 'auto' as const, whiteSpace: 'nowrap' as const}
      : rows === 2
        ? {flexWrap: 'wrap' as const, maxHeight: TWO_ROW_MAX_HEIGHT, overflowY: 'auto' as const}
        : {flexWrap: 'wrap' as const};

  return (
    <Box
      ref={rootRef}
      sx={{
        ...containerSx,
        zIndex: MAP_OVERLAY_PANEL,
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: floating ? 4 : 2,
        border: floating ? `1px solid ${theme.palette.divider}` : 'none',
        borderBottom: position === 'top' ? `1px solid ${theme.palette.divider}` : undefined,
        borderTop: position === 'bottom' ? `1px solid ${theme.palette.divider}` : undefined,
        overflow: 'hidden',
        bgcolor: bg,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Grip — drag-initiating surface, only in floating mode. */}
      {floating && (
        <Box
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 0.25,
            cursor: 'grab',
            touchAction: 'none',
            color: 'text.secondary',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            '&:active': {cursor: 'grabbing'},
          }}
        >
          <DragIcon fontSize="small" />
        </Box>
      )}

      {/* Pills — single scrolling row, two capped rows, or unbounded wrap. */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          gap: 1,
          alignContent: 'center',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          ...pillsLayout,
          '&::-webkit-scrollbar': {height: 4, width: 4},
          '&::-webkit-scrollbar-thumb': {bgcolor: theme.palette.divider, borderRadius: 2},
        }}
      >
        {activeMetrics.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{px: 1}}>
            No metrics selected
          </Typography>
        ) : (
          activeMetrics.map((m) => {
            const r = m.read(ctx);
            return <MetricPill key={m.id} icon={m.icon} label={m.label} value={r.value} color={r.color} />;
          })
        )}
      </Box>
    </Box>
  );
}
