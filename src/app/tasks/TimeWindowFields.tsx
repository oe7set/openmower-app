'use client';

import {Box, TextField, ToggleButton, ToggleButtonGroup, Typography} from '@mui/material';
import {WEEKDAYS} from './rrule';

// Shared start/end time + weekday picker, used by both the schedule time-window
// editor and the recurring block-window editor. Keeping a single widget means
// the two features look and behave identically.
export interface TimeWindowFieldsProps {
  start?: string;
  end?: string;
  days: string[];
  onChange: (patch: {start?: string; end?: string; days?: string[]}) => void;
  // Hint shown under the day picker, e.g. to explain that empty = every day.
  daysHint?: string;
}

export default function TimeWindowFields({start, end, days, onChange, daysHint}: TimeWindowFieldsProps) {
  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
      <Box sx={{display: 'flex', gap: 2}}>
        <TextField
          label="Start"
          type="time"
          value={start ?? '08:00'}
          onChange={(e) => onChange({start: e.target.value})}
          InputLabelProps={{shrink: true}}
          sx={{flex: 1}}
        />
        <TextField
          label="End"
          type="time"
          value={end ?? '20:00'}
          onChange={(e) => onChange({end: e.target.value})}
          InputLabelProps={{shrink: true}}
          sx={{flex: 1}}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
          Active on
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={days}
          onChange={(_, v: string[]) => onChange({days: v})}
          aria-label="Active days"
        >
          {WEEKDAYS.map((d) => (
            <ToggleButton key={d.key} value={d.key}>
              {d.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {daysHint && (
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
            {daysHint}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
