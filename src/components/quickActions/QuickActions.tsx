'use client';

import {useToast} from '@/hooks/useToast';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {Mower, useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {
  ExitToApp as AbortDockIcon,
  Login as AbortUndockIcon,
  Logout as ExitRecordIcon,
  Home as HomeIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  RadioButtonChecked as RecordIcon,
  SkipNext as SkipIcon,
  Stop as StopIcon,
  StopCircle as StopCircleIcon,
  Tune as TuneIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import StartMowingDialog from '@/app/tasks/StartMowingDialog';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {ReactNode, useState} from 'react';

// Synthetic id used by the global "Return home" RPC button. It is not a real
// MQTT action id, so it bypasses the actions/json gating and is always shown
// outside of the emergency state.
const RPC_RETURN_HOME = '__rpc__/mower.return_home';
// Synthetic id for the "Mow with params" button, which opens the parametrized
// start dialog instead of sending an action directly.
const START_WITH_PARAMS = '__dialog__/start_mowing';

type ButtonSpec = {
  id: string;
  label: string;
  icon: ReactNode;
  color: 'primary' | 'warning' | 'info' | 'secondary' | 'error';
  variant: 'contained' | 'outlined';
  // When true, the button is gated on the backend's actions/json list. When
  // false, it is always enabled (used for RPC-backed actions like Return home).
  gated?: boolean;
};

const ALL_BUTTONS: readonly ButtonSpec[] = [
  {id: MOWER_ACTIONS.startMowing, label: 'Start', icon: <PlayIcon />, color: 'primary', variant: 'contained', gated: true},
  {id: START_WITH_PARAMS, label: 'Mow with params', icon: <TuneIcon />, color: 'primary', variant: 'outlined', gated: false},
  {id: MOWER_ACTIONS.continueMowing, label: 'Continue', icon: <PlayIcon />, color: 'primary', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.pause, label: 'Pause', icon: <PauseIcon />, color: 'warning', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.skipArea, label: 'Skip area', icon: <SkipIcon />, color: 'info', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.abortMowing, label: 'Stop & dock', icon: <HomeIcon />, color: 'secondary', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.abortToIdle, label: 'Stop', icon: <StopCircleIcon />, color: 'warning', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.abortDocking, label: 'Abort docking', icon: <AbortDockIcon />, color: 'info', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.abortUndocking, label: 'Abort undocking', icon: <AbortUndockIcon />, color: 'info', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.startAreaRecording, label: 'Record area', icon: <RecordIcon />, color: 'info', variant: 'outlined', gated: true},
  {id: MOWER_ACTIONS.arExit, label: 'Exit recording', icon: <ExitRecordIcon />, color: 'info', variant: 'outlined', gated: true},
  {id: RPC_RETURN_HOME, label: 'Return home', icon: <HomeIcon />, color: 'secondary', variant: 'contained', gated: false},
  {id: MOWER_ACTIONS.setEmergency, label: 'Emergency', icon: <StopIcon />, color: 'error', variant: 'outlined', gated: true},
];

interface QuickActionsProps {
  // 'card' uses the original dashboard layout (wrap rows of buttons). 'sheet'
  // arranges the buttons in a tighter responsive grid suitable for the global
  // bottom sheet on small screens.
  variant?: 'card' | 'sheet';
  // Called after a successful action send — used by the sheet variant to
  // close itself once the user has triggered something.
  onActionDispatched?: () => void;
}

// Module-scope selectors keep stable identity across renders, which lets
// useSyncExternalStore avoid re-subscribing when this card re-renders.
const selectHasMower = (s?: Mower) => Boolean(s);
const selectActions = (s?: Mower) => s?.actions;
const selectEmergency = (s?: Mower) => s?.state.emergency ?? false;

export default function QuickActions({variant = 'card', onActionDispatched}: QuickActionsProps) {
  const toast = useToast();
  // Subscribe only to the slices we render against — the Mower object is
  // immerable, so a broad `(s) => s` selector would re-render every button on
  // every MQTT tick.
  const hasMower = useSelectedMower(selectHasMower);
  const actions = useSelectedMower(selectActions);
  const emergency = useSelectedMower(selectEmergency);
  const [pending, setPending] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  const sendAction = async (label: string, actionId: string) => {
    const mower = useMowersStore.getState().mowers[useMowersStore.getState().selected];
    if (!mower) {
      toast.error('No mower selected');
      return;
    }
    setPending(actionId);
    try {
      mower.publishAction(actionId);
      toast.success(`${label} sent`);
      onActionDispatched?.();
    } catch (e) {
      toast.error(`${label} failed: ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  };

  const sendReturnHome = async () => {
    const mower = useMowersStore.getState().mowers[useMowersStore.getState().selected];
    if (!mower) {
      toast.error('No mower selected');
      return;
    }
    setPending(RPC_RETURN_HOME);
    try {
      await mower.rpc.mower.return_home();
      toast.success('Return home sent');
      onActionDispatched?.();
    } catch (e) {
      toast.error(`Return home failed: ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  };

  const handleClick = (button: ButtonSpec) => {
    if (button.id === MOWER_ACTIONS.resetEmergency) {
      setResetOpen(true);
      return;
    }
    if (button.id === RPC_RETURN_HOME) {
      sendReturnHome();
      return;
    }
    if (button.id === START_WITH_PARAMS) {
      setStartOpen(true);
      return;
    }
    sendAction(button.label, button.id);
  };

  const isEnabled = (button: ButtonSpec) => {
    if (!button.gated) return hasMower;
    return actions?.some((a) => a.action_id === button.id && a.enabled) ?? false;
  };

  const buttons: ButtonSpec[] = emergency
    ? [
        {
          id: MOWER_ACTIONS.resetEmergency,
          label: 'Reset emergency',
          icon: <WarningIcon />,
          color: 'error',
          variant: 'contained',
          gated: false,
        },
      ]
    : [...ALL_BUTTONS];

  // In sheet mode lay buttons out in a responsive grid so the touch targets
  // stay reachable on mobile without scrolling sideways. In card mode keep
  // the original wrap-flex behaviour so the dashboard appearance is preserved.
  const containerSx =
    variant === 'sheet'
      ? {
          display: 'grid',
          gridTemplateColumns: {xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)'},
          gap: 1.25,
        }
      : {display: 'flex', flexWrap: 'wrap' as const, gap: 1.5};

  const buttonSx =
    variant === 'sheet'
      ? {minHeight: 56, justifyContent: 'flex-start'}
      : {flex: {xs: '1 1 140px', md: '0 1 auto'}, minWidth: {xs: 0, md: 140}};

  return (
    <Box>
      <Box sx={containerSx}>
        {buttons.map((button) => (
          <Button
            key={button.id}
            variant={button.variant}
            color={button.color}
            startIcon={button.icon}
            disabled={pending !== null || !isEnabled(button)}
            onClick={() => handleClick(button)}
            sx={buttonSx}
          >
            {pending === button.id ? '…' : button.label}
          </Button>
        ))}
      </Box>
      {startOpen && <StartMowingDialog onClose={() => setStartOpen(false)} />}
      {resetOpen && (
        <Dialog open onClose={() => setResetOpen(false)}>
          <DialogTitle>Reset emergency stop?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The mower will be allowed to resume operation. Make sure the area is safe and the cause of the
              emergency has been cleared.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              onClick={async () => {
                setResetOpen(false);
                await sendAction('Reset emergency', MOWER_ACTIONS.resetEmergency);
              }}
              disabled={pending !== null}
            >
              Reset
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
