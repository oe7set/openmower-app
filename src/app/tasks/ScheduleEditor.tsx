'use client';

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
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {useMemo, useState} from 'react';
import {DEFAULT_RRULE_PARTS, partsToRrule, rruleToParts, WEEKDAYS, type Frequency} from './rrule';

export interface Schedule {
  id?: string;
  name: string;
  enabled: boolean;
  areas: number[];
  rrule: string;
  duration_minutes: number;
  timezone: string;
  weather?: {skip_if_rain?: boolean};
  pattern?: {angle_offset?: number; rotate_by_days?: number};
  // Read-only fields populated by the scheduler.
  next_run?: string | null;
  last_fired_at?: string | null;
  last_skip_reason?: 'no_state' | 'emergency' | 'not_idle' | 'charging' | 'rain' | null;
  last_skip_at?: string | null;
}

interface ScheduleEditorProps {
  initial: Schedule;
  onCancel: () => void;
  onSave: (s: Schedule) => void;
}

export default function ScheduleEditor({initial, onCancel, onSave}: ScheduleEditorProps) {
  const [draft, setDraft] = useState<Schedule>(initial);
  // Decompose the RRULE for the form; the recomposed value is derived (not
  // mirrored into draft) so the form fields stay the single source of truth
  // and we avoid an effect-driven cascade on every keystroke.
  const [parts, setParts] = useState(() => rruleToParts(initial.rrule || partsToRrule(DEFAULT_RRULE_PARTS)));
  const rrule = useMemo(() => partsToRrule(parts), [parts]);

  const update = (patch: Partial<Schedule>) => setDraft((d) => ({...d, ...patch}));

  // Pull the live mowing-area list from the selected mower so users can pick
  // areas by name rather than having to know their indices.
  const areas = useSelectedMower((s) => s?.map.areas ?? []);
  const mowingAreas = areas
    .map((a, idx) => ({...a, _allIdx: idx}))
    .filter((a) => a.properties.type === 'mow')
    .map((a, mowIdx) => ({
      mowingIndex: mowIdx,
      label: a.properties.name?.trim() || `Mowing area ${mowIdx}`,
    }));

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{initial.id ? 'Edit schedule' : 'New schedule'}</DialogTitle>
      <DialogContent>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1}}>
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => update({name: e.target.value})}
            fullWidth
            required
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
              Repeats
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={parts.freq}
              onChange={(_, v: Frequency | null) => v && setParts({...parts, freq: v})}
            >
              <ToggleButton value="DAILY">Daily</ToggleButton>
              <ToggleButton value="WEEKLY">Weekly</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {parts.freq === 'WEEKLY' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
                On these days
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={parts.byDays}
                onChange={(_, v) => setParts({...parts, byDays: v})}
                aria-label="Days of week"
              >
                {WEEKDAYS.map((d) => (
                  <ToggleButton key={d.key} value={d.key}>
                    {d.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          <Box sx={{display: 'flex', gap: 2}}>
            <TextField
              label="Hour"
              type="number"
              value={parts.hour}
              onChange={(e) => setParts({...parts, hour: clamp(parseInt(e.target.value, 10), 0, 23)})}
              inputProps={{min: 0, max: 23}}
              sx={{flex: 1}}
            />
            <TextField
              label="Minute"
              type="number"
              value={parts.minute}
              onChange={(e) => setParts({...parts, minute: clamp(parseInt(e.target.value, 10), 0, 59)})}
              inputProps={{min: 0, max: 59}}
              sx={{flex: 1}}
            />
            <TextField
              label="Duration (min)"
              type="number"
              value={draft.duration_minutes}
              onChange={(e) => update({duration_minutes: parseInt(e.target.value, 10) || 0})}
              inputProps={{min: 1}}
              sx={{flex: 1}}
              required
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel id="areas-label">Mowing areas</InputLabel>
            <Select
              labelId="areas-label"
              multiple
              value={draft.areas}
              onChange={(e) => {
                const v = e.target.value;
                update({areas: typeof v === 'string' ? v.split(',').map(Number) : (v as number[])});
              }}
              label="Mowing areas"
              renderValue={(selected) => (
                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                  {(selected as number[]).map((idx) => (
                    <Chip
                      key={idx}
                      size="small"
                      label={mowingAreas.find((a) => a.mowingIndex === idx)?.label ?? `#${idx}`}
                    />
                  ))}
                </Box>
              )}
            >
              {mowingAreas.length === 0 ? (
                <MenuItem disabled>No mowing areas on the connected mower</MenuItem>
              ) : (
                mowingAreas.map((a) => (
                  <MenuItem key={a.mowingIndex} value={a.mowingIndex}>
                    <Checkbox checked={draft.areas.includes(a.mowingIndex)} />
                    <ListItemText primary={a.label} />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Switch checked={draft.enabled} onChange={(e) => update({enabled: e.target.checked})} />
            <Typography variant="body2">Enabled</Typography>
          </Box>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Switch
              checked={draft.weather?.skip_if_rain ?? false}
              onChange={(e) => update({weather: {skip_if_rain: e.target.checked}})}
            />
            <Typography variant="body2">Skip if rain detected</Typography>
          </Box>

          <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
            <Chip size="small" label={`Timezone: ${draft.timezone}`} />
            <Typography variant="caption" color="text.secondary">
              Times above are interpreted in this zone.
            </Typography>
          </Box>

          <Typography variant="caption" color="text.disabled" sx={{fontFamily: 'monospace', wordBreak: 'break-all'}}>
            {rrule}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave({...draft, rrule})}
          disabled={!draft.name || !rrule || draft.duration_minutes <= 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
