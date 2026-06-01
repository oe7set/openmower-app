'use client';

import {
  Box,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import {Close as CloseIcon} from '@mui/icons-material';
import {format, parseISO} from 'date-fns';
import type {RunStatus, ScheduleRun} from './types';

interface RunHistoryDrawerProps {
  open: boolean;
  runs: ScheduleRun[];
  onClose: () => void;
}

const STATUS_COLOR: Record<RunStatus, 'default' | 'success' | 'warning' | 'error'> = {
  started: 'default',
  completed: 'success',
  aborted: 'warning',
  failed: 'error',
};

function fmt(iso?: string): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'EEE d MMM, HH:mm');
  } catch {
    return iso;
  }
}

export default function RunHistoryDrawer({open, runs, onClose}: RunHistoryDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{width: {xs: 320, sm: 400}, p: 2}}>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
          <Typography variant="h6" fontWeight={600}>
            Run history
          </Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
        {runs.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{py: 2}}>
            No runs recorded yet.
          </Typography>
        ) : (
          <List disablePadding>
            {runs.map((r) => (
              <ListItem
                key={r.run_id}
                sx={{flexDirection: 'column', alignItems: 'stretch', px: 0, py: 1}}
                divider
              >
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1}}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {r.name ?? r.schedule_id}
                  </Typography>
                  <Chip size="small" color={STATUS_COLOR[r.status]} label={r.status} />
                </Box>
                <ListItemText
                  sx={{m: 0}}
                  secondary={
                    <Box component="span" sx={{display: 'block'}}>
                      <Typography component="span" variant="caption" sx={{display: 'block'}}>
                        {fmt(r.occurrence_iso)}
                        {r.area_indices && r.area_indices.length > 0
                          ? ` · ${r.area_indices.length} area${r.area_indices.length === 1 ? '' : 's'}`
                          : ''}
                      </Typography>
                      {r.reason && (
                        <Typography component="span" variant="caption" color="error">
                          {r.reason}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
