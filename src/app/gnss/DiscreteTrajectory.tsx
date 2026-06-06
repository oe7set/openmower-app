'use client';

import {clearGnssPositionHistory, getGnssPositionHistory, type GnssPosPoint} from '@/stores/gnssStore';
import {Add, CenterFocusStrong, DeleteOutline, Remove} from '@mui/icons-material';
import {Box, IconButton, MenuItem, Select, Tooltip, Typography, useTheme} from '@mui/material';
import {useCallback, useEffect, useMemo, useState} from 'react';

interface DiscreteTrajectoryProps {
  mowerId: string | undefined;
}

// Poll cadence for the position ring. The ring itself is filled at ~2 Hz in the
// store; 500 ms keeps the plot live without re-rendering on every sample.
const REFRESH_MS = 500;

// Full-scale radius presets, in metres (the outer ring). +/- step through these:
// smaller = zoomed in (finer resolution), larger = zoomed out. Default 0.5 m is
// a good window for watching stationary RTK jitter.
const RANGE_PRESETS_M = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20];
const DEFAULT_RANGE_INDEX = 2; // 0.5 m

// Time-window options (minutes) for how far back points are shown.
const WINDOW_OPTIONS_MIN = [1, 5, 15, 60];

// Cap on rendered SVG points so a full hour of fixes (~7200) doesn't bloat the
// DOM — striding keeps the shape while always preserving the latest point.
const MAX_RENDER_POINTS = 2000;

// Metres per degree latitude. Longitude is scaled by cos(lat) at the centre.
const M_PER_DEG_LAT = 111320;

// SVG viewBox half-extent: radius 1 = full-scale range, with padding for labels.
const VB = 1.12;

type CenterMode = 'first' | 'last';

interface ProjectedPoint {
  nx: number; // normalised east (radius 1 = rangeM)
  ny: number; // normalised, SVG y-down (north is up)
}

interface Projection {
  points: ProjectedPoint[];
  last: ProjectedPoint | null;
  count: number; // points inside the time window (before render striding)
  maxDevM: number; // largest deviation from centre, metres
}

// Format a metre distance compactly: sub-metre as cm, else metres.
function formatDistance(m: number): string {
  if (m < 1) return `${(m * 100).toFixed(0)} cm`;
  return `${m.toFixed(m < 10 ? 1 : 0)} m`;
}

// Project the windowed lat/lon history into normalised plot coordinates relative
// to the chosen centre, using a local equirectangular metre approximation (the
// span is at most tens of metres, so this is well within plotting accuracy).
// Points outside the view are dropped so the rendered DOM stays bounded.
function project(
  history: readonly GnssPosPoint[],
  windowMin: number,
  rangeM: number,
  centerMode: CenterMode,
): Projection {
  if (history.length === 0) return {points: [], last: null, count: 0, maxDevM: 0};

  const latestTs = history[history.length - 1].ts;
  const cutoff = latestTs - windowMin * 60_000;
  let start = 0;
  while (start < history.length && history[start].ts < cutoff) start++;
  const windowed = history.slice(start);
  if (windowed.length === 0) return {points: [], last: null, count: 0, maxDevM: 0};

  const center = centerMode === 'first' ? windowed[0] : windowed[windowed.length - 1];
  const cosLat = Math.cos((center.lat * Math.PI) / 180);

  const stride = Math.max(1, Math.ceil(windowed.length / MAX_RENDER_POINTS));
  const points: ProjectedPoint[] = [];
  let maxDevM = 0;
  for (let i = 0; i < windowed.length; i += stride) {
    const p = windowed[i];
    const dx = (p.lon - center.lon) * M_PER_DEG_LAT * cosLat;
    const dy = (p.lat - center.lat) * M_PER_DEG_LAT;
    const dev = Math.hypot(dx, dy);
    if (dev > maxDevM) maxDevM = dev;
    const nx = dx / rangeM;
    const ny = -dy / rangeM;
    if (Math.abs(nx) <= VB && Math.abs(ny) <= VB) points.push({nx, ny});
  }

  // Always include the latest fix as the highlighted point, even if striding or
  // the window edge skipped it.
  const lastRaw = windowed[windowed.length - 1];
  const dxL = (lastRaw.lon - center.lon) * M_PER_DEG_LAT * cosLat;
  const dyL = (lastRaw.lat - center.lat) * M_PER_DEG_LAT;
  const last: ProjectedPoint = {nx: dxL / rangeM, ny: -dyL / rangeM};

  return {points, last, count: windowed.length, maxDevM};
}

function useThrottledPosHistory(mowerId: string | undefined): readonly GnssPosPoint[] {
  const [history, setHistory] = useState<readonly GnssPosPoint[]>(() => getGnssPositionHistory(mowerId));
  useEffect(() => {
    const tick = () => setHistory(getGnssPositionHistory(mowerId));
    const lead = setTimeout(tick, 0);
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      clearTimeout(lead);
      clearInterval(id);
    };
  }, [mowerId]);
  return history;
}

export default function DiscreteTrajectory({mowerId}: DiscreteTrajectoryProps) {
  const theme = useTheme();
  const [rangeIndex, setRangeIndex] = useState(DEFAULT_RANGE_INDEX);
  const [windowMin, setWindowMin] = useState(WINDOW_OPTIONS_MIN[0]);
  const [centerMode, setCenterMode] = useState<CenterMode>('first');
  const history = useThrottledPosHistory(mowerId);

  const rangeM = RANGE_PRESETS_M[rangeIndex];
  const {points, last, count, maxDevM} = useMemo(
    () => project(history, windowMin, rangeM, centerMode),
    [history, windowMin, rangeM, centerMode],
  );

  const zoomIn = useCallback(() => setRangeIndex((i) => Math.max(0, i - 1)), []);
  const zoomOut = useCallback(() => setRangeIndex((i) => Math.min(RANGE_PRESETS_M.length - 1, i + 1)), []);
  const toggleCenter = useCallback(() => setCenterMode((m) => (m === 'first' ? 'last' : 'first')), []);
  const clear = useCallback(() => clearGnssPositionHistory(mowerId), [mowerId]);

  const grid = theme.palette.divider;
  const label = theme.palette.text.secondary;
  const ringColor = theme.palette.info.main;

  // Ring / grid fractions of the full-scale radius.
  const fractions = [0.25, 0.5, 0.75, 1];

  // Scale bar represents half the full-scale radius, placed bottom-right.
  const scaleM = rangeM / 2;
  const scaleLen = 0.5; // normalised length (= half radius)
  const scaleX2 = VB - 0.05;
  const scaleX1 = scaleX2 - scaleLen;
  const scaleY = VB - 0.06;

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap'}}>
        <Tooltip title="Zoom in (finer range)">
          <span>
            <IconButton size="small" onClick={zoomIn} disabled={rangeIndex === 0}>
              <Add fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Zoom out (wider range)">
          <span>
            <IconButton size="small" onClick={zoomOut} disabled={rangeIndex === RANGE_PRESETS_M.length - 1}>
              <Remove fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={`Center on ${centerMode === 'first' ? 'last' : 'first'} point`}>
          <IconButton size="small" onClick={toggleCenter} color={centerMode === 'last' ? 'primary' : 'default'}>
            <CenterFocusStrong fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear all points">
          <IconButton size="small" onClick={clear}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{flex: 1}} />
        <Select
          size="small"
          value={windowMin}
          onChange={(e) => setWindowMin(Number(e.target.value))}
          sx={{minWidth: 96}}
        >
          {WINDOW_OPTIONS_MIN.map((m) => (
            <MenuItem key={m} value={m}>
              {m < 60 ? `${m} min` : '1 h'}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Plot */}
      <Box sx={{position: 'relative', width: '100%', maxWidth: 460, mx: 'auto'}}>
        <Box sx={{position: 'relative', width: '100%', aspectRatio: '1 / 1'}}>
          <svg viewBox={`${-VB} ${-VB} ${2 * VB} ${2 * VB}`} width="100%" height="100%" style={{display: 'block'}}>
            {/* Square grid (graph-paper feel) */}
            {fractions.map((f) => (
              <g key={`grid-${f}`}>
                {[f, -f].map((s) => (
                  <g key={s}>
                    <line x1={s} y1={-1} x2={s} y2={1} stroke={grid} strokeWidth={0.003} opacity={0.5} />
                    <line x1={-1} y1={s} x2={1} y2={s} stroke={grid} strokeWidth={0.003} opacity={0.5} />
                  </g>
                ))}
              </g>
            ))}

            {/* Concentric range rings (dashed) */}
            {fractions.map((f) => (
              <circle
                key={`ring-${f}`}
                cx={0}
                cy={0}
                r={f}
                fill="none"
                stroke={ringColor}
                strokeWidth={0.004}
                strokeDasharray="0.02 0.02"
                opacity={0.55}
              />
            ))}

            {/* Center cross */}
            <line x1={-1} y1={0} x2={1} y2={0} stroke={grid} strokeWidth={0.005} />
            <line x1={0} y1={-1} x2={0} y2={1} stroke={grid} strokeWidth={0.005} />

            {/* Points: blue cloud, latest highlighted red */}
            {points.map((p, i) => (
              <circle key={i} cx={p.nx} cy={p.ny} r={0.018} fill="#2563eb" opacity={0.7} />
            ))}
            {last && Math.abs(last.nx) <= VB && Math.abs(last.ny) <= VB && (
              <circle cx={last.nx} cy={last.ny} r={0.035} fill="#e53935" stroke="#fff" strokeWidth={0.006} />
            )}

            {/* Scale bar */}
            <g stroke={label} strokeWidth={0.006}>
              <line x1={scaleX1} y1={scaleY} x2={scaleX2} y2={scaleY} />
              <line x1={scaleX1} y1={scaleY - 0.025} x2={scaleX1} y2={scaleY + 0.025} />
              <line x1={scaleX2} y1={scaleY - 0.025} x2={scaleX2} y2={scaleY + 0.025} />
            </g>
            <text
              x={(scaleX1 + scaleX2) / 2}
              y={scaleY - 0.04}
              fontSize={0.07}
              fill={label}
              textAnchor="middle"
              style={{userSelect: 'none'}}
            >
              {formatDistance(scaleM)}
            </text>
          </svg>

          {count === 0 && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body2" color="text.disabled">
                Waiting for position data…
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Readout */}
      <Box sx={{display: 'flex', justifyContent: 'space-between', mt: 1}}>
        <Typography variant="caption" color="text.secondary">
          {count} pts · centered on {centerMode} · range ±{formatDistance(rangeM)}
        </Typography>
        {count > 0 && (
          <Typography variant="caption" color="text.secondary">
            spread ±{formatDistance(maxDevM)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
