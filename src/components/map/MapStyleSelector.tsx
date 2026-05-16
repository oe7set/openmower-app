import {ListItemIcon, ListItemText, Menu, MenuItem, Radio} from '@mui/material';
import {GlobeIcon, LayersIcon, MapIcon, SatelliteIcon, SquareIcon} from 'lucide-react';
import {useRControl} from 'maplibre-react-components';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useUiStore, type MapStyle} from '@/stores/uiStore';

const OPTIONS: {value: MapStyle; label: string; icon: React.ElementType}[] = [
  {value: 'plain', label: 'Plain', icon: SquareIcon},
  {value: 'satellite', label: 'Satellite', icon: SatelliteIcon},
  {value: 'osm', label: 'OpenStreetMap', icon: MapIcon},
  {value: 'hybrid', label: 'Hybrid', icon: LayersIcon},
];

export default function MapStyleSelector() {
  const mapStyle = useUiStore((s) => s.mapStyle);
  const setMapStyle = useUiStore((s) => s.setMapStyle);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const active = mapStyle !== 'plain';
  const className = 'maplibregl-ctrl maplibregl-ctrl-group' + (active ? ' maplibregl-ctrl-active' : '');
  const {container} = useRControl({position: 'top-right', className});

  return (
    <>
      {createPortal(
        <button type="button" title="Map style" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <GlobeIcon />
        </button>,
        container,
      )}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
        transformOrigin={{vertical: 'top', horizontal: 'right'}}
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = mapStyle === opt.value;
          return (
            <MenuItem
              key={opt.value}
              selected={selected}
              onClick={() => {
                setMapStyle(opt.value);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <Icon size={18} />
              </ListItemIcon>
              <ListItemText>{opt.label}</ListItemText>
              <Radio checked={selected} size="small" sx={{ml: 1}} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
