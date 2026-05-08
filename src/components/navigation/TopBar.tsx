'use client';

import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import {useUiStore, type ThemeMode} from '@/stores/uiStore';
import {Brightness4, DarkMode, LightMode, Menu as MenuIcon, SettingsBrightness, Warning} from '@mui/icons-material';
import {
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
  Tooltip,
  Typography,
  keyframes,
  useTheme,
} from '@mui/material';
import {useState} from 'react';

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
  const themeMode = useUiStore((s) => s.themeMode);
  const setThemeMode = useUiStore((s) => s.setThemeMode);
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const rpc = useSelectedMower((s) => s?.rpc);

  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const pickTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setThemeAnchor(null);
  };

  // Phase 2 will replace the untyped rpc.call() with a generated rpc.mower.reset_emergency().
  // Until then, the TopBar uses the generic call path so the button works against any backend
  // that exposes either method.
  const handleResetEmergency = async () => {
    if (!rpc) return;
    setResetting(true);
    try {
      await rpc
        .call('mower.reset_emergency')
        .catch(() => rpc.call('mower.call_action', {name: 'mower_logic:reset_emergency'}));
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

  return (
    <>
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

        <Tooltip title={`Theme: ${themeMode}`}>
          <IconButton aria-label="Change theme" onClick={(e) => setThemeAnchor(e.currentTarget)}>
            <ThemeIcon />
          </IconButton>
        </Tooltip>
      </Box>

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
