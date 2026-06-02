'use client';

import {MowParamRows} from '@/app/tasks/MowParamFields';
import {displaySortKey, useMap, useMapboxDraw, useMapContext, useMapSelection} from '@/contexts/MapContext';
import {useSelectedMower} from '@/stores/mowersStore';
import {AreaProps} from '@/stores/schemas';
import {useUiStore} from '@/stores/uiStore';
import {
  applyOverridesToProps,
  areaPropsToOverrides,
  parseGlobalMowDefaults,
  resolvePreviewArgs,
  type AreaMowOverrides,
} from '@/utils/area-mow-params';
import {datumToRelative, pointsToRelative, type AbsolutePoint} from '@/utils/coordinates';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {Feature, Polygon} from 'geojson';
import {useState} from 'react';
import {AsyncDialogProps} from 'react-dialog-async';
import MapDialog from '../MapDialog';

interface FormState {
  name: string;
  type: AreaProps['type'];
  active: boolean;
}

export function AreaSettingsDialog(props: AsyncDialogProps) {
  const draw = useMapboxDraw();
  const selectedIds = useMapSelection();

  if (selectedIds.length === 0 || !draw) {
    return null;
  }

  // Re-mount the form whenever the selected feature changes so the form's
  // initial values come straight from the draw store via a lazy state init —
  // this avoids syncing them via a setState-in-effect cascade.
  return <AreaSettingsForm key={selectedIds[0]} featureId={selectedIds[0]} {...props} />;
}

interface AreaSettingsFormProps extends AsyncDialogProps {
  featureId: string;
}

function AreaSettingsForm({featureId, isOpen, handleClose}: AreaSettingsFormProps) {
  const map = useMap();
  const draw = useMapboxDraw();
  const {features, datum, setCoveragePreview} = useMapContext();
  const rpc = useSelectedMower((s) => s?.rpc);
  const setShowCoveragePreview = useUiStore((s) => s.setShowCoveragePreview);

  const [form, setForm] = useState<FormState>(() => {
    const properties = (draw?.get(featureId)?.properties ?? {}) as Partial<AreaProps>;
    return {
      name: properties.name ?? '',
      type: properties.type ?? 'draft',
      active: properties.active ?? true,
    };
  });

  // Per-area mowing-parameter overrides, seeded from the stored properties.
  const [overrides, setOverrides] = useState<AreaMowOverrides>(() =>
    areaPropsToOverrides(draw?.get(featureId)?.properties as Partial<AreaProps> | undefined),
  );
  const updateOverrides = (patch: Partial<AreaMowOverrides>) => setOverrides((o) => ({...o, ...patch}));

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFallback, setPreviewFallback] = useState(false);

  // Request the real slic3r coverage path for this area, using the current
  // (possibly unsaved) geometry and parameters. "Use default" parameters are
  // resolved against the live config here so the backend stays a stateless
  // proxy. Obstacle features become slic3r holes, mirroring the ROS backend.
  const requestPreview = async () => {
    if (!rpc || !draw) return;
    setPreviewError(null);
    setPreviewFallback(false);
    setPreviewLoading(true);
    try {
      const feature = draw.get(featureId) as Feature<Polygon> | undefined;
      if (!feature || feature.geometry.type !== 'Polygon') {
        throw new Error('Area has no polygon geometry');
      }
      const utmDatum = datumToRelative([datum.long, datum.lat]);
      const outline = pointsToRelative(feature.geometry.coordinates[0] as AbsolutePoint[], utmDatum);
      // Read holes from the draw store too, so unsaved obstacle edits are
      // reflected in the preview exactly like the area outline is. Mirrors the
      // ROS backend, which appends every active obstacle as a slic3r hole.
      const holes = draw
        .getAll()
        .features.filter((f) => f.geometry.type === 'Polygon' && f.properties?.type === 'obstacle')
        .map((f) => pointsToRelative((f.geometry as Polygon).coordinates[0] as AbsolutePoint[], utmDatum));

      let globals = parseGlobalMowDefaults(undefined);
      try {
        const cfg = await rpc.meta.config.get();
        globals = parseGlobalMowDefaults(cfg as Record<string, unknown> | undefined);
      } catch {
        // Older backend / broker down — fall back to built-in defaults so the
        // preview still renders something useful.
      }

      const args = resolvePreviewArgs(overrides, outline, holes, globals);
      const result = (await rpc.coverage.preview(args)) as {
        paths: {is_outline: boolean; points: number[][]}[];
        fill_fallback: boolean;
      };

      setCoveragePreview({
        areaId: featureId,
        paths: result.paths.map((p) => ({
          is_outline: p.is_outline,
          points: p.points.map(([x, y]) => ({x, y})),
        })),
        fillFallback: result.fill_fallback,
      });
      setShowCoveragePreview(true);
      setPreviewFallback(result.fill_fallback);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = () => {
    if (!map || !draw) return;
    const feature = draw.get(featureId);
    if (!feature) return;
    const index = features.features.findIndex((f) => f.id === feature.id);
    let nextProps: Partial<AreaProps> = {
      ...feature.properties,
      name: form.name,
      type: form.type,
      active: form.active,
      sort_key: displaySortKey(index, form.type, features.features),
    };
    // Mowing-parameter overrides only apply to mowing areas; for any other
    // type, strip them so a converted/draft area never carries stale params.
    nextProps = applyOverridesToProps(nextProps, form.type === 'mow' ? overrides : {});
    feature.properties = nextProps;
    draw.add(feature);
    map.fire(MapboxDraw.constants.events.UPDATE, {features: [feature]});

    handleClose();
  };

  return (
    <MapDialog open={isOpen} onClose={() => handleClose()} fullWidth maxWidth="xs">
      <DialogTitle>Area Settings</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({...f, name: e.target.value}))}
          fullWidth
          margin="normal"
          variant="outlined"
          required
        />

        <FormControl fullWidth margin="normal">
          <InputLabel>Type</InputLabel>
          <Select
            value={form.type}
            onChange={(e) => setForm((f) => ({...f, type: e.target.value as AreaProps['type']}))}
            label="Type"
            MenuProps={{
              disablePortal: true,
            }}
          >
            <MenuItem value="mow">Mowing Area</MenuItem>
            <MenuItem value="nav">Navigation Area</MenuItem>
            <MenuItem value="obstacle">Obstacle</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch checked={form.active} onChange={(e) => setForm((f) => ({...f, active: e.target.checked}))} />
          }
          label="Active"
          sx={{mt: 2}}
        />

        {form.type === 'mow' && (
          <>
            <Divider sx={{my: 2}} />
            <Typography variant="subtitle2" gutterBottom>
              Mowing parameters (override)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
              Each parameter falls back to the mower&apos;s global default when off.
            </Typography>
            <MowParamRows overrides={overrides} onChange={updateOverrides} extended />

            <Button
              variant="outlined"
              fullWidth
              sx={{mt: 1}}
              onClick={requestPreview}
              disabled={previewLoading || !rpc}
            >
              {previewLoading ? 'Computing path…' : 'Preview mowing path'}
            </Button>
            {previewError && (
              <Alert severity="warning" sx={{mt: 1}}>
                {previewError}
              </Alert>
            )}
            {previewFallback && !previewError && (
              <Alert severity="info" sx={{mt: 1}}>
                The selected pattern produced no infill for this shape; the planner fell back to a linear fill.
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1}}>
              Uses the current (unsaved) shape and parameters; the planner runs on the mower.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={form.name === ''}>
          Save
        </Button>
      </DialogActions>
    </MapDialog>
  );
}
