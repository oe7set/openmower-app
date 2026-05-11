'use client';

import {Box} from '@mui/material';
import {useState} from 'react';
import ConnectionBanner from '../diagnostics/ConnectionBanner';
import OnboardingDialog from '../onboarding/OnboardingDialog';
import MobileBottomBar from './MobileBottomBar';
import Sidebar from './sidebar/Sidebar';
import TopBar from './TopBar';

export default function AppShell({children}: {children: React.ReactNode}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Box sx={{display: 'flex', height: '100dvh'}}>
      <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          // Reserve room for the fixed MobileBottomBar (~56px) plus the iOS
          // home-indicator safe area so content never hides under it.
          pb: {xs: 'calc(56px + env(safe-area-inset-bottom))', md: 0},
          overflow: 'hidden',
        }}
      >
        <TopBar onMenuOpen={() => setMobileMenuOpen(true)} />
        <ConnectionBanner />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            overflowAnchor: 'none',
          }}
        >
          {children}
        </Box>
      </Box>
      <MobileBottomBar onMenuOpen={() => setMobileMenuOpen(true)} />
      <OnboardingDialog />
    </Box>
  );
}
