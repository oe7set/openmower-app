'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import {
  Fullscreen as FullscreenIcon,
  Refresh as RefreshIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import {Alert, Box, Card, CardContent, Chip, IconButton, Tooltip, Typography} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';

// MJPEG live stream embedded as a plain <img>. Browsers that decode
// multipart/x-mixed-replace will render frames as they arrive — no extra lib
// needed. We append a cache-buster on every (re)load because some browsers
// (notably mobile Safari) otherwise pin the previous stream connection.
function withCacheBuster(url: string, token: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${token}`;
}

const RECONNECT_DELAY_MS = 2_000;
// Show a soft warning once we've exceeded a handful of immediate retries.
// We never stop reconnecting — the user can plug the camera back in at any
// time and the card should pick the stream up again.
const RECONNECT_WARN_AFTER = 3;

export default function CameraCard() {
  const cameraUrl = useSelectedMower((s) => s?.cameraUrl ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Monotonically incremented integer used as the cache-buster query param.
  // Doesn't need to be timestamp-based — uniqueness across renders is enough,
  // and bumping a counter is pure (Date.now() would trip react-hooks/refs).
  const [token, setToken] = useState(0);
  const [connected, setConnected] = useState(false);
  const [failures, setFailures] = useState(0);
  const reconnectHandle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReload = useCallback(() => {
    if (reconnectHandle.current !== null) return;
    reconnectHandle.current = setTimeout(() => {
      reconnectHandle.current = null;
      setToken((n) => n + 1);
    }, RECONNECT_DELAY_MS);
  }, []);

  const manualReload = useCallback(() => {
    if (reconnectHandle.current !== null) {
      clearTimeout(reconnectHandle.current);
      reconnectHandle.current = null;
    }
    setFailures(0);
    setToken((n) => n + 1);
  }, []);

  // Cancel any pending reconnect on unmount — otherwise a delayed setToken
  // would race with hidden state and either leak a timer or trigger a render
  // after unmount.
  useEffect(() => {
    return () => {
      if (reconnectHandle.current !== null) {
        clearTimeout(reconnectHandle.current);
        reconnectHandle.current = null;
      }
    };
  }, []);

  // Adjust local state when the camera URL changes — checked at render time
  // rather than in an effect so we re-render once with the right values.
  // Pattern from https://react.dev/learn/you-might-not-need-an-effect.
  const [trackedUrl, setTrackedUrl] = useState(cameraUrl);
  if (trackedUrl !== cameraUrl) {
    setTrackedUrl(cameraUrl);
    setFailures(0);
    setConnected(false);
    setToken((n) => n + 1);
  }

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  if (!cameraUrl) return null;

  const showWarning = !connected && failures >= RECONNECT_WARN_AFTER;

  return (
    <Card sx={{mt: 2}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5}}>
          <VideocamIcon color={connected ? 'success' : 'disabled'} />
          <Typography variant="h6" fontWeight="600" sx={{flex: 1}}>
            Camera
          </Typography>
          <Chip
            label={connected ? 'Live' : failures > 0 ? 'Reconnecting…' : 'Connecting…'}
            color={connected ? 'success' : failures >= RECONNECT_WARN_AFTER ? 'error' : 'default'}
            size="small"
            sx={{fontWeight: 600}}
          />
          <Tooltip title="Reload stream">
            <IconButton size="small" onClick={manualReload} aria-label="Reload camera stream">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fullscreen">
            <IconButton size="small" onClick={requestFullscreen} aria-label="Toggle fullscreen">
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          ref={containerRef}
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            bgcolor: '#000',
            borderRadius: 1,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={token}
            src={withCacheBuster(cameraUrl, token)}
            alt="USB camera stream"
            referrerPolicy="no-referrer"
            decoding="async"
            style={{width: '100%', height: '100%', objectFit: 'contain', display: 'block'}}
            onLoad={() => {
              setConnected(true);
              setFailures(0);
            }}
            onError={() => {
              setConnected(false);
              setFailures((n) => n + 1);
              scheduleReload();
            }}
          />
          {showWarning && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.55)',
                p: 2,
              }}
            >
              <Alert severity="warning" variant="filled" sx={{maxWidth: 420}}>
                Stream not reachable. Check that <code>MOWER_CAMERA_URL</code> points at a running
                MJPEG endpoint and that the USB camera is plugged in. Retrying every{' '}
                {Math.round(RECONNECT_DELAY_MS / 1000)}s…
              </Alert>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1}}>
          MJPEG endpoint: <code>{cameraUrl}</code>
        </Typography>
      </CardContent>
    </Card>
  );
}
