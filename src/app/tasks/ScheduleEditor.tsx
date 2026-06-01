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
  Divider,
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
import {
  DEFAULT_RRULE_PARTS,
  describeRrule,
  partsToRrule,
  rruleToParts,
  WEEKDAYS,
  type Frequency,
  type RruleParts,
  type Weekday,
} from './rrule';
import MowOverridesFields from './MowParamFields';
import TimeWindowFields from './TimeWindowFields';

export type ScheduleMode = 'time_area' | 'time_window' | 'continuous';
export type MowPattern = 'linear' | 'concentric_lines' | 'concentric_circle' | 'hilbert';

export interface ScheduleWindow {
  start?: string;
  end?: string;
  days?: string[];
  area_wait_minutes?: number;
}

export interface ScheduleOverrides {
  speed_mps?: number;
  pattern?: MowPattern;
  angle_deg?: number;
  outline_count?: number;
}

export interface Schedule {
  id?: string;
  name: string;
  enabled: boolean;
  mode?: ScheduleMode;
  areas: number[];
  rrule: string;
  exdates?: string[];
  duration_minutes: number;
  timezone: string;
  window?: ScheduleWindow;
  weather?: {skip_if_rain?: boolean};
  overrides?: ScheduleOverrides;
  // Deprecated; migrated server-side into overrides.angle_deg.
  pattern?: {angle_offset?: number; rotate_by_days?: number};
  // Read-only fields populated by the scheduler.
  next_run?: string | null;
  last_fired_at?: string | null;
  last_skip_reason?:
    | 'no_state'
    | 'emergency'
    | 'not_idle'
    | 'charging'
    | 'rain'
    | 'blocked'
    | 'holiday'
    | 'block_window'
    | null;
  last_skip_at?: string | null;
}

interface ScheduleEditorProps {
  initial: Schedule;
  onCancel: () => void;
  onSave: (s: Schedule) => void;
}

const MODES: ReadonlyArray<{value: ScheduleMode; label: string; hint: string}> = [
  {value: 'time_area', label: 'Time / Area', hint: 'Mow specific areas at a scheduled time.'},
  {value: 'time_window', label: 'Time window', hint: 'Mow within a daily window, resuming where it left off.'},
  {value: 'continuous', label: '24/7', hint: 'Keep mowing all active areas, gated only by rain / blocking days.'},
];

export default function ScheduleEditor({initial, onCancel, onSave}: ScheduleEditorProps) {
  const [draft, setDraft] = useState<Schedule>(initial);
  // Decompose the RRULE for the form; the recomposed value is derived (not
  // mirrored into draft) so the form fields stay the single source of truth
  // and we avoid an effect-driven cascade on every keystroke.
  const [parts, setParts] = useState<RruleParts>(() =>
    rruleToParts(initial.rrule || partsToRrule(DEFAULT_RRULE_PARTS)),
  );
  const rrule = useMemo(() => partsToRrule(parts), [parts]);
  const mode: ScheduleMode = draft.mode ?? 'time_area';

  const update = (patch: Partial<Schedule>) => setDraft((d) => ({...d, ...patch}));
  const updateWindow = (patch: Partial<ScheduleWindow>) =>
    setDraft((d) => ({...d, window: {...d.window, ...patch}}));
  const updateOverrides = (patch: Partial<ScheduleOverrides>) =>
    setDraft((d) => ({...d, overrides: {...d.overrides, ...patch}}));

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

  const windowDays = draft.window?.days ?? [];

  const canSave =
    !!draft.name &&
    (mode === 'continuous' ||
      (mode === 'time_window'
        ? !!draft.window?.start && !!draft.window?.end
        : !!rrule && draft.duration_minutes > 0));

  const handleSave = () => {
    // Assemble the persisted shape per mode. We only attach the blocks the
    // backend needs for the chosen mode so the stored document stays clean.
    const out: Schedule = {...draft, mode};
    if (mode === 'time_area') {
      out.rrule = rrule;
    } else if (mode === 'time_window') {
      // The backend still requires a non-empty rrule (it is the "active days"
      // anchor); a daily rule keeps it valid while window.days does the gating.
      out.rrule = 'FREQ=DAILY';
    } else {
      // continuous: rrule is irrelevant but the contract requires the field.
      out.rrule = 'FREQ=DAILY';
    }
    onSave(out);
  };

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

          {/* Mode selector */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
              Mode
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_, v: ScheduleMode | null) => v && update({mode: v})}
              fullWidth
            >
              {MODES.map((m) => (
                <ToggleButton key={m.value} value={m.value}>
                  {m.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
              {MODES.find((m) => m.value === mode)?.hint}
            </Typography>
          </Box>

          {/* Recurrence — time_area only */}
          {mode === 'time_area' && (
            <RecurrenceBuilder parts={parts} setParts={setParts} duration={draft.duration_minutes} onDuration={(v) => update({duration_minutes: v})} />
          )}

          {/* Window — time_window only */}
          {mode === 'time_window' && (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
              <TimeWindowFields
                start={draft.window?.start}
                end={draft.window?.end}
                days={windowDays}
                onChange={updateWindow}
              />
              <TextField
                label="Wait between areas (min)"
                type="number"
                size="small"
                value={draft.window?.area_wait_minutes ?? 0}
                onChange={(e) => updateWindow({area_wait_minutes: clamp(parseInt(e.target.value, 10), 0, 1440)})}
                inputProps={{min: 0}}
                sx={{width: 220}}
              />
            </Box>
          )}

          {/* Areas — not used by continuous (mows all active) */}
          {mode !== 'continuous' && (
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
                    {(selected as number[]).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        All active areas
                      </Typography>
                    ) : (
                      (selected as number[]).map((idx) => (
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
                      <Checkbox checked={draft.areas.includes(a.mowingIndex)} />
                      <ListItemText primary={a.label} />
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}

          <Divider />

          {/* Per-appointment overrides */}
          <Box>
            <Typography variant="subtitle2" sx={{mb: 1}}>
              Mowing parameters
            </Typography>
            <MowOverridesFields overrides={draft.overrides} onChange={updateOverrides} />
          </Box>

          <Divider />

          {/* Common toggles */}
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

          {mode === 'time_area' && (
            <Typography variant="caption" color="text.secondary">
              {describeRrule(rrule)}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Recurrence builder ──────────────────────────────────────────────────────

function RecurrenceBuilder({
  parts,
  setParts,
  duration,
  onDuration,
}: {
  parts: RruleParts;
  setParts: (p: RruleParts) => void;
  duration: number;
  onDuration: (v: number) => void;
}) {
  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
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
          <ToggleButton value="MONTHLY">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{display: 'flex', gap: 2, alignItems: 'center'}}>
        <Typography variant="body2">Every</Typography>
        <TextField
          type="number"
          size="small"
          value={parts.interval}
          onChange={(e) => setParts({...parts, interval: clamp(parseInt(e.target.value, 10), 1, 999)})}
          inputProps={{min: 1, max: 999}}
          sx={{width: 90}}
        />
        <Typography variant="body2">
          {parts.freq === 'DAILY' ? 'day(s)' : parts.freq === 'WEEKLY' ? 'week(s)' : 'month(s)'}
        </Typography>
      </Box>

      {parts.freq === 'WEEKLY' && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
            On these days
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={parts.byDays}
            onChange={(_, v: Weekday[]) => setParts({...parts, byDays: v})}
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

      {parts.freq === 'MONTHLY' && (
        <TextField
          label="Day of month"
          type="number"
          size="small"
          value={parts.byMonthDay ?? 1}
          onChange={(e) => setParts({...parts, byMonthDay: clamp(parseInt(e.target.value, 10), 1, 31)})}
          inputProps={{min: 1, max: 31}}
          sx={{width: 140}}
        />
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
          value={duration}
          onChange={(e) => onDuration(parseInt(e.target.value, 10) || 0)}
          inputProps={{min: 1}}
          sx={{flex: 1}}
          required
        />
      </Box>

      {/* End condition */}
      <Box sx={{display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap'}}>
        <FormControl size="small" sx={{minWidth: 140}}>
          <InputLabel id="end-mode">Ends</InputLabel>
          <Select
            labelId="end-mode"
            label="Ends"
            value={parts.endMode}
            onChange={(e) => setParts({...parts, endMode: e.target.value as RruleParts['endMode']})}
          >
            <MenuItem value="never">Never</MenuItem>
            <MenuItem value="count">After N times</MenuItem>
            <MenuItem value="until">On date</MenuItem>
          </Select>
        </FormControl>
        {parts.endMode === 'count' && (
          <TextField
            label="Occurrences"
            type="number"
            size="small"
            value={parts.count ?? 10}
            onChange={(e) => setParts({...parts, count: clamp(parseInt(e.target.value, 10), 1, 9999)})}
            inputProps={{min: 1}}
            sx={{width: 140}}
          />
        )}
        {parts.endMode === 'until' && (
          <TextField
            label="Until"
            type="date"
            size="small"
            value={parts.until ?? ''}
            onChange={(e) => setParts({...parts, until: e.target.value})}
            InputLabelProps={{shrink: true}}
          />
        )}
      </Box>
    </Box>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
