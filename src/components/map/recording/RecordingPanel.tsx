'use client';

import {useToast} from '@/hooks/useToast';
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

// All action IDs registered by mower_logic's AreaRecordingBehavior. They
// appear in actions/json once the mower enters AREA_RECORDING.
const A = {
  startRecording: 'mower_logic/start_recording',
  stopRecording: 'mower_logic/stop_recording',
  collectPoint: 'mower_logic/collect_point',
  autoEnable: 'mower_logic/auto_point_collecting_enable',
  autoDisable: 'mower_logic/auto_point_collecting_disable',
  recordDock: 'mower_logic/record_dock',
  finishMowing: 'mower_logic/finish_mowing_area',
  finishNav: 'mower_logic/finish_navigation_area',
  finishDiscard: 'mower_logic/finish_discard',
  exitRecording: 'mower_logic/exit_recording_mode',
} as const;

export default function RecordingPanel() {
  const theme = useTheme();
  const toast = useToast();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const subState = useSelectedMower((s) => s?.state.current_sub_state ?? '');
  const selected = useSelectedMower((s) => s);
  const [pending, setPending] = useState<string | null>(null);

  const isEnabled = (id: string) => selected?.isActionEnabled(id) ?? false;

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
  const autoEnabled = isEnabled(A.autoDisable);

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        top: isMobile ? 56 : 8,
        right: isMobile ? 8 : 60,
        width: isMobile ? 'calc(100% - 16px)' : 320,
        p: 2,
        borderRadius: 2,
        zIndex: 9,
        backdropFilter: 'blur(8px)',
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)',
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
          enabled={isEnabled(A.startRecording)}
          pending={pending === A.startRecording}
          onClick={() => send('Recording started', A.startRecording)}
        />
        <ActionBtn
          label="Stop"
          icon={<StopIcon />}
          color="warning"
          enabled={isEnabled(A.stopRecording)}
          pending={pending === A.stopRecording}
          onClick={() => send('Recording stopped', A.stopRecording)}
        />
        <ActionBtn
          label="Add point"
          icon={<PointIcon />}
          color="primary"
          enabled={isEnabled(A.collectPoint)}
          pending={pending === A.collectPoint}
          onClick={() => send('Point collected', A.collectPoint)}
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
              enabled={isEnabled(autoEnabled ? A.autoDisable : A.autoEnable)}
              pending={pending === A.autoEnable || pending === A.autoDisable}
              onClick={() =>
                send(
                  autoEnabled ? 'Auto-collect disabled' : 'Auto-collect enabled',
                  autoEnabled ? A.autoDisable : A.autoEnable,
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
          enabled={isEnabled(A.recordDock)}
          pending={pending === A.recordDock}
          onClick={() => send('Dock pose recorded', A.recordDock)}
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
          enabled={isEnabled(A.finishMowing)}
          pending={pending === A.finishMowing}
          onClick={() => send('Mowing area saved', A.finishMowing)}
        />
        <ActionBtn
          label="Nav area"
          icon={<FlagIcon />}
          color="info"
          variant="outlined"
          enabled={isEnabled(A.finishNav)}
          pending={pending === A.finishNav}
          onClick={() => send('Navigation area saved', A.finishNav)}
        />
        <ActionBtn
          label="Discard"
          icon={<CancelIcon />}
          color="error"
          variant="outlined"
          enabled={isEnabled(A.finishDiscard)}
          pending={pending === A.finishDiscard}
          onClick={() => send('Discarded', A.finishDiscard)}
        />
      </Box>

      <Button
        fullWidth
        size="small"
        variant="text"
        color="inherit"
        startIcon={<ExitIcon />}
        disabled={!isEnabled(A.exitRecording) || pending !== null}
        onClick={() => send('Recording exited', A.exitRecording)}
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
