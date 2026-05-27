'use client';

import {useToast} from '@/hooks/useToast';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {
  Cancel as CancelIcon,
  ExitToApp as ExitIcon,
  Flag as FlagIcon,
  GpsFixed as PointIcon,
  Home as DockIcon,
  PlayArrow as StartIcon,
  Save as SaveIcon,
  Stop as StopIcon,
  Sync as AutoIcon,
} from '@mui/icons-material';
import {Box, Button, Chip, Paper, Tooltip, Typography, useTheme, useMediaQuery} from '@mui/material';
import {useState} from 'react';
import {MAP_OVERLAY_PANEL} from '../zIndex';

export default function RecordingPanel() {
  const theme = useTheme();
  const toast = useToast();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const subState = useSelectedMower((s) => s?.state.current_sub_state ?? '');
  const actions = useSelectedMower((s) => s?.actions);
  const [pending, setPending] = useState<string | null>(null);

  const isEnabled = (id: string) => actions?.some((a) => a.action_id === id && a.enabled) ?? false;

  const send = async (label: string, actionId: string) => {
    const {mowers, selected: idx} = useMowersStore.getState();
    const mower = mowers[idx];
    if (!mower) return;
    setPending(actionId);
    try {
      mower.publishAction(actionId);
      toast.success(`${label}`);
    } finally {
      setPending(null);
    }
  };

  // The "auto collecting" toggle exposes itself as two mutually-exclusive
  // actions in actions/json — only the relevant one is enabled at a time.
  const autoEnabled = isEnabled(MOWER_ACTIONS.arAutoOff);

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        top: 8,
        right: isMobile ? 8 : 60,
        width: isMobile ? 'calc(100% - 16px)' : 320,
        p: 2,
        borderRadius: 2,
        zIndex: MAP_OVERLAY_PANEL,
        backdropFilter: 'blur(8px)',
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(22,24,25,0.92)' : 'rgba(255,255,255,0.92)',
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <Chip color="success" size="small" label="Recording" />
        {subState && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {subState}
          </Typography>
        )}
      </Box>

      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5}}>
        <ActionBtn
          label="Start"
          icon={<StartIcon />}
          color="success"
          enabled={isEnabled(MOWER_ACTIONS.arStartRecording)}
          pending={pending === MOWER_ACTIONS.arStartRecording}
          onClick={() => send('Recording started', MOWER_ACTIONS.arStartRecording)}
        />
        <ActionBtn
          label="Stop"
          icon={<StopIcon />}
          color="warning"
          enabled={isEnabled(MOWER_ACTIONS.arStopRecording)}
          pending={pending === MOWER_ACTIONS.arStopRecording}
          onClick={() => send('Recording stopped', MOWER_ACTIONS.arStopRecording)}
        />
        <ActionBtn
          label="Add point"
          icon={<PointIcon />}
          color="primary"
          enabled={isEnabled(MOWER_ACTIONS.arCollect)}
          pending={pending === MOWER_ACTIONS.arCollect}
          onClick={() => send('Point collected', MOWER_ACTIONS.arCollect)}
        />
      </Box>

      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5}}>
        <Tooltip title={autoEnabled ? 'Disable auto-collect' : 'Enable auto-collect'}>
          <span>
            <ActionBtn
              label={autoEnabled ? 'Auto: on' : 'Auto: off'}
              icon={<AutoIcon />}
              color={autoEnabled ? 'success' : 'inherit'}
              variant={autoEnabled ? 'contained' : 'outlined'}
              enabled={isEnabled(autoEnabled ? MOWER_ACTIONS.arAutoOff : MOWER_ACTIONS.arAutoOn)}
              pending={pending === MOWER_ACTIONS.arAutoOn || pending === MOWER_ACTIONS.arAutoOff}
              onClick={() =>
                send(
                  autoEnabled ? 'Auto-collect disabled' : 'Auto-collect enabled',
                  autoEnabled ? MOWER_ACTIONS.arAutoOff : MOWER_ACTIONS.arAutoOn,
                )
              }
            />
          </span>
        </Tooltip>
        <ActionBtn
          label="Record dock"
          icon={<DockIcon />}
          color="info"
          variant="outlined"
          enabled={isEnabled(MOWER_ACTIONS.arRecordDock)}
          pending={pending === MOWER_ACTIONS.arRecordDock}
          onClick={() => send('Dock pose recorded', MOWER_ACTIONS.arRecordDock)}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>
        Finish polygon as
      </Typography>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5}}>
        <ActionBtn
          label="Mowing area"
          icon={<SaveIcon />}
          color="success"
          enabled={isEnabled(MOWER_ACTIONS.arFinishMow)}
          pending={pending === MOWER_ACTIONS.arFinishMow}
          onClick={() => send('Mowing area saved', MOWER_ACTIONS.arFinishMow)}
        />
        <ActionBtn
          label="Nav area"
          icon={<FlagIcon />}
          color="info"
          variant="outlined"
          enabled={isEnabled(MOWER_ACTIONS.arFinishNav)}
          pending={pending === MOWER_ACTIONS.arFinishNav}
          onClick={() => send('Navigation area saved', MOWER_ACTIONS.arFinishNav)}
        />
        <ActionBtn
          label="Discard"
          icon={<CancelIcon />}
          color="error"
          variant="outlined"
          enabled={isEnabled(MOWER_ACTIONS.arFinishDiscard)}
          pending={pending === MOWER_ACTIONS.arFinishDiscard}
          onClick={() => send('Discarded', MOWER_ACTIONS.arFinishDiscard)}
        />
      </Box>

      <Button
        fullWidth
        size="small"
        variant="text"
        color="inherit"
        startIcon={<ExitIcon />}
        disabled={!isEnabled(MOWER_ACTIONS.arExit) || pending !== null}
        onClick={() => send('Recording exited', MOWER_ACTIONS.arExit)}
      >
        Exit recording mode
      </Button>
    </Paper>
  );
}

interface ActionBtnProps {
  label: string;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'error' | 'inherit';
  variant?: 'contained' | 'outlined';
  enabled: boolean;
  pending: boolean;
  onClick: () => void;
}

function ActionBtn({label, icon, color = 'primary', variant = 'contained', enabled, pending, onClick}: ActionBtnProps) {
  return (
    <Button
      size="small"
      variant={variant}
      color={color}
      startIcon={pending ? null : icon}
      disabled={!enabled || pending}
      onClick={onClick}
      sx={{flex: '1 1 100px', minWidth: 100}}
    >
      {pending ? '…' : label}
    </Button>
  );
}
