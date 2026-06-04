'use client';

import type {GnssSatellite} from '@/stores/schemas';
import {constellation, gnssIdColor, svLabel} from '@/lib/gnss';
import {Box, Typography, useTheme} from '@mui/material';
import {memo, useMemo} from 'react';

interface SkyplotProps {
  satellites: readonly GnssSatellite[];
}

// A satellite resolved to a single sky position (deduped across bands).
interface SkySat {
  gnssId: number;
  svId: number;
  elevation: number;
  azimuth: number;
  cn0: number;
  used: boolean;
  healthy: boolean;
}

// Collapse the per-signal rows to one entry per (gnss, sv) for plotting, taking
// the strongest band's C/N0 and OR-ing the used/healthy flags.
function dedupeForSky(sats: readonly GnssSatellite[]): SkySat[] {
  const byKey = new Map<string, SkySat>();
  for (const s of sats) {
    // Skip satellites with no known sky position — they can't be plotted.
    if (s.e <= -90 || s.a < 0) continue;
    const key = `${s.g}-${s.s}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.cn0 = Math.max(existing.cn0, s.c);
      existing.used = existing.used || s.u;
      existing.healthy = existing.healthy || s.hl;
    } else {
      byKey.set(key, {
        gnssId: s.g,
        svId: s.s,
        elevation: s.e,
        azimuth: s.a,
        cn0: s.c,
        used: s.u,
        healthy: s.hl,
      });
    }
  }
  return [...byKey.values()];
}

// Project (azimuth°, elevation°) onto a unit circle. Elevation 90° = centre,
// 0° = outer ring. Azimuth 0° = North (up), increasing clockwise.
function project(azimuth: number, elevation: number): {x: number; y: number} {
  const r = (90 - elevation) / 90; // 0 at zenith, 1 at horizon
  const a = (azimuth * Math.PI) / 180;
  return {x: r * Math.sin(a), y: -r * Math.cos(a)};
}

function Skyplot({satellites}: SkyplotProps) {
  const theme = useTheme();
  const sats = useMemo(() => dedupeForSky(satellites), [satellites]);

  // Use a fixed viewBox (-1.15 .. 1.15) and let SVG scale to the container so
  // the plot is crisp at any size and stays square on desktop and mobile.
  const VB = 1.15;
  const grid = theme.palette.divider;
  const label = theme.palette.text.secondary;

  const rings = [0, 30, 60]; // elevation circles (90 = centre point)

  return (
    <Box sx={{width: '100%', maxWidth: 460, mx: 'auto'}}>
      <Box sx={{position: 'relative', width: '100%', aspectRatio: '1 / 1'}}>
        <svg
          viewBox={`${-VB} ${-VB} ${2 * VB} ${2 * VB}`}
          width="100%"
          height="100%"
          style={{display: 'block'}}
        >
          {/* Elevation rings */}
          {rings.map((el) => {
            const r = (90 - el) / 90;
            return (
              <g key={el}>
                <circle cx={0} cy={0} r={r} fill="none" stroke={grid} strokeWidth={0.004} />
                <text
                  x={0.012}
                  y={-r + 0.06}
                  fontSize={0.06}
                  fill={label}
                  style={{userSelect: 'none'}}
                >
                  {el}°
                </text>
              </g>
            );
          })}
          {/* Cardinal cross */}
          <line x1={-1} y1={0} x2={1} y2={0} stroke={grid} strokeWidth={0.004} />
          <line x1={0} y1={-1} x2={0} y2={1} stroke={grid} strokeWidth={0.004} />
          {[
            {t: 'N', x: 0, y: -1.07},
            {t: 'E', x: 1.05, y: 0.02},
            {t: 'S', x: 0, y: 1.1},
            {t: 'W', x: -1.08, y: 0.02},
          ].map((c) => (
            <text
              key={c.t}
              x={c.x}
              y={c.y}
              fontSize={0.08}
              fill={label}
              textAnchor="middle"
              fontWeight={600}
              style={{userSelect: 'none'}}
            >
              {c.t}
            </text>
          ))}

          {/* Satellites */}
          {sats.map((s) => {
            const {x, y} = project(s.azimuth, s.elevation);
            const color = gnssIdColor(s.gnssId);
            const dim = !s.healthy;
            return (
              <g key={`${s.gnssId}-${s.svId}`} opacity={dim ? 0.4 : 1}>
                {/* Used-in-fix halo */}
                {s.used && (
                  <circle cx={x} cy={y} r={0.085} fill="none" stroke={color} strokeWidth={0.012} />
                )}
                <circle cx={x} cy={y} r={0.055} fill={color} />
                <text
                  x={x}
                  y={y + 0.022}
                  fontSize={0.05}
                  fill="#fff"
                  textAnchor="middle"
                  style={{userSelect: 'none', pointerEvents: 'none'}}
                >
                  {s.svId}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Legend */}
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center', mt: 1}}>
        {[...new Set(sats.map((s) => s.gnssId))].map((g) => (
          <Box key={g} sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
            <Box sx={{width: 10, height: 10, borderRadius: '50%', bgcolor: gnssIdColor(g)}} />
            <Typography variant="caption" color="text.secondary">
              {constellation(g).short}
            </Typography>
          </Box>
        ))}
        {sats.length > 0 && (
          <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
            <Box sx={{width: 10, height: 10, borderRadius: '50%', border: `2px solid ${label}`}} />
            <Typography variant="caption" color="text.secondary">
              used in fix
            </Typography>
          </Box>
        )}
      </Box>

      {sats.length === 0 && (
        <Typography variant="body2" color="text.disabled" textAlign="center" sx={{mt: 1}}>
          No satellites with sky position yet
        </Typography>
      )}
    </Box>
  );
}

export default memo(Skyplot);
export {svLabel};
