'use client';

import QuickActions from '@/components/quickActions/QuickActions';
import {outerCardStyles} from '@/lib/cardStyles';
import {Mower, useSelectedMower} from '@/stores/mowersStore';
import {Card, CardContent, Typography, useTheme} from '@mui/material';

// Module-scope selectors — see the note in QuickActions.tsx.
const selectHasMower = (s?: Mower) => Boolean(s);
const selectNoActions = (s?: Mower) => (s?.actions.length ?? 0) === 0;

export default function ActionBar() {
  const theme = useTheme();
  // Narrow selectors so this card does not re-render on every robot_state
  // tick — we only need a presence flag and the action-list length.
  const hasMower = useSelectedMower(selectHasMower);
  const noActions = useSelectedMower(selectNoActions);

  return (
    <Card sx={{...outerCardStyles(theme)}}>
      <CardContent>
        <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
          Quick actions
        </Typography>
        <QuickActions variant="card" />
        {hasMower && noActions && (
          // The connection banner up top covers the "why" already — keep this
          // tight. If actions never arrive but other topics do, the user knows
          // it's a mower_logic-side issue, not a connection one.
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1.5}}>
            No actions available yet — see banner above for connection details.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
