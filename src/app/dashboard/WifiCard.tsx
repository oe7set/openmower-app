'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {Wifi as WifiIcon, WifiOff as WifiOffIcon} from '@mui/icons-material';
import {Box, Card, CardContent, LinearProgress, Typography, useTheme} from '@mui/material';

// Maps a WLAN signal in dBm to a 0..100 quality. -50dBm = great, -90dBm = bad.
// dbm === 0 is the firmware's "N/A" sentinel (Ethernet-only host or the
// /proc/net/wireless entry was missing) — callers must filter that out before
// invoking this function, otherwise 0 dBm would naively map to 100 %.
function dbmToQuality(dbm: number): number {
  if (dbm >= -50) return 100;
  if (dbm <= -90) return 0;
  return Math.round(((dbm + 90) / 40) * 100);
}

function qualityColor(q: number) {
  if (q >= 75) return 'success' as const;
  if (q >= 40) return 'warning' as const;
  return 'error' as const;
}

export default function WifiCard() {
  const theme = useTheme();
  const dbm = useSelectedMower((s) => s?.state.wifi_signal_dbm);
  const link = useSelectedMower((s) => s?.state.wifi_link_quality);

  // Older backends don't publish wifi_* yet — render nothing so we don't
  // claim "WLAN unbekannt" prematurely. When the field arrives the card
  // pops in.
  if (dbm === undefined && link === undefined) return null;

  // Firmware uses `wifi_signal_dbm === 0` plus `wifi_link_quality === 0` to
  // signal "no WLAN interface" (e.g. Ethernet-only mowers, or
  // /proc/net/wireless missing). Treat that as N/A and hide the card —
  // otherwise dbmToQuality(0) maps to 100 % and the dashboard claims a perfect
  // signal where there is none.
  const dbmNa = dbm === undefined || dbm === 0;
  const linkNa = link === undefined || link === 0;
  if (dbmNa && linkNa) return null;

  const quality = !linkNa
    ? Math.round((link as number) * 100)
    : !dbmNa
      ? dbmToQuality(dbm as number)
      : 0;
  const color = qualityColor(quality);
  const Icon = quality > 0 ? WifiIcon : WifiOffIcon;

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 280px', minWidth: 0}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
          <Icon color={color} sx={{fontSize: 28}} />
          <Typography variant="h6" fontWeight="600">
            WLAN
          </Typography>
        </Box>

        <Typography variant="h3" fontWeight="bold" color={`${color}.main`} sx={{mb: 1}}>
          {quality}%
        </Typography>

        <LinearProgress
          variant="determinate"
          value={quality}
          color={color}
          sx={{height: 10, borderRadius: 5, mb: 2, '& .MuiLinearProgress-bar': {borderRadius: 5}}}
        />

        {(!dbmNa || !linkNa) && (
          <Box sx={{display: 'flex', justifyContent: 'space-between', gap: 2}}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Signal
              </Typography>
              <Typography variant="body2" fontWeight="600">
                {!dbmNa ? `${dbm} dBm` : '—'}
              </Typography>
            </Box>
            <Box sx={{textAlign: 'right'}}>
              <Typography variant="caption" color="text.secondary">
                Link quality
              </Typography>
              <Typography variant="body2" fontWeight="600">
                {!linkNa ? `${((link as number) * 100).toFixed(0)}%` : '—'}
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
