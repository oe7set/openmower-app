'use client';

import {Box} from '@mui/material';
import {useState} from 'react';
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
          pb: {xs: 7, md: 0},
          overflow: 'hidden',
        }}
      >
        <TopBar onMenuOpen={() => setMobileMenuOpen(true)} />
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
    </Box>
  );
}
