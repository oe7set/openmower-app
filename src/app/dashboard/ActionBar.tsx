'use client';

import {useToast} from '@/hooks/useToast';
import {outerCardStyles} from '@/lib/cardStyles';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {
  Home as HomeIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  SkipNext as SkipIcon,
  Stop as StopIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {Box, Button, Card, CardContent, Typography, useTheme} from '@mui/material';
import {ReactNode, useState} from 'react';

// Action IDs come from xbot_monitoring's actions/json topic and are formatted
// "<node_prefix>/<action_id>". The buttons here are mapped to the IDs that
// mower_logic actually registers — see open_mower_ros/src/mower_logic/.
const ACTIONS = {
  start: 'mower_logic/start_mowing',
  pause: 'mower_logic/pause',
  continue: 'mower_logic/continue',
  skip: 'mower_logic/skip_area',
  abort: 'mower_logic/abort_mowing',
  resetEmergency: 'mower_logic/reset_emergency',
  setEmergency: 'mower_logic/set_emergency',
} as const;

type ButtonSpec = {
  id: string;
  label: string;
  icon: ReactNode;
  color: 'primary' | 'warning' | 'info' | 'secondary' | 'error';
  variant: 'contained' | 'outlined';
};

export default function ActionBar() {
  const theme = useTheme();
  const toast = useToast();
  const selected = useSelectedMower((s) => s);
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const [pending, setPending] = useState<string | null>(null);

  const send = async (label: string, actionId: string) => {
    const mower = useMowersStore.getState().mowers[useMowersStore.getState().selected];
    if (!mower) {
      toast.error('No mower selected');
      return;
    }
    setPending(actionId);
    try {
      mower.publishAction(actionId);
      toast.success(`${label} sent`);
    } catch (e) {
      toast.error(`${label} failed: ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  };

  const buttons: ButtonSpec[] = emergency
    ? [
        {id: ACTIONS.resetEmergency, label: 'Reset emergency', icon: <WarningIcon />, color: 'error', variant: 'contained'},
      ]
    : [
        {id: ACTIONS.start, label: 'Start', icon: <PlayIcon />, color: 'primary', variant: 'contained'},
        {id: ACTIONS.continue, label: 'Continue', icon: <PlayIcon />, color: 'primary', variant: 'outlined'},
        {id: ACTIONS.pause, label: 'Pause', icon: <PauseIcon />, color: 'warning', variant: 'outlined'},
        {id: ACTIONS.skip, label: 'Skip area', icon: <SkipIcon />, color: 'info', variant: 'outlined'},
        {id: ACTIONS.abort, label: 'Return home', icon: <HomeIcon />, color: 'secondary', variant: 'outlined'},
        {id: ACTIONS.setEmergency, label: 'Emergency', icon: <StopIcon />, color: 'error', variant: 'outlined'},
      ];

  // Gate buttons on availableActions: an action is enabled when the backend
  // includes it in actions/json with enabled=true. Buttons for actions that
  // never appear stay rendered (so the layout doesn't reflow) but disabled.
  const isEnabled = (id: string) => selected?.isActionEnabled(id) ?? false;

  return (
    <Card sx={{...outerCardStyles(theme)}}>
      <CardContent>
        <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
          Quick actions
        </Typography>
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5}}>
          {buttons.map(({id, label, icon, color, variant}) => (
            <Button
              key={id}
              variant={variant}
              color={color}
              startIcon={icon}
              disabled={pending !== null || !isEnabled(id)}
              onClick={() => send(label, id)}
              sx={{flex: {xs: '1 1 140px', md: '0 1 auto'}, minWidth: {xs: 0, md: 140}}}
            >
              {pending === id ? '…' : label}
            </Button>
          ))}
        </Box>
        {selected && selected.actions.length === 0 && (
          // The connection banner up top covers the "why" already — keep this
          // tight. If actions never arrive but other topics do, the user knows
          // it's a mower_logic-side issue, not a connection one.
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1.5}}>
            No actions available yet — see banner above for connection details.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
