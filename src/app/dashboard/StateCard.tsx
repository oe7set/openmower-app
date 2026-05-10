'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {Loop} from '@mui/icons-material';
import {Box, Card, CardContent, Chip, LinearProgress, Typography, useTheme} from '@mui/material';

// Human-readable label for a mower_logic state string. Returns the input
// verbatim if we don't have a nicer name.
function prettyState(state: string): string {
  const map: Record<string, string> = {
    IDLE: 'Idle',
    MOWING: 'Mowing',
    DOCKING: 'Docking',
    UNDOCKING: 'Undocking',
    AREA_RECORDING: 'Recording area',
    EMERGENCY: 'Emergency',
    UNKNOWN: 'Unknown',
  };
  return map[state] ?? state;
}

function stateColor(state: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (state === 'EMERGENCY') return 'error';
  if (state === 'MOWING' || state === 'AREA_RECORDING') return 'success';
  if (state === 'DOCKING' || state === 'UNDOCKING') return 'info';
  if (state === 'IDLE') return 'default';
  return 'warning';
}

export default function StateCard() {
  const theme = useTheme();
  const state = useSelectedMower((s) => s?.state.current_state ?? 'UNKNOWN');
  const subState = useSelectedMower((s) => s?.state.current_sub_state ?? '');
  const progress = useSelectedMower((s) => s?.state.current_action_progress ?? 0);
  const area = useSelectedMower((s) => s?.state.current_area ?? -1);
  const path = useSelectedMower((s) => s?.state.current_path ?? -1);
  const pathIdx = useSelectedMower((s) => s?.state.current_path_index ?? -1);

  const color = stateColor(state);
  const progressPct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const showProgress = state === 'MOWING' || state === 'DOCKING' || state === 'UNDOCKING';

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 360px', minWidth: 0}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
          <Loop color="primary" sx={{fontSize: 28}} />
          <Typography variant="h6" fontWeight="600">
            Current state
          </Typography>
        </Box>

        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 1}}>
          <Chip label={prettyState(state)} color={color} sx={{fontWeight: 600}} />
          {subState && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subState}
            </Typography>
          )}
        </Box>

        {showProgress && (
          <Box sx={{mt: 2}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.5}}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" fontWeight="600">
                {progressPct}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': {borderRadius: 4}}}
            />
          </Box>
        )}

        {area >= 0 && (
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 2}}>
            Area {area}
            {path >= 0 && ` · path ${path}`}
            {pathIdx >= 0 && ` (segment ${pathIdx})`}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
