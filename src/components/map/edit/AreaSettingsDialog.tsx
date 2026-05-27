'use client';

import {displaySortKey, useMap, useMapboxDraw, useMapContext, useMapSelection} from '@/contexts/MapContext';
import {AreaProps} from '@/stores/schemas';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from '@mui/material';
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
  const {features} = useMapContext();

  const [form, setForm] = useState<FormState>(() => {
    const properties = (draw?.get(featureId)?.properties ?? {}) as Partial<AreaProps>;
    return {
      name: properties.name ?? '',
      type: properties.type ?? 'draft',
      active: properties.active ?? true,
    };
  });

  const handleSave = () => {
    if (!map || !draw) return;
    const feature = draw.get(featureId);
    if (!feature) return;
    const index = features.features.findIndex((f) => f.id === feature.id);
    feature.properties = {
      ...feature.properties,
      name: form.name,
      type: form.type,
      active: form.active,
      sort_key: displaySortKey(index, form.type, features.features),
    };
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
