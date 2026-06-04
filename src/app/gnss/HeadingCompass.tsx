'use client';

import type {GnssSample} from '@/stores/schemas';
import {Box, Typography, useTheme} from '@mui/material';

interface HeadingCompassProps {
  sample: GnssSample | undefined;
}

// Dual-antenna heading compass. `vh` is the vehicle heading in radians (firmware
// convention: 0 = +x/forward, CCW positive). For a North-up compass we convert
// to degrees clockwise from North. hacc_hdg is the heading standard deviation in
// degrees from the UNIHEADING message (the only NMEA-mode source of σ).
function radToCompassDeg(vh: number): number {
  // Firmware heading is already mapped so that the GNSS true-North heading was
  // transformed by negate+90°; invert that back to a North-clockwise bearing.
  const deg = (90 - (vh * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}

export default function HeadingCompass({sample}: HeadingCompassProps) {
  const theme = useTheme();
  const has = sample !== undefined;
  const acc = sample?.hacc_hdg;
  // Heading is only meaningful with a heading solution; treat 0 accuracy as
  // "not reported" (the firmware leaves it unset without a fix).
  const hasHeading = has && acc !== undefined && acc > 0;
  const bearing = hasHeading ? radToCompassDeg(sample!.vh) : 0;

  const dim = theme.palette.text.disabled;
  const accColor = !hasHeading
    ? dim
    : acc! < 1
      ? theme.palette.success.main
      : acc! < 5
        ? theme.palette.warning.main
        : theme.palette.error.main;

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center', py: 1}}>
      <Box sx={{position: 'relative', width: 120, height: 120, flexShrink: 0}}>
        <svg viewBox="-60 -60 120 120" width="120" height="120">
          <circle cx={0} cy={0} r={56} fill="none" stroke={theme.palette.divider} strokeWidth={2} />
          {/* Cardinal ticks */}
          {[
            {t: 'N', x: 0, y: -46},
            {t: 'E', x: 46, y: 0},
            {t: 'S', x: 0, y: 48},
            {t: 'W', x: -46, y: 0},
          ].map((c) => (
            <text
              key={c.t}
              x={c.x}
              y={c.y}
              fontSize={11}
              fill={theme.palette.text.secondary}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {c.t}
            </text>
          ))}
          {/* Heading needle (rotates from North, clockwise) */}
          {hasHeading && (
            <g transform={`rotate(${bearing})`}>
              <polygon points="0,-50 -7,8 0,2 7,8" fill={accColor} />
            </g>
          )}
          {!hasHeading && <circle cx={0} cy={0} r={4} fill={dim} />}
        </svg>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
          Dual-antenna heading
        </Typography>
        <Typography variant="h4" fontWeight={700}>
          {hasHeading ? `${bearing.toFixed(1)}°` : '—'}
        </Typography>
        <Typography variant="body2" sx={{color: accColor, mt: 0.5}}>
          {hasHeading ? `± ${acc!.toFixed(2)}°` : 'no heading solution'}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 0.5}}>
          From the master→slave antenna baseline.
        </Typography>
      </Box>
    </Box>
  );
}
