'use client';

import {maskPassword} from '@/lib/mqttUrl';
import {useMowersStore, type ConnectionDiagnostic, useConnectionDiagnostic} from '@/stores/mowersStore';
import {Alert, AlertTitle, Box, Button, Collapse, IconButton} from '@mui/material';
import {AlertCircleIcon, ChevronDownIcon, ChevronUpIcon, RefreshCwIcon} from 'lucide-react';
import {useState} from 'react';

// A single banner that diagnoses the live MQTT connection for the selected
// mower. Renders nothing when everything is healthy. Otherwise gives the user
// concrete next steps — masked URL, missing topics, retry button — so they
// don't sit staring at "Unknown" / "Waiting for actions" forever.
export default function ConnectionBanner() {
  const diag = useConnectionDiagnostic();
  const [expanded, setExpanded] = useState(false);

  if (diag.status === 'ok') return null;

  const {severity, title, body} = describe(diag);
  const handleRetry = () => useMowersStore.getState().loadMowers();

  return (
    <Alert
      severity={severity}
      icon={<AlertCircleIcon size={18} />}
      sx={{borderRadius: 0, alignItems: 'flex-start'}}
      action={
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
          {diag.mqttUrl && (
            <Button
              size="small"
              startIcon={<RefreshCwIcon size={14} />}
              onClick={handleRetry}
              color="inherit"
              variant="text"
            >
              Retry
            </Button>
          )}
          <IconButton size="small" onClick={() => setExpanded((v) => !v)} aria-label="Toggle details">
            {expanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </IconButton>
        </Box>
      }
    >
      <AlertTitle sx={{mb: 0.25}}>{title}</AlertTitle>
      {body}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{mt: 1, fontSize: '0.8rem', fontFamily: 'var(--font-dm-mono), monospace'}}>
          {diag.mqttUrl && (
            <Box>
              broker: <code>{maskPassword(diag.mqttUrl)}</code>
            </Box>
          )}
          {diag.mqttPrefix && (
            <Box>
              prefix: <code>{diag.mqttPrefix}</code>
            </Box>
          )}
          {diag.missingTopics.length > 0 && (
            <Box>
              never received: {diag.missingTopics.map((t) => <code key={t} style={{marginRight: 6}}>{t}</code>)}
            </Box>
          )}
          {diag.staleTopics.length > 0 && (
            <Box>
              stale ({'>'}10s):{' '}
              {diag.staleTopics.map(({topic, ageMs}) => (
                <code key={topic} style={{marginRight: 6}}>
                  {topic} ({Math.round(ageMs / 1000)}s)
                </code>
              ))}
            </Box>
          )}
          {diag.status === 'no-broker' && (
            <Box sx={{mt: 0.5}}>
              Add a <code>config.json</code> to the app root or set <code>MOWER_MQTT_WS_URL</code> in the environment.
            </Box>
          )}
        </Box>
      </Collapse>
    </Alert>
  );
}

interface BannerCopy {
  severity: 'info' | 'warning' | 'error';
  title: string;
  body: string;
}

function describe(diag: ConnectionDiagnostic): BannerCopy {
  switch (diag.status) {
    case 'no-mower':
      return {
        severity: 'info',
        title: 'No mower configured',
        body: 'Add a mower to config.json or set MOWER_MQTT_WS_URL.',
      };
    case 'connecting':
      return {
        severity: 'info',
        title: 'Connecting to MQTT broker…',
        body: `Trying to reach ${maskPassword(diag.mqttUrl)}.`,
      };
    case 'no-broker':
      return {
        severity: 'error',
        title: 'MQTT broker unreachable',
        body: `Cannot connect to ${maskPassword(diag.mqttUrl)}. Is the OpenMower stack running?`,
      };
    case 'no-topics':
      return {
        severity: 'warning',
        title: 'Connected — but the mower is silent',
        body: `Subscribed to "${diag.mqttPrefix}+" but no expected topics arrived. The xbot_monitoring node may not be running on the device.`,
      };
    case 'stale': {
      const missing = diag.missingTopics.length;
      const stale = diag.staleTopics.length;
      const parts: string[] = [];
      if (missing > 0) parts.push(`${missing} never received`);
      if (stale > 0) parts.push(`${stale} stale`);
      return {
        severity: 'warning',
        title: 'Mower data partial',
        body: `Some mower topics aren’t arriving: ${parts.join(', ')}. Expand for details.`,
      };
    }
    default:
      return {severity: 'info', title: '', body: ''};
  }
}
