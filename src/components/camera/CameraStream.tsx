'use client';

import {createWhepClient, WhepClient, WhepStats} from '@/lib/whep-client';
import {useSelectedMower} from '@/stores/mowersStore';
import {Box} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';

// Presentational, chrome-less camera stream. Renders just the media element
// filling its parent (no Card, no header) so it can be used as a full-bleed
// background — e.g. the mobile Pilot page lays the joystick and a translucent
// map on top of it. The /drive CameraCard keeps its own card chrome; this
// component deliberately carries only the connection logic and the bare
// <video>/<img>, surfacing status through `onStatus` so the host decides how
// to render badges/controls.

const RECONNECT_DELAY_MS = 2_000;
// After this many consecutive failures the host may want to warn the user; we
// never stop retrying — the camera/streamer can return at any time.
export const CAMERA_RECONNECT_WARN_AFTER = 3;

export type CameraConnState = 'connecting' | 'live' | 'error';

export interface CameraStatus {
  source: 'whep' | 'mjpeg' | 'none';
  state: CameraConnState;
  failures: number;
  stats: WhepStats | null;
  url: string;
  /** Force an immediate reconnect, resetting the failure counter. */
  reload: () => void;
}

interface CameraStreamProps {
  /** How the video fills its box. 'cover' for full-bleed backgrounds. */
  objectFit?: 'cover' | 'contain';
  /** Notified whenever connection state, failures or stats change. */
  onStatus?: (status: CameraStatus) => void;
}

export default function CameraStream({objectFit = 'cover', onStatus}: CameraStreamProps) {
  const whepUrl = useSelectedMower((s) => s?.whepUrl ?? '');
  const cameraUrl = useSelectedMower((s) => s?.cameraUrl ?? '');

  // Report the "no camera configured" case once so the host can render a
  // placeholder. Kept in an effect (not render) to avoid setState-in-render.
  const noCamera = !whepUrl && !cameraUrl;
  useEffect(() => {
    if (noCamera && onStatus) {
      onStatus({source: 'none', state: 'error', failures: 0, stats: null, url: '', reload: () => {}});
    }
  }, [noCamera, onStatus]);

  if (noCamera) return null;
  return whepUrl ? (
    <WhepStream url={whepUrl} objectFit={objectFit} onStatus={onStatus} />
  ) : (
    <MjpegStream url={cameraUrl} objectFit={objectFit} onStatus={onStatus} />
  );
}

// ---------------------------------------------------------------------------
// WHEP (WebRTC) — preferred low-latency path via lowlatency-cam-streamer.
// ---------------------------------------------------------------------------

function WhepStream({
  url,
  objectFit,
  onStatus,
}: {
  url: string;
  objectFit: 'cover' | 'contain';
  onStatus?: (status: CameraStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clientRef = useRef<WhepClient | null>(null);
  const reconnectHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsHandle = useRef<ReturnType<typeof setInterval> | null>(null);
  const [token, setToken] = useState(0);
  const [state, setState] = useState<CameraConnState>('connecting');
  const [failures, setFailures] = useState(0);
  const [stats, setStats] = useState<WhepStats | null>(null);

  const scheduleReload = useCallback(() => {
    if (reconnectHandle.current !== null) return;
    reconnectHandle.current = setTimeout(() => {
      reconnectHandle.current = null;
      setToken((n) => n + 1);
    }, RECONNECT_DELAY_MS);
  }, []);

  const reload = useCallback(() => {
    if (reconnectHandle.current !== null) {
      clearTimeout(reconnectHandle.current);
      reconnectHandle.current = null;
    }
    setFailures(0);
    setToken((n) => n + 1);
  }, []);

  // Reset transient state synchronously when the connection identity changes,
  // mirroring the pattern in CameraCard to avoid cascading renders.
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
      console.warn('[CameraStream] WHEP start failed:', err);
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

  useEffect(() => {
    onStatus?.({source: 'whep', state, failures, stats, url, reload});
  }, [onStatus, state, failures, stats, url, reload]);

  return (
    <Box sx={{position: 'absolute', inset: 0, bgcolor: '#000'}}>
      <video
        key={token}
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{width: '100%', height: '100%', objectFit, display: 'block'}}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// MJPEG — fallback path. Browser decodes multipart/x-mixed-replace natively.
// ---------------------------------------------------------------------------

function MjpegStream({
  url,
  objectFit,
  onStatus,
}: {
  url: string;
  objectFit: 'cover' | 'contain';
  onStatus?: (status: CameraStatus) => void;
}) {
  const reconnectHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const reload = useCallback(() => {
    if (reconnectHandle.current !== null) {
      clearTimeout(reconnectHandle.current);
      reconnectHandle.current = null;
    }
    setFailures(0);
    setToken((n) => n + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectHandle.current !== null) {
        clearTimeout(reconnectHandle.current);
        reconnectHandle.current = null;
      }
    };
  }, []);

  // Reset local state when the URL changes — at render time per the React docs
  // "you might not need an effect" pattern.
  const [trackedUrl, setTrackedUrl] = useState(url);
  if (trackedUrl !== url) {
    setTrackedUrl(url);
    setFailures(0);
    setConnected(false);
    setToken((n) => n + 1);
  }

  const state: CameraConnState = connected ? 'live' : failures > 0 ? 'error' : 'connecting';
  useEffect(() => {
    onStatus?.({source: 'mjpeg', state, failures, stats: null, url, reload});
  }, [onStatus, state, failures, url, reload]);

  const cacheBusted = `${url}${url.includes('?') ? '&' : '?'}_=${token}`;

  return (
    <Box sx={{position: 'absolute', inset: 0, bgcolor: '#000'}}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={token}
        src={cacheBusted}
        alt="USB camera stream"
        referrerPolicy="no-referrer"
        decoding="async"
        style={{width: '100%', height: '100%', objectFit, display: 'block'}}
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
    </Box>
  );
}
