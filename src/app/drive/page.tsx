'use client';

import VirtualJoystick from '@/components/map/teleop/VirtualJoystick';
import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useToast} from '@/hooks/useToast';
import {useTeleop} from '@/hooks/useTeleop';
import {fmtAccuracy, fmtDeg, fmtXY} from '@/lib/format';
import {MOWER_ACTIONS, type MowerActionId} from '@/lib/mowerActions';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {useUiStore} from '@/stores/uiStore';
import CameraCard from './CameraCard';
import TelemetryStrip from './TelemetryStrip';
import {
  Cancel as CancelIcon,
  ExitToApp as ExitIcon,
  GpsFixed as GpsIcon,
  Home as HomeIcon,
  NearMe as HeadingIcon,
  PlayArrow as PlayIcon,
  Speed as SpeedIcon,
  Stop as StopIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Slider,
  Typography,
  useTheme,
} from '@mui/material';
import {ReactNode, useState} from 'react';

// Manual driving page. Stays usable independently of the map editor — the
// joystick was previously only available during AREA_RECORDING, which made
// quick "nudge the mower out of the way" workflows hard to discover.

export default function DrivePage() {
  const theme = useTheme();
  const toast = useToast();
  const cap = useUiStore((s) => s.teleopSpeedCap);
  const setCap = useUiStore((s) => s.setTeleopSpeedCap);
  const {setVelocity} = useTeleop({cap});
  const state = useSelectedMower((s) => s?.state);
  const [resetOpen, setResetOpen] = useState(false);

  const triggerEmergency = () => {
    const {mowers, selected} = useMowersStore.getState();
    const mower = mowers[selected];
    if (!mower) return;
    mower.publishAction(MOWER_ACTIONS.setEmergency);
    toast.warning('Emergency stop sent');
  };

  const sendAction = (label: string, actionId: MowerActionId) => {
    const {mowers, selected} = useMowersStore.getState();
    const mower = mowers[selected];
    if (!mower) return;
    mower.publishAction(actionId);
    toast.success(`${label} sent`);
  };

  const stateLabel = state?.current_state ?? 'UNKNOWN';
  const stateColor: 'success' | 'error' | 'warning' | 'default' =
    state?.emergency
      ? 'error'
      : stateLabel === 'MOWING' || stateLabel === 'AREA_RECORDING'
      ? 'success'
      : stateLabel === 'IDLE'
      ? 'default'
      : 'warning';

  return (
    <Page>
      <PageHeader title="Drive" subtitle="Manually pilot the mower with the virtual joystick">
        <HeaderStat icon={<SpeedIcon />} value={`${Math.round(cap * 100)}%`} label="Speed cap" />
        <HeaderStat icon={<HeadingIcon />} value={fmtDeg(state?.pose?.heading)} label="Heading" />
        <HeaderStat icon={<GpsIcon />} value={`${state?.gps_percentage ?? 0}%`} label="GPS" />
      </PageHeader>
      <PageContent>
        <TelemetryStrip />
        <Box sx={{display: 'flex', flexDirection: {xs: 'column', md: 'row'}, gap: 2, mt: 2}}>
          {/* Live status / pose readout */}
          <Card sx={{flex: '1 1 280px'}}>
            <CardContent>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
                <Typography variant="h6" fontWeight="600">
                  Status
                </Typography>
                <Chip label={stateLabel} color={stateColor} size="small" sx={{fontWeight: 600}} />
              </Box>
              <PoseRow icon={<HeadingIcon fontSize="small" />} label="Heading" value={fmtDeg(state?.pose?.heading)} />
              <PoseRow icon={<GpsIcon fontSize="small" />} label="Position" value={fmtXY(state?.pose?.x, state?.pose?.y)} />
              <PoseRow label="GPS quality" value={`${state?.gps_percentage ?? 0}%`} />
              <PoseRow label="Pos. accuracy" value={fmtAccuracy(state?.pose?.pos_accuracy)} />
              <PoseRow label="Battery" value={`${state?.battery_percentage ?? 0}%`} />
            </CardContent>
          </Card>

          {/* Speed cap + kill */}
          <Card sx={{flex: '1 1 280px'}}>
            <CardContent>
              <Typography variant="h6" fontWeight="600" sx={{mb: 1}}>
                Speed limit
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 2}}>
                Joystick output is multiplied by this percentage before publishing to the mower.
              </Typography>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                <Slider
                  value={Math.round(cap * 100)}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(_, v) => setCap((v as number) / 100)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <Typography variant="body2" sx={{minWidth: 40, textAlign: 'right', fontWeight: 600}}>
                  {Math.round(cap * 100)}%
                </Typography>
              </Box>
              <Button
                fullWidth
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                sx={{mt: 3}}
                onClick={triggerEmergency}
                disabled={!state}
              >
                Emergency stop
              </Button>
            </CardContent>
          </Card>
        </Box>


        {/* Mode-switch — gated purely on current_state. The joystick stream is
            silently discarded by mower_logic in any state where
            redirect_joystick() returns false (everything except AREA_RECORDING),
            so this card is the user's lever to make the joystick effective. */}
        <Card sx={{mt: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 1.5}}>
              Mode
            </Typography>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
              {state?.emergency && (
                <ModeBtn
                  label="Reset emergency"
                  icon={<WarningIcon />}
                  color="error"
                  onClick={() => setResetOpen(true)}
                />
              )}
              {stateLabel === 'IDLE' && (
                <ModeBtn
                  label="Enter recording"
                  icon={<PlayIcon />}
                  color="success"
                  onClick={() => sendAction('Enter recording', MOWER_ACTIONS.startAreaRecording)}
                />
              )}
              {stateLabel === 'AREA_RECORDING' && (
                <>
                  <ModeBtn
                    label="Stop recording"
                    icon={<StopIcon />}
                    color="warning"
                    variant="outlined"
                    onClick={() => sendAction('Stop recording', MOWER_ACTIONS.arStopRecording)}
                  />
                  <ModeBtn
                    label="Exit recording"
                    icon={<ExitIcon />}
                    color="inherit"
                    variant="outlined"
                    onClick={() => sendAction('Exit recording', MOWER_ACTIONS.arExit)}
                  />
                </>
              )}
              {stateLabel === 'MOWING' && (
                <ModeBtn
                  label="Return home"
                  icon={<HomeIcon />}
                  color="secondary"
                  variant="outlined"
                  onClick={() => sendAction('Return home', MOWER_ACTIONS.abortMowing)}
                />
              )}
              {stateLabel === 'DOCKING' && (
                <ModeBtn
                  label="Abort docking"
                  icon={<CancelIcon />}
                  color="warning"
                  variant="outlined"
                  onClick={() => sendAction('Abort docking', MOWER_ACTIONS.abortDocking)}
                />
              )}
              {stateLabel === 'UNDOCKING' && (
                <ModeBtn
                  label="Abort undocking"
                  icon={<CancelIcon />}
                  color="warning"
                  variant="outlined"
                  onClick={() => sendAction('Abort undocking', MOWER_ACTIONS.abortUndocking)}
                />
              )}
            </Box>
            {stateLabel !== 'AREA_RECORDING' && !state?.emergency && (
              <Alert severity="info" sx={{mt: 2}}>
                The joystick only moves the mower while it&apos;s in <b>AREA_RECORDING</b>. Click
                <i> Enter recording</i> to take manual control.
              </Alert>
            )}
          </CardContent>
        </Card>
		
		{/* Camera — only renders when MOWER_CAMERA_URL is set. Sits above the
            mode card so the operator sees the stream while reaching for the
            joystick or the mode-switch buttons. */}
        <CameraCard />


        {/* Joystick — gets the rest of the viewport */}
        <Card sx={{mt: 2, py: 6, display: 'flex', justifyContent: 'center'}}>
          <Box
            sx={{
              transform: {xs: 'scale(1.4)', md: 'scale(1.8)'},
              transformOrigin: 'center',
            }}
          >
            <Box
              sx={{
                // Brand-tinted joystick container so the white-on-dark joystick
                // doesn't clash with light surfaces.
                borderRadius: '50%',
                background:
                  theme.palette.mode === 'dark'
                    ? 'rgba(15,17,18,0.4)'
                    : `radial-gradient(circle, ${theme.palette.primary.main}11 0%, ${theme.palette.primary.main}22 100%)`,
              }}
            >
              <VirtualJoystick onVelocityChange={setVelocity} />
            </Box>
          </Box>
        </Card>
        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1.5, textAlign: 'center'}}>
          Drag the centre knob to drive freely. Press an outer arrow for ramped D-pad input.
        </Typography>
      </PageContent>

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
            onClick={() => {
              setResetOpen(false);
              sendAction('Reset emergency', MOWER_ACTIONS.resetEmergency);
            }}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}

interface ModeBtnProps {
  label: string;
  icon: ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info' | 'error' | 'inherit' | 'secondary';
  variant?: 'contained' | 'outlined';
  onClick: () => void;
}

function ModeBtn({label, icon, color, variant = 'contained', onClick}: ModeBtnProps) {
  return (
    <Button
      size="medium"
      variant={variant}
      color={color}
      startIcon={icon}
      onClick={onClick}
      sx={{flex: '0 1 auto', minWidth: 160}}
    >
      {label}
    </Button>
  );
}

function PoseRow({icon, label, value}: {icon?: React.ReactNode; label: string; value: string}) {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, py: 0.5}}>
      {icon && <Box sx={{color: 'text.secondary', display: 'flex'}}>{icon}</Box>}
      <Typography variant="body2" color="text.secondary" sx={{flex: 1}}>
        {label}
      </Typography>
      <Typography variant="body2" fontFamily="var(--font-dm-mono), monospace" fontWeight="500">
        {value}
      </Typography>
    </Box>
  );
}

