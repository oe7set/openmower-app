'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {GpsFixed, GpsOff, GpsNotFixed} from '@mui/icons-material';
import {Box, Card, CardContent, LinearProgress, Typography, useTheme} from '@mui/material';

function gpsColor(pct: number) {
  if (pct >= 75) return 'success' as const;
  if (pct >= 25) return 'warning' as const;
  return 'error' as const;
}

export default function GpsCard() {
  const theme = useTheme();
  const gps = useSelectedMower((s) => s?.state.gps_percentage ?? 0);
  const posAccuracy = useSelectedMower((s) => s?.state.pose.pos_accuracy ?? 0);
  const headingAccuracy = useSelectedMower((s) => s?.state.pose.heading_accuracy ?? 0);
  const headingValid = useSelectedMower((s) => s?.state.pose.heading_valid ?? false);

  const color = gpsColor(gps);
  const Icon = gps >= 75 ? GpsFixed : gps >= 25 ? GpsNotFixed : GpsOff;

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 280px', minWidth: 0}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
          <Icon color={color} sx={{fontSize: 28}} />
          <Typography variant="h6" fontWeight="600">
            GPS
          </Typography>
        </Box>

        <Typography variant="h3" fontWeight="bold" color={`${color}.main`} sx={{mb: 1}}>
          {gps}%
        </Typography>

        <LinearProgress
          variant="determinate"
          value={gps}
          color={color}
          sx={{height: 10, borderRadius: 5, mb: 2, '& .MuiLinearProgress-bar': {borderRadius: 5}}}
        />

        <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Position accuracy
            </Typography>
            <Typography variant="body2" fontWeight="600">
              {posAccuracy.toFixed(2)} m
            </Typography>
          </Box>
          <Box sx={{textAlign: 'right'}}>
            <Typography variant="caption" color="text.secondary">
              Heading accuracy
            </Typography>
            <Typography
              variant="body2"
              fontWeight="600"
              color={headingValid ? 'text.primary' : 'text.secondary'}
            >
              {headingValid ? `${headingAccuracy.toFixed(1)}°` : 'invalid'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
