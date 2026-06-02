'use client';

// Hidden-by-default overlay for the IMU 3D viewer's lighting look. A small icon
// button sits in the top-right of the canvas; clicking it reveals a compact
// panel to switch the tone mapper and fine-tune exposure / IBL intensity. All
// values live in the persisted uiStore, so the in-canvas ToneController applies
// them live and the choice survives reloads. Rendered as an absolutely
// positioned sibling of the <Canvas> (inside the same eventSource container).

import {ToneMappingMode, useUiStore} from '@/stores/uiStore';
import {Close as CloseIcon, RestartAlt as ResetIcon, Tune as TuneIcon} from '@mui/icons-material';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {useState} from 'react';

const TONE_OPTIONS: {value: ToneMappingMode; label: string}[] = [
  {value: 'neutral', label: 'Khronos PBR Neutral'},
  {value: 'agx', label: 'AgX (Blender 4.x)'},
  {value: 'aces', label: 'ACES Filmic'},
  {value: 'reinhard', label: 'Reinhard'},
  {value: 'cineon', label: 'Cineon'},
  {value: 'linear', label: 'Linear'},
  {value: 'none', label: 'None'},
];

// One axis row for the model-orientation offsets: a labelled slider plus a
// narrow numeric field, kept in sync. Both feed the same store setter, which
// clamps to [-180, 180] — so we don't clamp here.
function OffsetRow({label, value, onChange}: {label: string; value: number; onChange: (v: number) => void}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" color="text.secondary" sx={{width: 12}}>
        {label}
      </Typography>
      <Slider
        value={value}
        onChange={(_, v) => typeof v === 'number' && onChange(v)}
        min={-180}
        max={180}
        step={1}
        size="small"
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v}°`}
        sx={{flex: 1}}
      />
      <TextField
        size="small"
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        slotProps={{htmlInput: {min: -180, max: 180, step: 1}}}
        sx={{width: 64}}
      />
    </Stack>
  );
}

export default function LookControls() {
  const [open, setOpen] = useState(false);
  const toneMapping = useUiStore((s) => s.imuToneMapping);
  const setToneMapping = useUiStore((s) => s.setImuToneMapping);
  const exposure = useUiStore((s) => s.imuExposure);
  const setExposure = useUiStore((s) => s.setImuExposure);
  const envIntensity = useUiStore((s) => s.imuEnvIntensity);
  const setEnvIntensity = useUiStore((s) => s.setImuEnvIntensity);
  const resetLook = useUiStore((s) => s.resetImuLook);
  const offsetX = useUiStore((s) => s.imuModelOffsetX);
  const offsetY = useUiStore((s) => s.imuModelOffsetY);
  const offsetZ = useUiStore((s) => s.imuModelOffsetZ);
  const setOffsetX = useUiStore((s) => s.setImuModelOffsetX);
  const setOffsetY = useUiStore((s) => s.setImuModelOffsetY);
  const setOffsetZ = useUiStore((s) => s.setImuModelOffsetZ);
  const resetOffset = useUiStore((s) => s.resetImuModelOffset);

  return (
    <Box sx={{position: 'absolute', top: 8, right: 8, zIndex: 2}}>
      {!open && (
        <Tooltip title="Lighting & look">
          <IconButton
            size="small"
            onClick={() => setOpen(true)}
            aria-label="Open lighting and look controls"
            sx={{
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': {bgcolor: 'background.paper'},
            }}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Collapse in={open} unmountOnExit>
        <Paper elevation={4} sx={{p: 1.5, width: 260}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
            <Typography variant="subtitle2" fontWeight={600}>
              Lighting & look
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Reset to defaults">
                <IconButton size="small" onClick={resetLook} aria-label="Reset look to defaults">
                  <ResetIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close look controls">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          <TextField
            select
            fullWidth
            size="small"
            label="Tone mapping"
            value={toneMapping}
            onChange={(e) => setToneMapping(e.target.value as ToneMappingMode)}
            sx={{mb: 1.5}}
          >
            {TONE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="caption" color="text.secondary">
            Exposure
          </Typography>
          <Slider
            value={exposure}
            onChange={(_, v) => typeof v === 'number' && setExposure(v)}
            min={0.2}
            max={2}
            step={0.05}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => v.toFixed(2)}
          />

          <Typography variant="caption" color="text.secondary">
            IBL intensity
          </Typography>
          <Slider
            value={envIntensity}
            onChange={(_, v) => typeof v === 'number' && setEnvIntensity(v)}
            min={0}
            max={2}
            step={0.05}
            size="small"
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => v.toFixed(2)}
          />

          <Divider sx={{my: 1.5}} />

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 0.5}}>
            <Typography variant="caption" color="text.secondary">
              Model orientation
            </Typography>
            <Tooltip title="Reset orientation offsets">
              <IconButton size="small" onClick={resetOffset} aria-label="Reset model orientation offsets">
                <ResetIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack spacing={0.5}>
            <OffsetRow label="X" value={offsetX} onChange={setOffsetX} />
            <OffsetRow label="Y" value={offsetY} onChange={setOffsetY} />
            <OffsetRow label="Z" value={offsetZ} onChange={setOffsetZ} />
          </Stack>
        </Paper>
      </Collapse>
    </Box>
  );
}
