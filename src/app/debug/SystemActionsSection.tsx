'use client';

import {useToast} from '@/hooks/useToast';
import type {OpenMowerRpc} from '@/lib/rpc';
import type {Capabilities} from '@/stores/schemas';
import {
  CleaningServices as CleanIcon,
  PowerSettingsNew as PowerIcon,
  Build as ToolsIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import {useState} from 'react';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

interface PruneResult {
  ok?: boolean;
  reclaimed_bytes?: number;
  output?: string;
}

function RebootButton({rpc}: {rpc: OpenMowerRpc}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await rpc.system.reboot({});
      toast.success('Reboot triggered — host will restart shortly');
      setOpen(false);
    } catch (e) {
      const msg = (e as Error).message;
      // The host can drop the MQTT connection before responding; rpc-base
      // surfaces that as a timeout. From the user's perspective the reboot
      // still happened, so we soft-succeed.
      if (msg.toLowerCase().includes('timeout')) {
        toast.info('Reboot in progress — connection will drop briefly');
        setOpen(false);
      } else {
        toast.error(`Reboot failed: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PowerIcon />}
        onClick={() => setOpen(true)}
        disabled={busy}
      >
        Reboot Raspberry Pi
      </Button>
      <Dialog open={open} onClose={() => (busy ? null : setOpen(false))}>
        <DialogTitle>Reboot the Raspberry Pi?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" gutterBottom>
              The mower&apos;s computer will restart. ROS, MQTT and the web UI will be unreachable for roughly
              30–60 seconds.
            </Typography>
            <Typography variant="body2" color="error">
              Any running mowing or docking action will be aborted. Make sure the mower is in a safe state before
              continuing.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={submit} disabled={busy}>
            Reboot now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DockerPruneButton({rpc}: {rpc: OpenMowerRpc}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      // 90s — the backend caps the docker call at 60s, plus MQTT overhead.
      const result = (await rpc.call('system.docker_prune', undefined, 90_000)) as PruneResult;
      const reclaimed = result?.reclaimed_bytes ?? 0;
      toast.success(
        reclaimed > 0
          ? `Cleanup complete — reclaimed ${formatBytes(reclaimed)}`
          : 'Cleanup complete — nothing to remove',
      );
      setOpen(false);
    } catch (e) {
      toast.error(`Cleanup failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="warning"
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <CleanIcon />}
        onClick={() => setOpen(true)}
        disabled={busy}
      >
        Clean Docker images
      </Button>
      <Dialog open={open} onClose={() => (busy ? null : setOpen(false))}>
        <DialogTitle>Remove unused Docker images?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" gutterBottom>
              Runs <code>docker image prune -af</code> on the host to free up SD / eMMC space. All images that are
              not currently used by a running container will be removed.
            </Typography>
            <Typography variant="body2" color="warning.main">
              The next update may need to re-download some images. Running containers and their data are not affected.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="warning" variant="contained" onClick={submit} disabled={busy}>
            Clean now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function SystemActionsSection({rpc, capabilities}: {rpc: OpenMowerRpc; capabilities: Capabilities}) {
  const canReboot = (capabilities['system.reboot'] ?? 0) >= 1;
  const canPrune = (capabilities['system.docker_prune'] ?? 0) >= 1;
  if (!canReboot && !canPrune) return null;

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <ToolsIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          System actions
        </Typography>
      </Box>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5}}>
        {canReboot && <RebootButton rpc={rpc} />}
        {canPrune && <DockerPruneButton rpc={rpc} />}
      </Box>
    </Box>
  );
}
