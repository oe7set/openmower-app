'use client';

import {ACCENT_PRESETS} from '@/stores/uiStore';
import {Box, ButtonBase, TextField, Tooltip} from '@mui/material';

interface AccentPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** Limit which presets to show; defaults to all of them. */
  presets?: Array<{label: string; value: string}>;
}

const DEFAULT_PRESETS: Array<{label: string; value: string}> = [
  {label: 'Forest', value: ACCENT_PRESETS.forest},
  {label: 'Ocean', value: ACCENT_PRESETS.ocean},
  {label: 'Sunset', value: ACCENT_PRESETS.sunset},
  {label: 'Violet', value: ACCENT_PRESETS.violet},
  {label: 'Mono', value: ACCENT_PRESETS.mono},
];

// Reusable colour picker: a row of preset swatches plus a native colour
// input for arbitrary hex. Used by the global accent setting and the
// per-mower colour list — the second case passes a slightly different
// preset list but the controls are identical.
export function AccentPicker({value, onChange, presets = DEFAULT_PRESETS}: AccentPickerProps) {
  const lower = value.toLowerCase();
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
      {presets.map((p) => {
        const active = p.value.toLowerCase() === lower;
        return (
          <Tooltip key={p.value} title={p.label}>
            <ButtonBase
              onClick={() => onChange(p.value)}
              aria-label={`Set accent to ${p.label}`}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: p.value,
                border: active
                  ? `2px solid ${p.value}`
                  : '2px solid transparent',
                outline: active ? '2px solid rgba(255,255,255,0.85)' : 'none',
                outlineOffset: -4,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.18)',
              }}
            />
          </Tooltip>
        );
      })}
      <TextField
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size="small"
        sx={{
          width: 56,
          ml: 1,
          '& input[type="color"]': {padding: 0, height: 28, cursor: 'pointer'},
        }}
        inputProps={{'aria-label': 'Custom accent hex'}}
      />
    </Box>
  );
}
