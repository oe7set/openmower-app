'use client';

import {DEFAULT_MOW_DEFAULTS, type MowDefaults} from '@/hooks/useMowDefaults';
import type {AreaMowOverrides} from '@/utils/area-mow-params';
import {Box, FormControl, FormControlLabel, MenuItem, Select, Slider, Switch, Typography} from '@mui/material';
import {MOW_PATTERNS} from './patterns';
import type {MowPattern, ScheduleOverrides} from './ScheduleEditor';

// One labelled override: a toggle that, when off, falls back to the mower's
// global default (the field is omitted from the persisted overrides), and when
// on reveals the control. Shared by the schedule editor and the manual-start
// dialog so per-run parameters look identical everywhere. When `defaultLabel`
// is given the off-state shows the actual default value the run would use
// ("Default: 0.15 m/s") instead of a generic "Use default".
export function OverrideRow({
  label,
  on,
  onToggle,
  defaultLabel,
  children,
}: {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  defaultLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
      <FormControlLabel
        sx={{minWidth: 120, m: 0}}
        control={<Switch size="small" checked={on} onChange={(e) => onToggle(e.target.checked)} />}
        label={<Typography variant="body2">{label}</Typography>}
      />
      <Box sx={{flex: 1, opacity: on ? 1 : 0.4, pointerEvents: on ? 'auto' : 'none'}}>
        {on ? (
          children
        ) : (
          <Typography variant="body2" color="text.secondary">
            {defaultLabel ? `Default: ${defaultLabel}` : 'Use default'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// The full block of mowing-parameter override rows. The base rows (mowing speed,
// travel speed, fill pattern, absolute angle, outline passes) match the per-run
// ScheduleOverrides and are shown everywhere. The `extended` rows (outline
// overlap, outline offset, tool width) are per-area-only and shown when
// extended=true; travel speed is per-run-only and therefore hidden when
// extended. Each toggle omits its field when off so the backend uses the global
// default.
//
// `defaults` carries the mower's real effective defaults (from useMowDefaults).
// When provided, each off row shows that value and toggling a row on pre-fills
// the control with it. Falls back to DEFAULT_MOW_DEFAULTS so the controls still
// render before the fetch settles.
//
// Driven on the AreaMowOverrides superset so a single set of controls powers
// the schedule editor, the manual-start dialog and the per-area settings; when
// extended is false the extra keys are never emitted, keeping the schedule
// payload at exactly ScheduleOverrides.
export function MowParamRows({
  overrides,
  onChange,
  defaults = DEFAULT_MOW_DEFAULTS,
  extended = false,
}: {
  overrides: AreaMowOverrides | undefined;
  onChange: (patch: Partial<AreaMowOverrides>) => void;
  defaults?: MowDefaults;
  extended?: boolean;
}) {
  const speedOn = overrides?.speed_mps != null;
  const travelOn = overrides?.travel_speed_mps != null;
  const patternOn = overrides?.pattern != null;
  const angleOn = overrides?.angle_deg != null;
  const outlineOn = overrides?.outline_count != null;
  const overlapOn = overrides?.outline_overlap_count != null;
  const offsetOn = overrides?.outline_offset != null;
  const distanceOn = overrides?.distance != null;

  return (
    <Box>
      <OverrideRow
        label="Mowing speed"
        on={speedOn}
        defaultLabel={`${defaults.mowSpeedMps.toFixed(2)} m/s`}
        onToggle={(v) => onChange({speed_mps: v ? defaults.mowSpeedMps : undefined})}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
          <Slider
            size="small"
            min={0.1}
            max={1.0}
            step={0.05}
            value={overrides?.speed_mps ?? defaults.mowSpeedMps}
            onChange={(_, v) => onChange({speed_mps: v as number})}
            valueLabelDisplay="auto"
          />
          <Typography variant="body2" sx={{minWidth: 56}}>
            {(overrides?.speed_mps ?? defaults.mowSpeedMps).toFixed(2)} m/s
          </Typography>
        </Box>
      </OverrideRow>

      {/* Travel speed (FTC speed_fast) is per-run only — hidden in the per-area
          (extended) dialog where it has no stored field. */}
      {!extended && (
        <OverrideRow
          label="Travel speed"
          on={travelOn}
          defaultLabel={`${defaults.travelSpeedMps.toFixed(2)} m/s`}
          onToggle={(v) => onChange({travel_speed_mps: v ? defaults.travelSpeedMps : undefined})}
        >
          <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
            <Slider
              size="small"
              min={0.1}
              max={1.0}
              step={0.05}
              value={overrides?.travel_speed_mps ?? defaults.travelSpeedMps}
              onChange={(_, v) => onChange({travel_speed_mps: v as number})}
              valueLabelDisplay="auto"
            />
            <Typography variant="body2" sx={{minWidth: 56}}>
              {(overrides?.travel_speed_mps ?? defaults.travelSpeedMps).toFixed(2)} m/s
            </Typography>
          </Box>
        </OverrideRow>
      )}

      <OverrideRow label="Pattern" on={patternOn} onToggle={(v) => onChange({pattern: v ? 'linear' : undefined})}>
        <FormControl size="small" fullWidth>
          <Select
            value={overrides?.pattern ?? 'linear'}
            onChange={(e) => onChange({pattern: e.target.value as MowPattern})}
          >
            {MOW_PATTERNS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </OverrideRow>

      <OverrideRow
        label="Angle"
        on={angleOn}
        defaultLabel={`${Math.round(defaults.angleDeg)}°`}
        onToggle={(v) => onChange({angle_deg: v ? defaults.angleDeg : undefined})}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
          <Slider
            size="small"
            min={0}
            max={179}
            step={1}
            value={overrides?.angle_deg ?? defaults.angleDeg}
            onChange={(_, v) => onChange({angle_deg: v as number})}
            valueLabelDisplay="auto"
          />
          <Typography variant="body2" sx={{minWidth: 56}}>
            {Math.round(overrides?.angle_deg ?? defaults.angleDeg)}°
          </Typography>
        </Box>
      </OverrideRow>

      <OverrideRow
        label="Outline passes"
        on={outlineOn}
        defaultLabel={`${defaults.outlineCount}×`}
        onToggle={(v) => onChange({outline_count: v ? defaults.outlineCount : undefined})}
      >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
          <Slider
            size="small"
            min={0}
            max={10}
            step={1}
            marks
            value={overrides?.outline_count ?? defaults.outlineCount}
            onChange={(_, v) => onChange({outline_count: v as number})}
            valueLabelDisplay="auto"
          />
          <Typography variant="body2" sx={{minWidth: 56}}>
            {overrides?.outline_count ?? defaults.outlineCount}×
          </Typography>
        </Box>
      </OverrideRow>

      {extended && (
        <>
          <OverrideRow
            label="Outline overlap"
            on={overlapOn}
            onToggle={(v) => onChange({outline_overlap_count: v ? 0 : undefined})}
          >
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
              <Slider
                size="small"
                min={0}
                max={5}
                step={1}
                marks
                value={overrides?.outline_overlap_count ?? 0}
                onChange={(_, v) => onChange({outline_overlap_count: v as number})}
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" sx={{minWidth: 56}}>
                {overrides?.outline_overlap_count ?? 0}×
              </Typography>
            </Box>
          </OverrideRow>

          <OverrideRow
            label="Outline offset"
            on={offsetOn}
            onToggle={(v) => onChange({outline_offset: v ? 0 : undefined})}
          >
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
              <Slider
                size="small"
                min={-0.5}
                max={0.5}
                step={0.01}
                value={overrides?.outline_offset ?? 0}
                onChange={(_, v) => onChange({outline_offset: v as number})}
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" sx={{minWidth: 56}}>
                {(overrides?.outline_offset ?? 0).toFixed(2)} m
              </Typography>
            </Box>
          </OverrideRow>

          <OverrideRow label="Tool width" on={distanceOn} onToggle={(v) => onChange({distance: v ? 0.13 : undefined})}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, px: 1}}>
              <Slider
                size="small"
                min={0.1}
                max={0.5}
                step={0.01}
                value={overrides?.distance ?? 0.13}
                onChange={(_, v) => onChange({distance: v as number})}
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" sx={{minWidth: 56}}>
                {(overrides?.distance ?? 0.13).toFixed(2)} m
              </Typography>
            </Box>
          </OverrideRow>
        </>
      )}
    </Box>
  );
}

// The per-run override block (mowing/travel speed, fill pattern, absolute angle,
// outline passes) used by the schedule editor and the manual-start dialog. A
// thin adapter over MowParamRows that pins the type to ScheduleOverrides so the
// schedule payload never grows the per-area-only fields, and forwards the
// resolved global defaults so toggled-off rows show real values.
export default function MowOverridesFields({
  overrides,
  onChange,
  defaults,
}: {
  overrides: ScheduleOverrides | undefined;
  onChange: (patch: Partial<ScheduleOverrides>) => void;
  defaults?: MowDefaults;
}) {
  return <MowParamRows overrides={overrides} onChange={onChange} defaults={defaults} />;
}
