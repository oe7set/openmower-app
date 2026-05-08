import type {MowerConfig} from '@/components/types';
import {useMowersStore} from '@/stores/mowersStore';
import {KeyboardArrowDown, SmartToy as MowerIcon} from '@mui/icons-material';
import {Avatar, Box, Typography, useTheme} from '@mui/material';

interface SelectedMowerProps {
  selectedMower: MowerConfig;
  showSwitcher: boolean;
  onMowerMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
}

export default function SelectedMower({selectedMower, showSwitcher, onMowerMenuOpen}: SelectedMowerProps) {
  const theme = useTheme();
  const status = useMowersStore((s) => s.mqttStatuses[selectedMower.id]);

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'reconnecting'
      ? 'Reconnecting…'
      : status === 'connecting'
      ? 'Connecting…'
      : status === 'offline'
      ? 'Offline'
      : 'Disconnected';

  const statusColor =
    status === 'connected'
      ? theme.palette.success.main
      : status === 'reconnecting' || status === 'connecting' || status === 'offline'
      ? theme.palette.warning.main
      : theme.palette.error.main;

  return (
    <Box sx={{p: 3, borderTop: `1px solid ${theme.palette.divider}`}}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{fontWeight: 600, letterSpacing: 0.5, mb: 1, display: 'block'}}
      >
        Active Mower
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: showSwitcher ? 'pointer' : 'default',
          '&:hover': {opacity: showSwitcher ? 0.8 : 1},
        }}
        onClick={showSwitcher ? onMowerMenuOpen : undefined}
      >
        <Avatar sx={{bgcolor: theme.palette.primary.main, width: 40, height: 40}}>
          <MowerIcon fontSize="small" />
        </Avatar>
        <Box sx={{flex: 1, minWidth: 0}}>
          <Typography variant="body2" fontWeight="600" color="text.primary" noWrap>
            {selectedMower.name}
          </Typography>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25}}>
            <Box sx={{width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor}} />
            <Typography variant="caption" color="text.secondary">
              {statusLabel}
            </Typography>
          </Box>
        </Box>
        {showSwitcher && <KeyboardArrowDown sx={{color: theme.palette.primary.main}} />}
      </Box>
    </Box>
  );
}
