'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {BatteryChargingFull, BatteryFull, BatteryAlert, Bolt} from '@mui/icons-material';
import {Box, Card, CardContent, Chip, LinearProgress, Typography, useTheme} from '@mui/material';

function batteryColor(pct: number, isCharging: boolean) {
  if (isCharging) return 'info' as const;
  if (pct > 50) return 'success' as const;
  if (pct > 20) return 'warning' as const;
  return 'error' as const;
}

export default function BatteryCard() {
  const theme = useTheme();
  const battery = useSelectedMower((s) => s?.state.battery_percentage ?? 0);
  const isCharging = useSelectedMower((s) => s?.state.is_charging ?? false);

  const color = batteryColor(battery, isCharging);
  const Icon = isCharging ? BatteryChargingFull : battery <= 20 ? BatteryAlert : BatteryFull;

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 280px', minWidth: 0}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2}}>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
            <Icon color={color} sx={{fontSize: 28}} />
            <Typography variant="h6" fontWeight="600">
              Battery
            </Typography>
          </Box>
          {isCharging && <Chip size="small" color="info" icon={<Bolt fontSize="small" />} label="Charging" />}
        </Box>

        <Typography variant="h3" fontWeight="bold" color={`${color}.main`} sx={{mb: 1}}>
          {battery}%
        </Typography>

        <LinearProgress
          variant="determinate"
          value={battery}
          color={color}
          sx={{height: 10, borderRadius: 5, '& .MuiLinearProgress-bar': {borderRadius: 5}}}
        />
      </CardContent>
    </Card>
  );
}
