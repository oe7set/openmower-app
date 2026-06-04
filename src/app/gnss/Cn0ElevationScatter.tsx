'use client';

import type {GnssSatellite} from '@/stores/schemas';
import {CONSTELLATION_ORDER, constellation, gnssIdColor} from '@/lib/gnss';
import {Box, Typography, useTheme} from '@mui/material';
import {memo, useMemo} from 'react';
import {CartesianGrid, Legend, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis} from 'recharts';

interface Cn0ElevationScatterProps {
  satellites: readonly GnssSatellite[];
}

interface Point {
  el: number;
  cn0: number;
  label: string;
}

// One scatter series per constellation so the legend + colours match the rest
// of the page. Only satellites with a known elevation and a tracked signal are
// plotted (elevation -128 / C/N0 0 = unknown/not tracked).
function buildSeries(sats: readonly GnssSatellite[]): {gnssId: number; points: Point[]}[] {
  const out: {gnssId: number; points: Point[]}[] = [];
  for (const gnssId of CONSTELLATION_ORDER) {
    const points = sats
      .filter((s) => s.g === gnssId && s.e > -90 && s.c > 0)
      .map((s) => ({el: s.e, cn0: s.c, label: `${constellation(s.g).prefix}${s.s}`}));
    if (points.length > 0) out.push({gnssId, points});
  }
  return out;
}

function Cn0ElevationScatter({satellites}: Cn0ElevationScatterProps) {
  const theme = useTheme();
  const series = useMemo(() => buildSeries(satellites), [satellites]);
  const total = series.reduce((n, s) => n + s.points.length, 0);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>
        Signal strength vs elevation — high-elevation satellites should be strongest; low outliers hint at obstruction
        or multipath.
      </Typography>
      <Box sx={{width: '100%', height: 240}}>
        {total === 0 ? (
          <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
            <Typography variant="body2" color="text.disabled">
              Waiting for satellite signals…
            </Typography>
          </Box>
        ) : (
          <ScatterChart margin={{top: 8, right: 12, bottom: 16, left: 0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis
              type="number"
              dataKey="el"
              name="Elevation"
              domain={[0, 90]}
              ticks={[0, 30, 60, 90]}
              tick={{fontSize: 10, fill: theme.palette.text.secondary}}
              stroke={theme.palette.divider}
              label={{
                value: 'Elevation (°)',
                position: 'insideBottom',
                offset: -8,
                fontSize: 11,
                fill: theme.palette.text.secondary,
              }}
            />
            <YAxis
              type="number"
              dataKey="cn0"
              name="C/N0"
              domain={[0, 55]}
              tick={{fontSize: 10, fill: theme.palette.text.secondary}}
              stroke={theme.palette.divider}
              width={40}
              label={{
                value: 'dB-Hz',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
                fill: theme.palette.text.secondary,
              }}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              isAnimationActive={false}
              cursor={{strokeDasharray: '3 3'}}
              contentStyle={{
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
                fontSize: 12,
              }}
              formatter={(value, name) => [`${value}${name === 'C/N0' ? ' dB-Hz' : '°'}`, String(name)]}
            />
            <Legend wrapperStyle={{fontSize: 11}} iconSize={8} />
            {series.map((s) => (
              <Scatter
                key={s.gnssId}
                name={constellation(s.gnssId).short}
                data={s.points}
                fill={gnssIdColor(s.gnssId)}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        )}
      </Box>
    </Box>
  );
}

export default memo(Cn0ElevationScatter);
