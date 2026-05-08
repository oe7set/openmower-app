import {type MowerConfig} from '@/components/types';
import {useMowersStore} from '@/stores/mowersStore';
import {Check as CheckIcon} from '@mui/icons-material';
import {Box, MenuItem, Typography, useTheme} from '@mui/material';

interface MowerSelectorItemProps {
  mower: MowerConfig;
  selected: boolean;
  onClick: () => void;
}

export default function MowerSelectorItem({mower, selected, onClick}: MowerSelectorItemProps) {
  const theme = useTheme();
  const status = useMowersStore((s) => s.mqttStatuses[mower.id]);

  const statusColor =
    status === 'connected'
      ? theme.palette.success.main
      : status === 'reconnecting' || status === 'offline'
      ? theme.palette.warning.main
      : theme.palette.error.main;

  return (
    <MenuItem
      onClick={onClick}
      selected={selected}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
      }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: statusColor,
          flexShrink: 0,
        }}
      />
      <Box sx={{flex: 1, minWidth: 0}}>
        <Typography variant="body2" fontWeight="500" noWrap>
          {mower.name}
        </Typography>
        {mower.description && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {mower.description}
          </Typography>
        )}
      </Box>
      {selected && <CheckIcon fontSize="small" color="primary" />}
    </MenuItem>
  );
}
