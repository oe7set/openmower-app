'use client';

import {useToast} from '@/hooks/useToast';
import {useMowers} from '@/stores/mowersStore';
import {ContentCopy as CopyIcon} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {useMemo, useState, useSyncExternalStore} from 'react';

// First-run helper. Triggered when no mowers are configured. Walks the user
// through host entry, a quick MQTT-WebSocket reachability test, and produces
// a copy-pasteable config.json. We can't write the file from the browser
// (loadAppConfig is a server action that reads disk on the Next.js host) so
// the user must save it themselves and restart the dev server / container.

const SKIP_KEY = 'openmower_onboarding_skipped';
const STEPS = ['Mower host', 'Test connection', 'Create config.json'];

// useSyncExternalStore-based "is hydrated" gate. The subscribe callback never
// fires (the value never changes after mount), but React still flips between
// the server and client snapshots, which is exactly what we want.
const noopSubscribe = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

type TestState = 'idle' | 'pending' | 'success' | 'error';

export default function OnboardingDialog() {
  const mowers = useMowers();
  const toast = useToast();
  // Lazy init reads sessionStorage exactly once on the client. SSR returns
  // false (treated as "not skipped") which matches the eventual hydrated state
  // for fresh users — and React 19's useState initializer is allowed to read
  // browser globals because it only runs client-side after hydration.
  const [skippedByUser, setSkippedByUser] = useState<boolean>(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(SKIP_KEY) === '1',
  );
  const [step, setStep] = useState(0);
  const [host, setHost] = useState('openmower.local');
  const [testState, setTestState] = useState<TestState>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  // Defer the open decision until after hydration. SSR renders with an empty
  // mowers array (the store is only populated client-side by ConfigInitializer)
  // — without this gate the Dialog mounts open=true in the SSR HTML, then MUI's
  // open→close animation can leave the modal in a stuck state where the
  // backdrop is invisible but still captures pointer events.
  // useSyncExternalStore returns getServerSnapshot during SSR/initial hydrate
  // and getSnapshot after the first commit, giving us a clean false→true flip
  // without a setState-in-effect.
  const hydrated = useSyncExternalStore(noopSubscribe, getTrue, getFalse);

  const open = hydrated && !skippedByUser && mowers.length === 0;

  const wsUrl = useMemo(() => {
    const trimmed = host.trim();
    if (!trimmed) return '';
    // Tolerate users pasting full URLs.
    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
    return `ws://${trimmed}:9001`;
  }, [host]);

  const configJson = useMemo(
    () =>
      JSON.stringify(
        {
          mowers: [
            {
              id: '1',
              name: 'OpenMower',
              description: '',
              mqtt_ws_url: wsUrl,
              mqtt_prefix: '',
            },
          ],
        },
        null,
        2,
      ),
    [wsUrl],
  );

  const runTest = () => {
    if (!wsUrl) return;
    setTestState('pending');
    setTestError(null);
    let settled = false;
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      setTestState('error');
      setTestError((e as Error).message);
      return;
    }
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setTestState('error');
        setTestError('Timed out after 3 s');
        socket?.close();
      }
    }, 3000);
    socket.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setTestState('success');
      socket?.close();
    };
    socket.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setTestState('error');
      setTestError('Could not connect — host unreachable, MQTT broker not running, or wrong port');
    };
  };

  const skip = () => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(SKIP_KEY, '1');
    setSkippedByUser(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      toast.success('config.json copied to clipboard');
    } catch (e) {
      toast.error(`Copy failed: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onClose={skip} maxWidth="sm" fullWidth>
      <DialogTitle>Welcome to OpenMower</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
          No mowers configured yet. Three quick steps to point this app at your mower.
        </Typography>

        <Stepper activeStep={step} alternativeLabel sx={{mb: 3}}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === 0 && (
          <Box>
            <Typography variant="body2" sx={{mb: 1.5}}>
              Hostname or IP address of the device running the OpenMower stack.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Mower host"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                setTestState('idle');
              }}
              helperText={wsUrl ? `Will try: ${wsUrl}` : 'e.g. openmower.local or 192.168.1.42'}
            />
          </Box>
        )}

        {step === 1 && (
          <Box>
            <Typography variant="body2" sx={{mb: 1.5}}>
              Open a WebSocket to <code>{wsUrl}</code> to verify the broker is reachable.
            </Typography>
            <Button variant="contained" disabled={testState === 'pending' || !wsUrl} onClick={runTest}>
              {testState === 'pending' ? 'Testing…' : 'Run test'}
            </Button>
            {testState === 'success' && (
              <Alert severity="success" sx={{mt: 2}}>
                Reached {wsUrl}. The MQTT broker is responding.
              </Alert>
            )}
            {testState === 'error' && (
              <Alert severity="error" sx={{mt: 2}}>
                {testError ?? 'Unknown error'}
              </Alert>
            )}
            {testState === 'idle' && (
              <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1.5}}>
                You can skip the test and still create the config — the app will retry on its own once configured.
              </Typography>
            )}
          </Box>
        )}

        {step === 2 && (
          <Box>
            <Typography variant="body2" sx={{mb: 1.5}}>
              Save the snippet below as <code>config.json</code> in the app root, then restart the dev server (or
              redeploy the container).
            </Typography>
            <Box sx={{position: 'relative'}}>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.8rem',
                  overflow: 'auto',
                }}
              >
                {configJson}
              </Box>
              <IconButton
                size="small"
                onClick={copy}
                aria-label="Copy"
                sx={{position: 'absolute', top: 4, right: 4}}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1.5}}>
              Alternative: set <code>MOWER_MQTT_WS_URL={wsUrl}</code> in the environment.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={skip}>Skip</Button>
        <Box sx={{flex: 1}} />
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        {step < STEPS.length - 1 && (
          <Button
            variant="contained"
            disabled={step === 0 && !host.trim()}
            onClick={() => setStep(step + 1)}
          >
            Next
          </Button>
        )}
        {step === STEPS.length - 1 && (
          <Button variant="contained" onClick={skip}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
