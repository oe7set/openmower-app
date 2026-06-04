'use client';

import type {GnssSample} from '@/stores/schemas';
import {dopColor} from '@/lib/gnss';
import {Box, LinearProgress, Typography, useTheme} from '@mui/material';

interface DopPanelProps {
  dop: GnssSample['dop'];
}

const ITEMS: {key: keyof GnssSample['dop']; label: string; help: string}[] = [
  {key: 'p', label: 'PDOP', help: 'Position'},
  {key: 'h', label: 'HDOP', help: 'Horizontal'},
  {key: 'v', label: 'VDOP', help: 'Vertical'},
  {key: 'g', label: 'GDOP', help: 'Geometric'},
  {key: 't', label: 'TDOP', help: 'Time'},
];

// DOP axis: clamp to 10 for the bar; lower is better.
const MAX_DOP = 10;

const PALETTE = {success: '#2e7d32', warning: '#f9a825', error: '#e53935', default: '#9e9e9e'} as const;

export default function DopPanel({dop}: DopPanelProps) {
  const theme = useTheme();

  return (
    <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr auto', columnGap: 1.5, rowGap: 1, alignItems: 'center'}}>
      {ITEMS.map((item) => {
        const value = dop[item.key] ?? 0;
        const reported = value > 0;
        const color = PALETTE[dopColor(value)];
        const pct = reported ? Math.min(value, MAX_DOP) / MAX_DOP : 0;
        return (
          <Box key={item.key} sx={{display: 'contents'}}>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {item.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.help}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.palette.action.hover,
                '& .MuiLinearProgress-bar': {backgroundColor: color, borderRadius: 4},
              }}
            />
            <Typography variant="body2" fontFamily="monospace" sx={{minWidth: 40, textAlign: 'right'}}>
              {reported ? value.toFixed(2) : '—'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
