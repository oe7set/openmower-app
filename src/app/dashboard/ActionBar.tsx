'use client';

import {useToast} from '@/hooks/useToast';
import {outerCardStyles} from '@/lib/cardStyles';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {
  Home as HomeIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  SkipNext as SkipIcon,
  Stop as StopIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import {ReactNode, useState} from 'react';

const ACTIONS = {
  start: MOWER_ACTIONS.startMowing,
  pause: MOWER_ACTIONS.pause,
  continue: MOWER_ACTIONS.continueMowing,
  skip: MOWER_ACTIONS.skipArea,
  abort: MOWER_ACTIONS.abortMowing,
  resetEmergency: MOWER_ACTIONS.resetEmergency,
  setEmergency: MOWER_ACTIONS.setEmergency,
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
  const [resetOpen, setResetOpen] = useState(false);

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
              onClick={() => (id === ACTIONS.resetEmergency ? setResetOpen(true) : send(label, id))}
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
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reset emergency stop?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The mower will be allowed to resume operation. Make sure the area is safe and the cause of the emergency
            has been cleared.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              setResetOpen(false);
              await send('Reset emergency', ACTIONS.resetEmergency);
            }}
            disabled={pending !== null}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
