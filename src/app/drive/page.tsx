'use client';

import VirtualJoystick from '@/components/map/teleop/VirtualJoystick';
import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useToast} from '@/hooks/useToast';
import {useTeleop} from '@/hooks/useTeleop';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {useUiStore} from '@/stores/uiStore';
import {GpsFixed as GpsIcon, NearMe as HeadingIcon, Speed as SpeedIcon, Stop as StopIcon} from '@mui/icons-material';
import {
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
import {useState} from 'react';

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
  const [killOpen, setKillOpen] = useState(false);
  const [killing, setKilling] = useState(false);

  const triggerEmergency = async () => {
    const {mowers, selected} = useMowersStore.getState();
    const mower = mowers[selected];
    if (!mower) return;
    setKilling(true);
    try {
      mower.publishAction('mower_logic/set_emergency');
      toast.warning('Emergency stop sent');
      setKillOpen(false);
    } finally {
      setKilling(false);
    }
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
              <PoseRow label="Pos. accuracy" value={fmtMeters(state?.pose?.pos_accuracy)} />
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
                onClick={() => setKillOpen(true)}
                disabled={!state}
              >
                Emergency stop
              </Button>
            </CardContent>
          </Card>
        </Box>

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

      <Dialog open={killOpen} onClose={() => setKillOpen(false)}>
        <DialogTitle>Trigger emergency stop?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The mower will halt immediately and require a manual reset from the Dashboard before resuming.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKillOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={triggerEmergency} disabled={killing}>
            Emergency stop
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
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

function fmtDeg(rad?: number): string {
  if (rad === undefined) return '—';
  const deg = (rad * 180) / Math.PI;
  return `${deg.toFixed(1)}°`;
}

function fmtXY(x?: number, y?: number): string {
  if (x === undefined || y === undefined) return '—';
  return `${x.toFixed(2)}, ${y.toFixed(2)} m`;
}

function fmtMeters(m?: number): string {
  if (m === undefined) return '—';
  return m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`;
}
