'use client';

import {useUiStore} from '@/stores/uiStore';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeProvider} from '@mui/material/styles';
import {SnackbarProvider} from 'notistack';
import {useEffect, useState} from 'react';
import {darkTheme, lightTheme} from '@/theme';
import RpcErrorBridge from './RpcErrorBridge';

export default function ThemeRegistry({children}: {children: React.ReactNode}) {
  const themeMode = useUiStore((s) => s.themeMode);

  // Start in light. The pre-hydration script in layout.tsx already set
  // data-theme + body background to the correct colour, so a one-render
  // mismatch here is invisible to the user. We immediately correct in the
  // effect below.
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const apply = () => {
      const next =
        themeMode === 'dark'
          ? 'dark'
          : themeMode === 'light'
          ? 'light'
          : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      setResolved(next);
      document.documentElement.setAttribute('data-theme', next);
      document.body.style.background = next === 'dark' ? '#121212' : '#fafafa';
    };
    apply();

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [themeMode]);

  return (
    <ThemeProvider theme={resolved === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={4}
        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
        autoHideDuration={4000}
      >
        <RpcErrorBridge />
        {children}
      </SnackbarProvider>
    </ThemeProvider>
  );
}
