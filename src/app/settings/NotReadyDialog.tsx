import {Construction as ConstructionIcon} from '@mui/icons-material';
import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography} from '@mui/material';

interface NotReadyDialogProps {
  open: boolean;
  onClose: () => void;
}

// Temporary safety net: the Save flow is wired up but has not seen enough
// real-mower miles yet, so until it does we intercept the final confirm and
// tell the user, in a friendly way, that nothing actually happened.
export function NotReadyDialog({open, onClose}: NotReadyDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', gap: 1}}>
        <ConstructionIcon color="info" />
        Almost. But not quite.
      </DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body2" sx={{mb: 2}}>
            The Save button is technically pressable, but its training wheels are still on. This
            code path has not seen enough real-mower miles yet, and we would rather not be the
            reason your mower decides to mow the neighbour&apos;s prize roses at 3 a.m.
          </Typography>
          <Typography variant="body2" sx={{mb: 2}}>
            So: <strong>nothing was sent to the mower. Nothing was changed.</strong> Your settings
            are exactly as you left them, your config files are untouched, and the firmware is
            blissfully unaware that you clicked anything at all.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Come back after a few more test runs — this dialog will quietly disappear once the
            save flow has been verified end-to-end.
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
