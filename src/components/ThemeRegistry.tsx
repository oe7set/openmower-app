'use client';

import {useUiStore} from '@/stores/uiStore';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeProvider} from '@mui/material/styles';
import {SnackbarProvider} from 'notistack';
import {useEffect, useMemo, useState} from 'react';
import {buildTheme, PRE_HYDRATION_BG} from '@/theme';
import RpcErrorBridge from './RpcErrorBridge';

export default function ThemeRegistry({children}: {children: React.ReactNode}) {
  const themeMode = useUiStore((s) => s.themeMode);
  const accent = useUiStore((s) => s.accentColor);
  const radiusMode = useUiStore((s) => s.radiusMode);
  const motionMode = useUiStore((s) => s.motionMode);
  const fontScale = useUiStore((s) => s.fontScale);

  // Start in light. The pre-hydration script in layout.tsx already set
  // data-theme + body background to the correct colour, so a one-render
  // mismatch here is invisible to the user. We immediately correct in the
  // effect below.
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');
  // Resolved motion mode — 'system' becomes 'full' or 'off' depending on
  // prefers-reduced-motion. We track it in state so a media-query change
  // re-renders with zeroed MUI transitions on the fly.
  const [resolvedMotion, setResolvedMotion] = useState<'full' | 'off'>('full');

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
      document.body.style.background = PRE_HYDRATION_BG[next];
    };
    apply();

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [themeMode]);

  useEffect(() => {
    const apply = () => {
      const next: 'full' | 'off' =
        motionMode === 'off'
          ? 'off'
          : motionMode === 'full'
          ? 'full'
          : window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'off'
          : 'full';
      setResolvedMotion(next);
      document.documentElement.setAttribute('data-motion', next);
    };
    apply();

    if (motionMode === 'system') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [motionMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(fontScale));
  }, [fontScale]);

  const theme = useMemo(
    () => buildTheme(resolved, {accent, radius: radiusMode, motion: resolvedMotion}),
    [resolved, accent, radiusMode, resolvedMotion],
  );

  return (
    <ThemeProvider theme={theme}>
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
