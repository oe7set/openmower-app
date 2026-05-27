'use client';

import type {QuickActionsState} from '@/stores/quickActionsStore';
import {useQuickActionsStore} from '@/stores/quickActionsStore';
import {Mower, useSelectedMower} from '@/stores/mowersStore';
import {
  Battery20 as BatteryLowIcon,
  BatteryChargingFull as BatteryChargingIcon,
  BatteryFull as BatteryFullIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {Box, Drawer, IconButton, LinearProgress, Typography, useTheme} from '@mui/material';
import {useEffect, useState} from 'react';
import QuickActions from './QuickActions';

// The sheet is mounted globally in AppShell but its body only renders while
// open (plus a brief closing-animation window). Keeping the Drawer permanently
// mounted would keep MUI v7 + React 19 effects alive on every route and the
// live mower selectors would re-subscribe on every MQTT tick.
// Module-scope selectors — see QuickActions.tsx for the rationale.
const selectMowerName = (s?: Mower) => s?.name;
const selectBattery = (s?: Mower) => s?.state.battery_percentage;
const selectCurrentState = (s?: Mower) => s?.state.current_state;
const selectIsCharging = (s?: Mower) => s?.state.is_charging ?? false;
const selectOpen = (s: QuickActionsState) => s.open;
const selectCloseSheet = (s: QuickActionsState) => s.closeSheet;

function QuickActionsSheetInternal({open, onClose}: {open: boolean; onClose: () => void}) {
  const theme = useTheme();
  const mowerName = useSelectedMower(selectMowerName);
  const battery = useSelectedMower(selectBattery);
  const currentState = useSelectedMower(selectCurrentState);
  const isCharging = useSelectedMower(selectIsCharging);

  const batteryIcon = isCharging ? (
    <BatteryChargingIcon fontSize="small" color="success" />
  ) : (battery ?? 100) < 25 ? (
    <BatteryLowIcon fontSize="small" color="warning" />
  ) : (
    <BatteryFullIcon fontSize="small" color="success" />
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      keepMounted={false}
      PaperProps={{
        sx: {
          borderRadius: '16px 16px 0 0',
          zIndex: theme.zIndex.appBar + 1,
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: '85dvh',
        },
      }}
    >
      <Box sx={{display: 'flex', justifyContent: 'center', py: 1, cursor: 'grab'}}>
        <Box sx={{width: 40, height: 4, borderRadius: 2, bgcolor: theme.palette.action.disabled}} />
      </Box>
      <Box sx={{px: 2, pb: 2}}>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
          <Box>
            <Typography variant="h6" fontWeight={600} component="div" sx={{lineHeight: 1.2}}>
              Quick actions
            </Typography>
            {mowerName && (
              <Typography variant="caption" color="text.secondary">
                {mowerName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Close quick actions">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            p: 1.25,
            borderRadius: 1.5,
            bgcolor: theme.palette.action.hover,
          }}
        >
          <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0}}>
            <Typography variant="body2" fontWeight={600} sx={{whiteSpace: 'nowrap'}}>
              {currentState ?? 'UNKNOWN'}
            </Typography>
          </Box>
          <Box sx={{flex: 1, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0}}>
            {batteryIcon}
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, battery ?? 0))}
              color={(battery ?? 100) < 25 ? 'warning' : 'success'}
              sx={{flex: 1, height: 8, borderRadius: 4}}
            />
            <Typography variant="caption" sx={{minWidth: 36, textAlign: 'right'}}>
              {battery ?? '—'}%
            </Typography>
          </Box>
        </Box>
        <QuickActions variant="sheet" onActionDispatched={onClose} />
      </Box>
    </Drawer>
  );
}

// Hold the inner component mounted long enough for MUI's slide-out animation
// to play (Drawer needs to render once with open=false), then unmount fully so
// no Modal effects linger on routes the user is not on.
const DRAWER_TRANSITION_MS = 250;

export default function QuickActionsSheet() {
  const open = useQuickActionsStore(selectOpen);
  const closeSheet = useQuickActionsStore(selectCloseSheet);
  // Keeps the inner component mounted briefly after `open` flips to false so
  // MUI's slide-out animation can play before unmount.
  const [holdAfterClose, setHoldAfterClose] = useState(false);

  useEffect(() => {
    if (open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoldAfterClose(true);
    const handle = setTimeout(() => setHoldAfterClose(false), DRAWER_TRANSITION_MS);
    return () => clearTimeout(handle);
  }, [open]);

  if (!open && !holdAfterClose) return null;
  return <QuickActionsSheetInternal open={open} onClose={closeSheet} />;
}
