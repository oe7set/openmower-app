'use client';

import {createWhepClient, WhepClient, WhepStats} from '@/lib/whep-client';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  Fullscreen as FullscreenIcon,
  Refresh as RefreshIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import {Alert, Box, Card, CardContent, Chip, IconButton, Tooltip, Typography} from '@mui/material';
import {ReactNode, useCallback, useEffect, useRef, useState} from 'react';

const RECONNECT_DELAY_MS = 2_000;
// Show a soft warning once we've exceeded a handful of immediate retries.
// We never stop reconnecting — the camera or streamer can come back at any
// time and the card should pick the stream up again.
const RECONNECT_WARN_AFTER = 3;

type ConnState = 'connecting' | 'live' | 'error';

export default function CameraCard() {
  const whepUrl = useSelectedMower((s) => s?.whepUrl ?? '');
  const cameraUrl = useSelectedMower((s) => s?.cameraUrl ?? '');

  if (!whepUrl && !cameraUrl) return null;

  return whepUrl ? <WhepView url={whepUrl} /> : <MjpegView url={cameraUrl} />;
}

// ---------------------------------------------------------------------------
// WHEP (WebRTC) view — preferred path. Connects to lowlatency-cam-streamer
// or any other WHEP-compliant endpoint.
// ---------------------------------------------------------------------------

function WhepView({url}: {url: string}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<WhepClient | null>(null);
  const reconnectHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsHandle = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bumping this triggers a connection restart through the effect below.
  const [token, setToken] = useState(0);
  const [state, setState] = useState<ConnState>('connecting');
  const [failures, setFailures] = useState(0);
  const [stats, setStats] = useState<WhepStats | null>(null);

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

  // Reset transient connection state synchronously when the effect's identity
  // is about to change. Doing this here (instead of the effect body) avoids
  // the cascading-renders pattern flagged by react-hooks/set-state-in-effect.
  const [connectionKey, setConnectionKey] = useState(`${url}:${token}`);
  const wantedKey = `${url}:${token}`;
  if (connectionKey !== wantedKey) {
    setConnectionKey(wantedKey);
    setState('connecting');
    setStats(null);
  }

  useEffect(() => {
    let cancelled = false;
    const videoEl = videoRef.current;

    const client = createWhepClient({url});
    clientRef.current = client;

    client.onStateChange = (cs) => {
      if (cancelled) return;
      if (cs === 'connected') {
        setState('live');
        setFailures(0);
      } else if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
        setState('error');
        setFailures((n) => n + 1);
        scheduleReload();
      }
    };

    client.start().catch((err) => {
      if (cancelled) return;
      console.warn('[CameraCard] WHEP start failed:', err);
      setState('error');
      setFailures((n) => n + 1);
      scheduleReload();
    });

    if (videoEl) videoEl.srcObject = client.stream;

    statsHandle.current = setInterval(() => {
      client.getStats().then((s) => {
        if (!cancelled && s) setStats(s);
      });
    }, 1000);

    return () => {
      cancelled = true;
      if (statsHandle.current) {
        clearInterval(statsHandle.current);
        statsHandle.current = null;
      }
      if (reconnectHandle.current) {
        clearTimeout(reconnectHandle.current);
        reconnectHandle.current = null;
      }
      if (videoEl) videoEl.srcObject = null;
      void client.stop();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [url, token, scheduleReload]);

  const showWarning = state !== 'live' && failures >= RECONNECT_WARN_AFTER;

  return (
    <CameraFrame
      containerRef={containerRef}
      stateLabel={state === 'live' ? 'Live' : failures > 0 ? 'Reconnecting…' : 'Connecting…'}
      stateColor={state === 'live' ? 'success' : showWarning ? 'error' : 'default'}
      iconActive={state === 'live'}
      onReload={manualReload}
      footer={
        <>
          WHEP endpoint: <code>{url}</code>
          {stats && stats.width > 0 && (
            <>
              {' · '}
              {stats.width}×{stats.height} · {stats.fps.toFixed(0)} fps · {stats.bitrateKbps.toFixed(0)} kbps · RTT{' '}
              {stats.rttMs.toFixed(0)} ms
            </>
          )}
        </>
      }
      warning={
        showWarning ? (
          <Alert severity="warning" variant="filled" sx={{maxWidth: 420}}>
            WebRTC stream not reachable. Check that the <code>lowlatency-cam-streamer</code> container is running and
            that <code>MOWER_WHEP_URL</code> points at a valid endpoint. Retrying every{' '}
            {Math.round(RECONNECT_DELAY_MS / 1000)}s…
          </Alert>
        ) : null
      }
    >
      <video
        key={token}
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{width: '100%', height: '100%', objectFit: 'contain', display: 'block'}}
      />
    </CameraFrame>
  );
}

// ---------------------------------------------------------------------------
// MJPEG view — fallback path. Renders a multipart/x-mixed-replace stream as
// a plain <img>. Browsers that decode that mime type render frames as they
// arrive, no extra lib needed.
// ---------------------------------------------------------------------------

function MjpegView({url}: {url: string}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reconnectHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonically incremented integer used as the cache-buster query param.
  // Doesn't need to be timestamp-based — uniqueness across renders is enough,
  // and bumping a counter is pure (Date.now() would trip react-hooks/refs).
  const [token, setToken] = useState(0);
  const [connected, setConnected] = useState(false);
  const [failures, setFailures] = useState(0);

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
  const [trackedUrl, setTrackedUrl] = useState(url);
  if (trackedUrl !== url) {
    setTrackedUrl(url);
    setFailures(0);
    setConnected(false);
    setToken((n) => n + 1);
  }

  const showWarning = !connected && failures >= RECONNECT_WARN_AFTER;
  const cacheBusted = `${url}${url.includes('?') ? '&' : '?'}_=${token}`;

  return (
    <CameraFrame
      containerRef={containerRef}
      stateLabel={connected ? 'Live' : failures > 0 ? 'Reconnecting…' : 'Connecting…'}
      stateColor={connected ? 'success' : showWarning ? 'error' : 'default'}
      iconActive={connected}
      onReload={manualReload}
      footer={
        <>
          MJPEG endpoint: <code>{url}</code>
        </>
      }
      warning={
        showWarning ? (
          <Alert severity="warning" variant="filled" sx={{maxWidth: 420}}>
            Stream not reachable. Check that <code>MOWER_CAMERA_URL</code> points at a running MJPEG endpoint and that
            the USB camera is plugged in. Retrying every {Math.round(RECONNECT_DELAY_MS / 1000)}s…
          </Alert>
        ) : null
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={token}
        src={cacheBusted}
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
    </CameraFrame>
  );
}

// ---------------------------------------------------------------------------
// Shared chrome around either video element. Keeps the two view components
// focused on connection logic and avoids drifting visuals between paths.
// ---------------------------------------------------------------------------

interface CameraFrameProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  stateLabel: string;
  stateColor: 'success' | 'error' | 'default';
  iconActive: boolean;
  onReload: () => void;
  footer: ReactNode;
  warning: ReactNode;
  children: ReactNode;
}

function CameraFrame({
  containerRef,
  stateLabel,
  stateColor,
  iconActive,
  onReload,
  footer,
  warning,
  children,
}: CameraFrameProps) {
  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, [containerRef]);

  return (
    <Card sx={{mt: 2}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5}}>
          <VideocamIcon color={iconActive ? 'success' : 'disabled'} />
          <Typography variant="h6" fontWeight="600" sx={{flex: 1}}>
            Camera
          </Typography>
          <Chip label={stateLabel} color={stateColor} size="small" sx={{fontWeight: 600}} />
          <Tooltip title="Reload stream">
            <IconButton size="small" onClick={onReload} aria-label="Reload camera stream">
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
          {children}
          {warning && (
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
              {warning}
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1}}>
          {footer}
        </Typography>
      </CardContent>
    </Card>
  );
}
