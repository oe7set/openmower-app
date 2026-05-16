import {ContentCopy as CopyIcon} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import type {BaseField} from './types';

interface EnvReadOnlyDialogProps {
  open: boolean;
  onClose: () => void;
  field: BaseField;
  rootHint: string;
}

export function EnvReadOnlyDialog({open, onClose, field, rootHint}: EnvReadOnlyDialogProps) {
  const [copied, setCopied] = useState(false);
  const envVar = field['x-environment-variable'] ?? field.name;
  const cliCommand = 'sudo openmower config env';

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(cliCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in HTTP contexts; ignore.
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit on the mower host</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body2" sx={{mb: 2}}>
            <strong>{field.label || envVar}</strong> is stored in the Docker Compose environment file
            and cannot be changed from the web UI. Updating it changes which firmware and ROS parameter
            files are loaded, so the full Compose stack must restart afterwards.
          </Typography>
          <Typography variant="body2" sx={{mb: 1}}>
            On the mower host, edit it via:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'grey.100',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              mb: 2,
            }}
          >
            <Box component="code" sx={{flex: 1, wordBreak: 'break-all'}}>
              {cliCommand}
            </Box>
            <Tooltip title={copied ? 'Copied!' : 'Copy command'}>
              <IconButton size="small" onClick={copyCommand}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
            Variable: <code>{envVar}</code>
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
            File: <code>{rootHint}</code>
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
