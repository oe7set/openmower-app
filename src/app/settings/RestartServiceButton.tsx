'use client';

import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import {RestartAlt as RestartIcon} from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {useState} from 'react';

// Restart-mower-service action surfaced next to the Settings save button.
// Capability-gated so older backends without the system.restart_service RPC
// hide the button entirely (rather than always-failing on click).

export default function RestartServiceButton() {
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);
  const hasCap = useSelectedMower((s) => s?.hasCapability('system.restart_service') ?? false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!hasCap) return null;

  const submit = async () => {
    if (!rpc) return;
    setBusy(true);
    try {
      await rpc.system.restart_service({});
      toast.success('Restart triggered');
      setOpen(false);
    } catch (e) {
      const msg = (e as Error).message;
      // The service may restart itself before answering — that surfaces as a
      // 10s timeout in rpc-base. Treat that as a soft success.
      if (msg.includes('timeout')) {
        toast.info('Restart in progress — connection will recover shortly');
        setOpen(false);
      } else {
        toast.error(`Restart failed: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="warning"
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <RestartIcon />}
        onClick={() => setOpen(true)}
        disabled={busy || !rpc}
      >
        Restart service
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Restart mower service?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The mower will interrupt any running action. Make sure it&apos;s in a safe state. The MQTT connection may
            briefly drop while the service comes back up.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="warning" variant="contained" onClick={submit} disabled={busy}>
            Restart
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
