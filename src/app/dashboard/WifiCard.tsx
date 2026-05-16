'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {qualityColor, resolveWifiQuality} from '@/lib/wifi';
import {useSelectedMower} from '@/stores/mowersStore';
import {Wifi as WifiIcon, WifiOff as WifiOffIcon} from '@mui/icons-material';
import {Box, Card, CardContent, LinearProgress, Typography, useTheme} from '@mui/material';

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
  // /proc/net/wireless missing). resolveWifiQuality returns null in that case
  // so we hide the card — dbmToQuality(0) would otherwise map to 100 %.
  const resolved = resolveWifiQuality(dbm, link);
  if (!resolved) return null;

  const {quality, signalDbm, linkRatio} = resolved;
  const dbmNa = signalDbm === null;
  const linkNa = linkRatio === null;
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
                {!dbmNa ? `${signalDbm} dBm` : '—'}
              </Typography>
            </Box>
            <Box sx={{textAlign: 'right'}}>
              <Typography variant="caption" color="text.secondary">
                Link quality
              </Typography>
              <Typography variant="body2" fontWeight="600">
                {!linkNa ? `${((linkRatio as number) * 100).toFixed(0)}%` : '—'}
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
