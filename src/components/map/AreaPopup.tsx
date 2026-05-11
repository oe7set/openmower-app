'use client';

import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import {area as turfArea} from '@turf/area';
import type {Feature, Polygon} from 'geojson';
import {PlayArrow as PlayIcon} from '@mui/icons-material';
import {Box, Button, Paper, Typography, useTheme} from '@mui/material';
import {useState} from 'react';
import {MAP_OVERLAY_FLOATING} from './zIndex';

interface AreaPopupProps {
  /** The selected polygon feature, or null when nothing is selected. */
  area: Feature<Polygon, {name?: string; type?: string; active?: boolean}> | null;
  /** Index of this area within the mowing-areas list (matches robot_state.current_area). */
  mowingIndex: number;
  onClose: () => void;
}

export default function AreaPopup({area, mowingIndex, onClose}: AreaPopupProps) {
  const theme = useTheme();
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);
  const [pending, setPending] = useState(false);

  if (!area) return null;

  const props = area.properties ?? {};
  const isMowing = props.type === 'mow';
  const name = props.name ?? (isMowing ? `Mowing area ${mowingIndex}` : 'Area');
  const sizeM2 = turfArea(area.geometry).toFixed(0);

  const startHere = async () => {
    if (!rpc || mowingIndex < 0) return;
    setPending(true);
    try {
      await rpc.map.start_in_area({area_index: mowingIndex});
      toast.success(`Starting in ${name}…`);
      onClose();
    } catch (e) {
      toast.error(`Could not start: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        px: 2,
        py: 1.5,
        borderRadius: 2,
        zIndex: MAP_OVERLAY_FLOATING,
        backdropFilter: 'blur(8px)',
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(22,24,25,0.92)' : 'rgba(255,255,255,0.92)',
        minWidth: 260,
      }}
    >
      <Typography variant="subtitle2" fontWeight="600" noWrap>
        {name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
        {props.type ?? 'area'} · {sizeM2} m²{props.active === false ? ' · inactive' : ''}
      </Typography>
      <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
        {isMowing && mowingIndex >= 0 && (
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<PlayIcon />}
            disabled={pending || !rpc}
            onClick={startHere}
          >
            {pending ? '…' : 'Start here'}
          </Button>
        )}
      </Box>
    </Paper>
  );
}
