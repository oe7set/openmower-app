'use client';

import {MAP_OVERLAY_TELEOP} from '@/components/map/zIndex';
import {useUiStore, type PilotSensorPosition} from '@/stores/uiStore';
import {
  Box,
  Checkbox,
  ClickAwayListener,
  Divider,
  FormControlLabel,
  Paper,
  Popper,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {useCallback} from 'react';
import {PILOT_METRICS} from './sensorMetrics';

// Settings panel for the Pilot page's sensor bar. Implemented as a non-modal
// Popper (not a Popover/Modal) on purpose: a Modal mounts a full-viewport
// backdrop that swallows all pointer input while open, which would freeze the
// joystick and map on this overlay-heavy page. The Popper floats without a
// backdrop, so the live controls stay usable while the panel is open, and a
// ClickAwayListener dismisses it when the user taps elsewhere. Everything
// writes straight into uiStore, so changes apply live and persist.

interface SensorBarConfigProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

export default function SensorBarConfig({anchorEl, open, onClose}: SensorBarConfigProps) {
  const rows = useUiStore((s) => s.pilotSensorRows);
  const setRows = useUiStore((s) => s.setPilotSensorRows);
  const position = useUiStore((s) => s.pilotSensorPosition);
  const setPosition = useUiStore((s) => s.setPilotSensorPosition);
  const opacity = useUiStore((s) => s.pilotSensorOpacity);
  const setOpacity = useUiStore((s) => s.setPilotSensorOpacity);
  const metricIds = useUiStore((s) => s.pilotSensorMetricIds);
  const setMetricIds = useUiStore((s) => s.setPilotSensorMetricIds);

  const toggleMetric = useCallback(
    (id: string, enabled: boolean) => {
      if (enabled) {
        // Preserve catalog order when re-enabling so the bar stays tidy.
        const order = PILOT_METRICS.map((m) => m.id);
        const next = [...metricIds, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        setMetricIds(next);
      } else {
        setMetricIds(metricIds.filter((m) => m !== id));
      }
    },
    [metricIds, setMetricIds],
  );

  if (!open) return null;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="bottom-end"
      // Sit above the teleop layer so the panel itself is interactive, but as a
      // Popper it doesn't block the rest of the page.
      sx={{zIndex: MAP_OVERLAY_TELEOP + 1}}
      modifiers={[{name: 'offset', options: {offset: [0, 8]}}]}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper elevation={8} sx={{p: 2, width: 280, maxHeight: '70vh', overflowY: 'auto'}}>
          <Typography variant="subtitle2" fontWeight={700} sx={{mb: 1}}>
            Sensor bar
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Layout
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={rows}
            onChange={(_, v) => v != null && setRows(v as 1 | 2 | 'multi')}
            sx={{mt: 0.5, mb: 1.5}}
          >
            <ToggleButton value={1}>1 row</ToggleButton>
            <ToggleButton value={2}>2 rows</ToggleButton>
            <ToggleButton value="multi">Multi</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            Position
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={position}
            onChange={(_, v) => v && setPosition(v as PilotSensorPosition)}
            sx={{mt: 0.5, mb: 1.5}}
          >
            <ToggleButton value="floating">Float</ToggleButton>
            <ToggleButton value="top">Top</ToggleButton>
            <ToggleButton value="bottom">Bottom</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            Transparency
          </Typography>
          <Box sx={{px: 0.5, mb: 1}}>
            <Slider
              size="small"
              min={0.2}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(_, v) => setOpacity(v as number)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
            />
          </Box>

          <Divider sx={{my: 1}} />

          <Typography variant="caption" color="text.secondary">
            Values
          </Typography>
          <Box sx={{display: 'flex', flexDirection: 'column', mt: 0.5}}>
            {PILOT_METRICS.map((m) => (
              <FormControlLabel
                key={m.id}
                control={
                  <Checkbox
                    size="small"
                    checked={metricIds.includes(m.id)}
                    onChange={(e) => toggleMetric(m.id, e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{m.label}</Typography>}
                sx={{ml: 0, '& .MuiCheckbox-root': {py: 0.25}}}
              />
            ))}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
