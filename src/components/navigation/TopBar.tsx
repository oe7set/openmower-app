'use client';

import {useToast} from '@/hooks/useToast';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {useConnectionDiagnostic, useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {useUiStore, type ThemeMode} from '@/stores/uiStore';
import {useUnreadForActive} from '@/stores/notificationsStore';
import {
  Brightness4,
  DarkMode,
  LightMode,
  Menu as MenuIcon,
  NotificationsActive,
  NotificationsNone,
  SettingsBrightness,
  Warning,
} from '@mui/icons-material';
import {
  Badge,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Slide,
  Tooltip,
  keyframes,
  useTheme,
} from '@mui/material';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {useScrollContainerRef} from './ScrollContainerContext';

interface TopBarProps {
  onMenuOpen: () => void;
}

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`;

export default function TopBar({onMenuOpen}: TopBarProps) {
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const themeMode = useUiStore((s) => s.themeMode);
  const setThemeMode = useUiStore((s) => s.setThemeMode);
  const topBarMode = useUiStore((s) => s.topBarMode);
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const diag = useConnectionDiagnostic();
  const unreadEvents = useUnreadForActive();

  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Auto-hide: track scroll direction on the main content container so the
  // bar slides out on scroll-down and back on scroll-up. We use a simple
  // last-position diff (no useScrollTrigger) because the scroll target is
  // the AppShell <main>, not window.
  const scrollRef = useScrollContainerRef();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (topBarMode !== 'autoHide') {
      setHidden(false);
      return;
    }
    const el = scrollRef?.current;
    if (!el) return;
    let lastY = el.scrollTop;
    const onScroll = () => {
      const y = el.scrollTop;
      const dy = y - lastY;
      // Small threshold so a couple of pixels of inertia/rubber-band don't
      // toggle the bar; require >8px movement to flip state.
      if (Math.abs(dy) < 8) return;
      if (dy > 0 && y > 64) setHidden(true);
      else if (dy < 0) setHidden(false);
      lastY = y;
    };
    el.addEventListener('scroll', onScroll, {passive: true});
    return () => el.removeEventListener('scroll', onScroll);
  }, [topBarMode, scrollRef]);

  const pickTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setThemeAnchor(null);
  };

  const handleResetEmergency = async () => {
    const {mowers, selected} = useMowersStore.getState();
    const mower = mowers[selected];
    if (!mower) return;
    setResetting(true);
    try {
      mower.publishAction(MOWER_ACTIONS.resetEmergency);
      toast.success('Emergency reset sent');
      setEmergencyConfirmOpen(false);
    } catch (e) {
      toast.error(`Failed to reset emergency: ${(e as Error).message}`);
    } finally {
      setResetting(false);
    }
  };

  const ThemeIcon =
    themeMode === 'dark' ? DarkMode : themeMode === 'light' ? LightMode : SettingsBrightness;

  // Quick-glance pill colour. Mirrors the banner state but compressed.
  const pillColor =
    diag.status === 'ok'
      ? theme.palette.success.main
      : diag.status === 'connecting'
      ? theme.palette.info.main
      : diag.status === 'no-broker'
      ? theme.palette.error.main
      : theme.palette.warning.main;
  const pillTooltip =
    diag.status === 'ok'
      ? 'Mower connected'
      : diag.status === 'connecting'
      ? 'Connecting to broker…'
      : diag.status === 'no-broker'
      ? 'Broker unreachable — click for diagnostics'
      : diag.status === 'no-mower'
      ? 'No mower configured'
      : 'Mower data partial — click for diagnostics';

  if (topBarMode === 'hidden') {
    return (
      <>
        {/* Dialogs and the theme menu still need to mount so any open state
            from a previous render unwinds cleanly. The bar itself is gone. */}
        <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}>
          <MenuItem selected={themeMode === 'light'} onClick={() => pickTheme('light')}>
            <LightMode fontSize="small" sx={{mr: 1}} /> Light
          </MenuItem>
          <MenuItem selected={themeMode === 'dark'} onClick={() => pickTheme('dark')}>
            <DarkMode fontSize="small" sx={{mr: 1}} /> Dark
          </MenuItem>
          <MenuItem selected={themeMode === 'system'} onClick={() => pickTheme('system')}>
            <Brightness4 fontSize="small" sx={{mr: 1}} /> System
          </MenuItem>
        </Menu>
        <Dialog open={emergencyConfirmOpen} onClose={() => setEmergencyConfirmOpen(false)}>
          <DialogTitle>Reset emergency stop?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The mower will be allowed to resume operation. Make sure the area is safe and the cause of the emergency
              has been cleared.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmergencyConfirmOpen(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleResetEmergency} disabled={resetting}>
              Reset
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  const bar = (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.appBar,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: {xs: 1, md: 2},
        py: 1,
        backdropFilter: 'blur(8px)',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(18,18,18,0.7)' : 'rgba(250,250,250,0.7)',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <IconButton
        aria-label="Open navigation menu"
        onClick={onMenuOpen}
        sx={{display: {xs: 'inline-flex', md: 'none'}}}
      >
        <MenuIcon />
      </IconButton>

      <Box sx={{flex: 1}} />

      <Tooltip title={pillTooltip}>
        <IconButton
          aria-label="Connection status"
          size="small"
          onClick={() => {
            if (pathname !== '/debug') router.push('/debug');
          }}
          sx={{p: 0.5}}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: pillColor,
              boxShadow: `0 0 0 2px ${pillColor}33`,
            }}
          />
        </IconButton>
      </Tooltip>

      {emergency && (
        <Tooltip title="Emergency active — click to reset">
          <IconButton
            color="error"
            aria-label="Reset emergency stop"
            onClick={() => setEmergencyConfirmOpen(true)}
            sx={{animation: `${blink} 700ms ease-in-out infinite`}}
          >
            <Warning />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title={unreadEvents > 0 ? `${unreadEvents} unread notification${unreadEvents === 1 ? '' : 's'}` : 'Notifications'}>
        <IconButton
          aria-label="Notifications"
          onClick={() => {
            if (pathname !== '/notifications') router.push('/notifications');
          }}
        >
          <Badge badgeContent={unreadEvents} color="error" max={99}>
            {unreadEvents > 0 ? <NotificationsActive /> : <NotificationsNone />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Tooltip title={`Theme: ${themeMode}`}>
        <IconButton aria-label="Change theme" onClick={(e) => setThemeAnchor(e.currentTarget)}>
          <ThemeIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <>
      {topBarMode === 'autoHide' ? (
        <Slide appear={false} direction="down" in={!hidden}>
          {bar}
        </Slide>
      ) : (
        bar
      )}

      <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}>
        <MenuItem selected={themeMode === 'light'} onClick={() => pickTheme('light')}>
          <LightMode fontSize="small" sx={{mr: 1}} /> Light
        </MenuItem>
        <MenuItem selected={themeMode === 'dark'} onClick={() => pickTheme('dark')}>
          <DarkMode fontSize="small" sx={{mr: 1}} /> Dark
        </MenuItem>
        <MenuItem selected={themeMode === 'system'} onClick={() => pickTheme('system')}>
          <Brightness4 fontSize="small" sx={{mr: 1}} /> System
        </MenuItem>
      </Menu>

      <Dialog open={emergencyConfirmOpen} onClose={() => setEmergencyConfirmOpen(false)}>
        <DialogTitle>Reset emergency stop?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The mower will be allowed to resume operation. Make sure the area is safe and the cause of the emergency
            has been cleared.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmergencyConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleResetEmergency} disabled={resetting}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
