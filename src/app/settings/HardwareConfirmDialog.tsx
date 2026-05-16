import {Warning as WarningIcon} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';

interface HardwareConfirmDialogProps {
  open: boolean;
  affectedFields: Array<{label: string; path: string}>;
  onCancel: () => void;
  onConfirm: () => void;
}

// Surfaced just before meta.config.set when the pending changes touch any
// yaml-hw field (antenna offset, wheel base, encoder ticks, etc). These
// values change driving geometry — a typo can make the mower drift, miss
// the dock, or estimate the wrong heading without surfacing any error.
// Forcing a deliberate confirmation step is the cheapest brake we have.
export function HardwareConfirmDialog({open, affectedFields, onCancel, onConfirm}: HardwareConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', gap: 1}}>
        <WarningIcon color="warning" />
        Confirm hardware-geometry change
      </DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body2" sx={{mb: 2}}>
            You are about to save changes to hardware-specific values. These control physical
            geometry of the mower (wheel base, encoder ticks, GPS antenna offset, charging
            thresholds). Wrong values can make the mower drive in circles, miss the dock or
            estimate the wrong heading without any obvious error.
          </Typography>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'warning.light',
              borderRadius: 2,
              bgcolor: 'rgba(237, 108, 2, 0.05)',
              p: 1,
              mb: 2,
            }}
          >
            <Typography variant="caption" color="warning.main" sx={{fontWeight: 600, display: 'block', mb: 0.5, ml: 1}}>
              Changing
            </Typography>
            <List dense disablePadding>
              {affectedFields.map((f) => (
                <ListItem key={f.path} sx={{py: 0.25}}>
                  <ListItemText
                    primary={f.label}
                    secondary={f.path}
                    primaryTypographyProps={{variant: 'body2'}}
                    secondaryTypographyProps={{variant: 'caption', sx: {fontFamily: 'monospace'}}}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Use the per-field reset button if you are unsure — it restores the image-baked
            default for the selected mower model.
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="warning" variant="contained" onClick={onConfirm}>
          Save anyway
        </Button>
      </DialogActions>
    </Dialog>
  );
}
