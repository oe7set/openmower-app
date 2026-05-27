'use client';

import {useUiStore} from '@/stores/uiStore';
import {Box} from '@mui/material';
import {useRef, useState} from 'react';
import ConnectionBanner from '../diagnostics/ConnectionBanner';
import OnboardingDialog from '../onboarding/OnboardingDialog';
import QuickActionsSheet from '../quickActions/QuickActionsSheet';
import MobileBottomBar from './MobileBottomBar';
import {ScrollContainerProvider} from './ScrollContainerContext';
import Sidebar from './sidebar/Sidebar';
import TopBar from './TopBar';

export default function AppShell({children}: {children: React.ReactNode}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bottomBarEnabled = useUiStore((s) => s.bottomBarEnabled);
  const mainRef = useRef<HTMLElement | null>(null);

  return (
    <ScrollContainerProvider value={mainRef}>
      <Box sx={{display: 'flex', height: '100dvh'}}>
        <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            // Reserve room for the fixed MobileBottomBar (~56px) plus the iOS
            // home-indicator safe area so content never hides under it. When
            // the user disables the bar via Appearance, reclaim the gap.
            pb: bottomBarEnabled
              ? {xs: 'calc(56px + env(safe-area-inset-bottom))', md: 0}
              : 0,
            overflow: 'hidden',
          }}
        >
          <TopBar onMenuOpen={() => setMobileMenuOpen(true)} />
          <ConnectionBanner />
          <Box
            component="main"
            ref={mainRef}
            sx={{
              flex: 1,
              overflow: 'auto',
              overflowAnchor: 'none',
            }}
          >
            {children}
          </Box>
        </Box>
        {bottomBarEnabled && <MobileBottomBar onMenuOpen={() => setMobileMenuOpen(true)} />}
        <QuickActionsSheet />
        <OnboardingDialog />
      </Box>
    </ScrollContainerProvider>
  );
}
