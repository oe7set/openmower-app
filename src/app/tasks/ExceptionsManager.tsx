'use client';

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import type {MowingExceptions} from './types';

interface ExceptionsManagerProps {
  initial: MowingExceptions;
  onCancel: () => void;
  onSave: (e: MowingExceptions) => void;
}

// A small, country-agnostic editor. The country/subdiv are free-text codes
// (ISO 3166-1 alpha-2 + optional subdivision) validated server-side against the
// holidays database, so we keep the input simple rather than shipping a 500-
// country picker. Blocking days are added one date at a time.
export default function ExceptionsManager({initial, onCancel, onSave}: ExceptionsManagerProps) {
  const [country, setCountry] = useState(initial.country ?? '');
  const [subdiv, setSubdiv] = useState(initial.subdiv ?? '');
  const [days, setDays] = useState<string[]>(initial.blocking_days ?? []);
  const [newDay, setNewDay] = useState('');

  const addDay = () => {
    if (!newDay) return;
    if (!days.includes(newDay)) {
      setDays([...days, newDay].sort());
    }
    setNewDay('');
  };

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Blocking days &amp; holidays</DialogTitle>
      <DialogContent>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1}}>
          <Typography variant="body2" color="text.secondary">
            Mowing is skipped on public holidays of the chosen country/region and on any manual
            blocking days below.
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
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave({country: country.trim(), subdiv: subdiv.trim(), blocking_days: days})}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
