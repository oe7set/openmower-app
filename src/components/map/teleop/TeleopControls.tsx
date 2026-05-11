'use client';

import {useTeleop} from '@/hooks/useTeleop';
import {Box, useMediaQuery, useTheme} from '@mui/material';
import {MAP_OVERLAY_TELEOP} from '../zIndex';
import VirtualJoystick from './VirtualJoystick';

export default function TeleopControls() {
  const {setVelocity} = useTeleop();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        position: 'absolute',
        // Account for iPhone home-indicator safe area on mobile so the joystick
        // doesn't sit under the system gesture bar.
        bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : 24,
        left: isMobile ? '50%' : 24,
        transform: isMobile ? 'translateX(-50%)' : 'none',
        zIndex: MAP_OVERLAY_TELEOP,
      }}
    >
      <VirtualJoystick onVelocityChange={setVelocity} />
    </Box>
  );
}
