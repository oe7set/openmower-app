'use client';

import {useMowerConfigs} from '@/stores/configStore';
import {useMowersStore} from '@/stores/mowersStore';
import {Menu} from '@mui/material';
import MowerSelectorHeader from './MowerSelectorHeader';
import MowerSelectorItem from './MowerSelectorItem';

interface MowerSelectorProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export default function MowerSelector({anchorEl, onClose}: MowerSelectorProps) {
  const mowerConfigs = useMowerConfigs();
  const selectedId = useMowersStore((s) => s.mowers[s.selected]?.id);

  const handleSelect = (mowerId: string) => {
    const idx = useMowersStore.getState().mowers.findIndex((m) => m.id === mowerId);
    if (idx >= 0) useMowersStore.setState({selected: idx});
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
      transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
      slotProps={{
        paper: {
          sx: {
            minWidth: 280,
            mt: 1,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          },
        },
      }}
    >
      <MowerSelectorHeader />
      {mowerConfigs.map((mower) => (
        <MowerSelectorItem
          key={mower.id}
          mower={mower}
          selected={mower.id === selectedId}
          onClick={() => handleSelect(mower.id)}
        />
      ))}
    </Menu>
  );
}
