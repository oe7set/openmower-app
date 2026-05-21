'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {fmtAccuracy} from '@/lib/format';
import {useSelectedMower} from '@/stores/mowersStore';
import {GpsFixed, GpsOff, GpsNotFixed} from '@mui/icons-material';
import {Box, Card, CardContent, Chip, LinearProgress, Typography, useTheme} from '@mui/material';

function gpsColor(pct: number) {
  if (pct >= 75) return 'success' as const;
  if (pct >= 25) return 'warning' as const;
  return 'error' as const;
}

// Maps the numeric gps_fix_type from the backend (xbot_monitoring R9a) onto
// human-readable labels and a severity colour. Returns null when the field
// isn't published — the card silently hides the chip on older backends.
function fixTypeLabel(t: number | undefined): {label: string; color: 'success' | 'warning' | 'error' | 'default'} | null {
  if (t === undefined) return null;
  switch (t) {
    case 5: return {label: 'RTK Fixed', color: 'success'};
    case 4: return {label: 'RTK Float', color: 'warning'};
    case 3: return {label: 'DGPS', color: 'warning'};
    case 2: return {label: '3D Fix', color: 'warning'};
    case 1: return {label: '2D Fix', color: 'error'};
    case 0:
    default: return {label: 'No Fix', color: 'error'};
  }
}

export default function GpsCard() {
  const theme = useTheme();
  const gps = useSelectedMower((s) => s?.state.gps_percentage ?? 0);
  const posAccuracy = useSelectedMower((s) => s?.state.pose.pos_accuracy);
  const headingAccuracy = useSelectedMower((s) => s?.state.pose.heading_accuracy ?? 0);
  const headingValid = useSelectedMower((s) => s?.state.pose.heading_valid ?? false);
  const fixType = useSelectedMower((s) => s?.state.gps_fix_type);
  const sats = useSelectedMower((s) => s?.state.gps_satellite_count);
  const pdopRaw = useSelectedMower((s) => s?.state.gps_pdop);
  // PDOP of exactly 0 is the backend's "not reported" sentinel.
  const pdop = pdopRaw && pdopRaw > 0 ? pdopRaw : undefined;

  const color = gpsColor(gps);
  const Icon = gps >= 75 ? GpsFixed : gps >= 25 ? GpsNotFixed : GpsOff;
  const fix = fixTypeLabel(fixType);

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 280px', minWidth: 0}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
          <Icon color={color} sx={{fontSize: 28}} />
          <Typography variant="h6" fontWeight="600">
            GPS
          </Typography>
          {fix && (
            <Chip
              label={fix.label}
              color={fix.color === 'default' ? undefined : fix.color}
              size="small"
              sx={{ml: 'auto', fontWeight: 600}}
            />
          )}
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

        <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2, mb: (sats !== undefined || pdop !== undefined) ? 1.5 : 0}}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Position accuracy
            </Typography>
            <Typography variant="body2" fontWeight="600">
              {fmtAccuracy(posAccuracy)}
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

        {(sats !== undefined || pdop !== undefined) && (
          <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}`}}>
            {sats !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Satellites
                </Typography>
                <Typography variant="body2" fontWeight="600">
                  {sats}
                </Typography>
              </Box>
            )}
            {pdop !== undefined && (
              <Box sx={{textAlign: 'right'}}>
                <Typography variant="caption" color="text.secondary">
                  PDOP
                </Typography>
                <Typography variant="body2" fontWeight="600">
                  {pdop.toFixed(2)}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
