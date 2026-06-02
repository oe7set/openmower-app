'use client';

import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {useMemo, useState} from 'react';
import {useMowDefaults} from '@/hooks/useMowDefaults';
import MowOverridesFields from './MowParamFields';
import type {ScheduleOverrides} from './ScheduleEditor';

interface StartMowingDialogProps {
  onClose: () => void;
  // Pre-select a single mowing area (used by the map area popup). When omitted
  // the user starts with "all active areas" and can pick a subset.
  defaultAreaIndex?: number;
}

// Ad-hoc "mow now" dialog: pick areas + per-run parameters, then dispatch
// mower.start_mowing. Reused from the Tasks page, the map area popup and the
// dashboard quick actions so a manual run is configured the same way everywhere.
export default function StartMowingDialog({onClose, defaultAreaIndex}: StartMowingDialogProps) {
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);
  const areas = useSelectedMower((s) => s?.map.areas ?? []);
  const {defaults} = useMowDefaults();

  const mowingAreas = useMemo(
    () =>
      areas
        .filter((a) => a.properties.type === 'mow')
        .map((a, mowIdx) => ({
          mowingIndex: mowIdx,
          label: a.properties.name?.trim() || `Mowing area ${mowIdx}`,
        })),
    [areas],
  );

  const [selected, setSelected] = useState<number[]>(
    defaultAreaIndex != null && defaultAreaIndex >= 0 ? [defaultAreaIndex] : [],
  );
  const [overrides, setOverrides] = useState<ScheduleOverrides>({});
  const [limitDuration, setLimitDuration] = useState(false);
  const [duration, setDuration] = useState(60);
  const [pending, setPending] = useState(false);

  const updateOverrides = (patch: Partial<ScheduleOverrides>) =>
    setOverrides((o) => {
      const next = {...o, ...patch};
      // Drop keys explicitly set back to undefined so the payload stays clean.
      for (const k of Object.keys(patch) as (keyof ScheduleOverrides)[]) {
        if (patch[k] === undefined) delete next[k];
      }
      return next;
    });

  const start = async () => {
    if (!rpc) return;
    setPending(true);
    try {
      await rpc.mower.start_mowing({
        areas: selected,
        overrides: overrides as never,
        duration_minutes: limitDuration ? duration : 0,
      });
      toast.success(selected.length > 0 ? 'Starting selected area(s)…' : 'Starting all active areas…');
      onClose();
    } catch (e) {
      toast.error(`Could not start: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Mow now</DialogTitle>
      <DialogContent>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1}}>
          <FormControl fullWidth>
            <InputLabel id="start-areas-label">Mowing areas</InputLabel>
            <Select
              labelId="start-areas-label"
              multiple
              value={selected}
              label="Mowing areas"
              onChange={(e) => {
                const v = e.target.value;
                setSelected(typeof v === 'string' ? v.split(',').map(Number) : (v as number[]));
              }}
              renderValue={(sel) => (
                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                  {(sel as number[]).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      All active areas
                    </Typography>
                  ) : (
                    (sel as number[]).map((idx) => (
                      <Chip
                        key={idx}
                        size="small"
                        label={mowingAreas.find((a) => a.mowingIndex === idx)?.label ?? `#${idx}`}
                      />
                    ))
                  )}
                </Box>
              )}
            >
              {mowingAreas.length === 0 ? (
                <MenuItem disabled>No mowing areas on the connected mower</MenuItem>
              ) : (
                mowingAreas.map((a) => (
                  <MenuItem key={a.mowingIndex} value={a.mowingIndex}>
                    <Checkbox checked={selected.includes(a.mowingIndex)} />
                    <ListItemText primary={a.label} />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{mb: 1}}>
              Mowing parameters
            </Typography>
            <MowOverridesFields overrides={overrides} onChange={updateOverrides} defaults={defaults} />
          </Box>

          <Divider />

          <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
            <FormControlLabel
              sx={{minWidth: 120, m: 0}}
              control={
                <Switch size="small" checked={limitDuration} onChange={(e) => setLimitDuration(e.target.checked)} />
              }
              label={<Typography variant="body2">Time limit</Typography>}
            />
            <Box sx={{flex: 1, opacity: limitDuration ? 1 : 0.4, pointerEvents: limitDuration ? 'auto' : 'none'}}>
              {limitDuration ? (
                <TextField
                  label="Stop after (min)"
                  type="number"
                  size="small"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  inputProps={{min: 1}}
                  sx={{width: 200}}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Run until finished
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={start} disabled={pending || !rpc}>
          {pending ? '…' : 'Start mowing'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
