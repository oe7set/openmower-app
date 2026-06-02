'use client';

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {Add as AddIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {useState} from 'react';
import type {BlockWindow, MowingExceptions} from './types';
import TimeWindowFields from './TimeWindowFields';
import {detectTimezone} from './timezone';
import {describeBlockWindow} from './blockWindows';

interface ExceptionsManagerProps {
  initial: MowingExceptions;
  onCancel: () => void;
  // May be async; rejecting keeps the dialog open so the user can retry.
  onSave: (e: MowingExceptions) => void | Promise<void>;
}

// A small, country-agnostic editor. The country/subdiv are free-text codes
// (ISO 3166-1 alpha-2 + optional subdivision) validated server-side against the
// holidays database, so we keep the input simple rather than shipping a 500-
// country picker. Blocking days are added one date at a time; block windows are
// recurring time-of-day ranges (e.g. nightly 20:00–08:00) that hard-stop mowing.
export default function ExceptionsManager({initial, onCancel, onSave}: ExceptionsManagerProps) {
  const [country, setCountry] = useState(initial.country ?? '');
  const [subdiv, setSubdiv] = useState(initial.subdiv ?? '');
  const [days, setDays] = useState<string[]>(initial.blocking_days ?? []);
  const [newDay, setNewDay] = useState('');
  const [windows, setWindows] = useState<BlockWindow[]>(initial.block_windows ?? []);
  const [saving, setSaving] = useState(false);

  const addDay = () => {
    if (!newDay) return;
    if (!days.includes(newDay)) {
      setDays([...days, newDay].sort());
    }
    setNewDay('');
  };

  const addWindow = () => {
    setWindows([...windows, {start: '20:00', end: '08:00', days: []}]);
  };

  const updateWindow = (idx: number, patch: Partial<BlockWindow>) => {
    setWindows(windows.map((w, i) => (i === idx ? {...w, ...patch} : w)));
  };

  const removeWindow = (idx: number) => {
    setWindows(windows.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        country: country.trim(),
        subdiv: subdiv.trim(),
        blocking_days: days,
        // Persist the block-window times against a concrete zone so the backend
        // interprets them in the owner's local time, not UTC.
        timezone: initial.timezone || detectTimezone(),
        block_windows: windows
          .filter((w) => w.start && w.end)
          // Drop an empty days array so "every day" stays the implicit default.
          .map((w) => (w.days && w.days.length > 0 ? w : {start: w.start, end: w.end})),
      });
      // Success closes the dialog from the parent; failure rejects and we
      // re-enable the form for a retry.
    } catch {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Blocking days, holidays &amp; windows</DialogTitle>
      <DialogContent>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1}}>
          <Typography variant="body2" color="text.secondary">
            Mowing is skipped on public holidays of the chosen country/region, on any manual blocking
            days, and during the recurring block windows below.
          </Typography>
          <Box sx={{display: 'flex', gap: 2}}>
            <TextField
              label="Country code"
              placeholder="DE"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              inputProps={{maxLength: 2, style: {textTransform: 'uppercase'}}}
              sx={{flex: 1}}
              helperText="ISO code, e.g. DE, AT, US"
            />
            <TextField
              label="Region"
              placeholder="BY"
              value={subdiv}
              onChange={(e) => setSubdiv(e.target.value.toUpperCase())}
              sx={{flex: 1}}
              helperText="Optional, e.g. BY"
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{mb: 1}}>
              Manual blocking days
            </Typography>
            <Box sx={{display: 'flex', gap: 1, mb: 1}}>
              <TextField
                type="date"
                size="small"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                InputLabelProps={{shrink: true}}
                sx={{flex: 1}}
              />
              <Button onClick={addDay} disabled={!newDay} variant="outlined">
                Add
              </Button>
            </Box>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
              {days.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No blocking days yet.
                </Typography>
              ) : (
                days.map((d) => (
                  <Chip
                    key={d}
                    size="small"
                    label={d}
                    onDelete={() => setDays(days.filter((x) => x !== d))}
                  />
                ))
              )}
            </Box>
          </Box>

          <Divider />

          <Box>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
              <Typography variant="subtitle2">Block time windows</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addWindow}>
                Add window
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1.5}}>
              Mowing is hard-stopped during these windows (the mower returns home and does not restart
              until the window ends). An end time before the start crosses midnight, e.g. 20:00–08:00.
            </Typography>
            {windows.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No block windows yet.
              </Typography>
            ) : (
              <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                {windows.map((w, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      position: 'relative',
                    }}
                  >
                    <Box sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1}}>
                      <Chip size="small" label={describeBlockWindow(w)} />
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Remove window"
                        onClick={() => removeWindow(idx)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <TimeWindowFields
                      start={w.start}
                      end={w.end}
                      days={w.days ?? []}
                      onChange={(patch) => updateWindow(idx, patch)}
                      daysHint="Leave all unselected to block every day."
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
