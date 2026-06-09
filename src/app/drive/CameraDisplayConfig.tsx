'use client';

import {MAP_OVERLAY_TELEOP} from '@/components/map/zIndex';
import {
  DEFAULT_CAMERA_DISPLAY,
  type CameraAnchor,
  type CameraFit,
  type CameraRotation,
} from '@/components/camera/cameraDisplay';
import {
  useUiStore,
  type PilotLayout,
  type PilotMinimapCorner,
  type PilotMinimapSize,
} from '@/stores/uiStore';
import {
  Box,
  Button,
  ClickAwayListener,
  Divider,
  FormControlLabel,
  Paper,
  Popper,
  Slider,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

// Settings panel for the Pilot page's camera viewport and map layout. Same
// design as SensorBarConfig: a non-modal Popper (no full-viewport backdrop) so
// the joystick and map stay live while it's open, dismissed by a
// ClickAwayListener. Everything writes straight into uiStore, so changes apply
// live and persist.

interface CameraDisplayConfigProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  /** Whether a map exists — gates the Split/Minimap layout options. */
  hasMap: boolean;
}

const FITS: {value: CameraFit; label: string}[] = [
  {value: 'cover', label: 'Cover'},
  {value: 'contain', label: 'Contain'},
  {value: 'fill', label: 'Stretch'},
  {value: 'width', label: 'Fit W'},
  {value: 'height', label: 'Fit H'},
];

const ANCHORS: {value: CameraAnchor; label: string}[] = [
  {value: 'center', label: 'Center'},
  {value: 'top', label: 'Top'},
  {value: 'bottom', label: 'Bottom'},
  {value: 'left', label: 'Left'},
  {value: 'right', label: 'Right'},
];

const ROTATIONS: CameraRotation[] = [0, 90, 180, 270];

const CORNERS: {value: PilotMinimapCorner; label: string}[] = [
  {value: 'top-left', label: 'TL'},
  {value: 'top-right', label: 'TR'},
  {value: 'bottom-left', label: 'BL'},
  {value: 'bottom-right', label: 'BR'},
];

export default function CameraDisplayConfig({anchorEl, open, onClose, hasMap}: CameraDisplayConfigProps) {
  const layout = useUiStore((s) => s.pilotLayout);
  const setLayout = useUiStore((s) => s.setPilotLayout);
  const minimapCorner = useUiStore((s) => s.pilotMinimapCorner);
  const setMinimapCorner = useUiStore((s) => s.setPilotMinimapCorner);
  const minimapSize = useUiStore((s) => s.pilotMinimapSize);
  const setMinimapSize = useUiStore((s) => s.setPilotMinimapSize);
  const display = useUiStore((s) => s.pilotCameraDisplay);
  const setDisplay = useUiStore((s) => s.setPilotCameraDisplay);

  if (!open) return null;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="bottom-end"
      sx={{zIndex: MAP_OVERLAY_TELEOP + 1}}
      modifiers={[{name: 'offset', options: {offset: [0, 8]}}]}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper elevation={8} sx={{p: 2, width: 300, maxHeight: '70vh', overflowY: 'auto'}}>
          <Typography variant="subtitle2" fontWeight={700} sx={{mb: 1}}>
            Camera & layout
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Layout
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={layout}
            onChange={(_, v: PilotLayout | null) => v && setLayout(v)}
            sx={{mt: 0.5, mb: 1.5}}
          >
            <ToggleButton value="overlay">Overlay</ToggleButton>
            <ToggleButton value="split" disabled={!hasMap}>
              Split
            </ToggleButton>
            <ToggleButton value="minimap" disabled={!hasMap}>
              Minimap
            </ToggleButton>
          </ToggleButtonGroup>

          {layout === 'minimap' && (
            <>
              <Typography variant="caption" color="text.secondary">
                Minimap corner
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={minimapCorner}
                onChange={(_, v: PilotMinimapCorner | null) => v && setMinimapCorner(v)}
                sx={{mt: 0.5, mb: 1.5}}
              >
                {CORNERS.map((c) => (
                  <ToggleButton key={c.value} value={c.value}>
                    {c.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Typography variant="caption" color="text.secondary">
                Minimap size
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={minimapSize}
                onChange={(_, v: PilotMinimapSize | null) => v && setMinimapSize(v)}
                sx={{mt: 0.5, mb: 1.5}}
              >
                <ToggleButton value="sm">Small</ToggleButton>
                <ToggleButton value="md">Medium</ToggleButton>
                <ToggleButton value="lg">Large</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}

          <Divider sx={{my: 1}} />

          <Typography variant="caption" color="text.secondary">
            Camera fit
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={display.fit}
            onChange={(_, v: CameraFit | null) => v && setDisplay({fit: v})}
            sx={{mt: 0.5, mb: 1.5, flexWrap: 'wrap'}}
          >
            {FITS.map((f) => (
              <ToggleButton key={f.value} value={f.value}>
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            Position
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={display.anchor}
            onChange={(_, v: CameraAnchor | null) => v && setDisplay({anchor: v})}
            sx={{mt: 0.5, mb: 1.5, flexWrap: 'wrap'}}
          >
            {ANCHORS.map((a) => (
              <ToggleButton key={a.value} value={a.value}>
                {a.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">
            Rotation
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={display.rotation}
            onChange={(_, v: CameraRotation | null) => v != null && setDisplay({rotation: v})}
            sx={{mt: 0.5, mb: 1}}
          >
            {ROTATIONS.map((r) => (
              <ToggleButton key={r} value={r}>
                {r}°
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Box sx={{display: 'flex', flexDirection: 'column'}}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={display.mirrorH}
                  onChange={(e) => setDisplay({mirrorH: e.target.checked})}
                />
              }
              label={<Typography variant="body2">Mirror horizontal</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={display.mirrorV}
                  onChange={(e) => setDisplay({mirrorV: e.target.checked})}
                />
              }
              label={<Typography variant="body2">Flip vertical</Typography>}
            />
          </Box>

          <Typography variant="caption" color="text.secondary">
            Zoom
          </Typography>
          <Box sx={{px: 0.5, mb: 1}}>
            <Slider
              size="small"
              min={1}
              max={3}
              step={0.1}
              value={display.zoom}
              onChange={(_, v) => setDisplay({zoom: v as number})}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `×${v.toFixed(1)}`}
            />
          </Box>

          <Divider sx={{my: 1}} />

          <Button size="small" fullWidth onClick={() => setDisplay(DEFAULT_CAMERA_DISPLAY)}>
            Reset camera
          </Button>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
