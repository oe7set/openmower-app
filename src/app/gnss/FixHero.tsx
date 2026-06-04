'use client';

import type {GnssSample} from '@/stores/schemas';
import {fixTypeShort} from '@/lib/gps';
import {GpsFixed, GpsNotFixed, GpsOff, SatelliteAlt} from '@mui/icons-material';
import {Box, Chip, Typography, useTheme} from '@mui/material';

interface FixHeroProps {
  sample: GnssSample | undefined;
}

function fixColor(fixType: number): 'success' | 'warning' | 'error' {
  if (fixType >= 5) return 'success';
  if (fixType >= 2) return 'warning';
  return 'error';
}

function Stat({label, value, unit}: {label: string; value: string; unit?: string}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700}>
        {value}
        {unit && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ml: 0.5}}>
            {unit}
          </Typography>
        )}
      </Typography>
    </Box>
  );
}

export default function FixHero({sample}: FixHeroProps) {
  const theme = useTheme();
  const fixType = sample?.ft ?? 0;
  const color = fixColor(fixType);
  const Icon = fixType >= 5 ? GpsFixed : fixType >= 2 ? GpsNotFixed : GpsOff;
  const has = sample !== undefined;

  return (
    <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: {xs: 2, md: 4}}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
        <Icon color={color} sx={{fontSize: 36}} />
        <Box>
          <Chip
            label={fixTypeShort(has ? fixType : undefined)}
            color={color}
            size="small"
            icon={<SatelliteAlt sx={{fontSize: 16}} />}
            sx={{fontWeight: 700}}
          />
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
            GNSS fix status
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: {xs: 2, md: 4},
          flexWrap: 'wrap',
          borderLeft: {md: `1px solid ${theme.palette.divider}`},
          pl: {md: 4},
        }}
      >
        <Stat label="Satellites used" value={has ? `${sample!.used}` : '—'} />
        <Stat label="Satellites visible" value={has ? `${sample!.vis}` : '—'} />
        <Stat label="Horizontal acc." value={has ? sample!.hacc.toFixed(2) : '—'} unit="m" />
        <Stat label="Vertical acc." value={has ? sample!.vacc.toFixed(2) : '—'} unit="m" />
      </Box>
    </Box>
  );
}
