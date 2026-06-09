'use client';

import {createWhepClient, WhepClient, WhepStats} from '@/lib/whep-client';
import {useSelectedMower} from '@/stores/mowersStore';
import {Box} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  cameraMediaStyle,
  cameraWrapperSx,
  DEFAULT_CAMERA_DISPLAY,
  drawOrientedSnapshot,
  type CameraDisplay,
} from './cameraDisplay';

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
// Stats poll cadence and how many consecutive flat polls (no new bytes/frames)
// flip a connected stream into 'stalled'. WebRTC reaching 'connected' while no
// media flows is almost always a host-side routing issue (bytesReceived stays
// 0 despite ICE succeeding — see lowlatency-cam-streamer README); reconnecting
// won't fix it, so we surface it as a distinct state rather than a failure.
const STATS_POLL_MS = 1_000;
const STALL_TICKS = 3;

// 'stalled' = the transport is connected but no decoded frames are arriving.
export type CameraConnState = 'connecting' | 'live' | 'stalled' | 'error';

export interface CameraStatus {
  source: 'whep' | 'mjpeg' | 'none';
  state: CameraConnState;
  failures: number;
  stats: WhepStats | null;
  url: string;
  /** Force an immediate reconnect, resetting the failure counter. */
  reload: () => void;
  /** Grab the current frame as a PNG data URL, or null if unavailable (no
      frame yet, or a CORS-tainted MJPEG canvas). */
  snapshot: () => string | null;
}

interface CameraStreamProps {
  /** Shorthand fit for simple hosts (e.g. /drive). Ignored when `display` is
      given. 'cover' for full-bleed backgrounds. */
  objectFit?: 'cover' | 'contain';
  /** Full display config (fit/anchor/rotation/mirror/zoom). Takes precedence
      over `objectFit`. */
  display?: CameraDisplay;
  /** Notified whenever connection state, failures or stats change. */
  onStatus?: (status: CameraStatus) => void;
}

export default function CameraStream({objectFit = 'cover', display, onStatus}: CameraStreamProps) {
  const whepUrl = useSelectedMower((s) => s?.whepUrl ?? '');
  const cameraUrl = useSelectedMower((s) => s?.cameraUrl ?? '');

  // Resolve the effective display config: an explicit `display` wins; otherwise
  // fall back to the legacy `objectFit` shorthand with default orientation.
  const d: CameraDisplay = display ?? {...DEFAULT_CAMERA_DISPLAY, fit: objectFit};

  // Report the "no camera configured" case once so the host can render a
  // placeholder. Kept in an effect (not render) to avoid setState-in-render.
  const noCamera = !whepUrl && !cameraUrl;
  useEffect(() => {
    if (noCamera && onStatus) {
      onStatus({
        source: 'none',
        state: 'error',
        failures: 0,
        stats: null,
        url: '',
        reload: () => {},
        snapshot: () => null,
      });
    }
  }, [noCamera, onStatus]);

  if (noCamera) return null;
  return whepUrl ? (
    <WhepStream url={whepUrl} display={d} onStatus={onStatus} />
  ) : (
    <MjpegStream url={cameraUrl} display={d} onStatus={onStatus} />
  );
}

// ---------------------------------------------------------------------------
// WHEP (WebRTC) — preferred low-latency path via lowlatency-cam-streamer.
// ---------------------------------------------------------------------------

function WhepStream({
  url,
  display,
  onStatus,
}: {
  url: string;
  display: CameraDisplay;
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

  // Track the live display config in a ref so snapshot() can bake in the
  // current rotation/mirror without changing its callback identity (it's
  // surfaced via onStatus, so a stable identity keeps that effect from churning).
  const displayRef = useRef(display);
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

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

  // Snapshot the current decoded video frame to a PNG data URL, baking in the
  // current rotation/mirror. A WebRTC MediaStream is same-origin by spec, so
  // the canvas is never tainted here.
  const snapshot = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    return drawOrientedSnapshot(video, video.videoWidth, video.videoHeight, displayRef.current);
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

    // Per-connection stall tracking: once the transport is connected we watch
    // decoded frames + received bytes; if neither advances for STALL_TICKS
    // consecutive polls the stream is up but no media flows.
    let connected = false;
    let prevFrames = -1;
    let prevBytes = -1;
    let flatTicks = 0;

    client.onStateChange = (cs) => {
      if (cancelled) return;
      if (cs === 'connected') {
        connected = true;
        flatTicks = 0;
        prevFrames = -1;
        prevBytes = -1;
        setState('live');
        setFailures(0);
      } else if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
        connected = false;
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
        if (cancelled || !s) return;
        setStats(s);
        if (!connected) return;
        const advanced = s.framesDecoded > prevFrames || s.bytesReceived > prevBytes;
        prevFrames = s.framesDecoded;
        prevBytes = s.bytesReceived;
        if (advanced) {
          flatTicks = 0;
          setState('live');
        } else if (++flatTicks >= STALL_TICKS) {
          setState('stalled');
        }
      });
    }, STATS_POLL_MS);

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
    onStatus?.({source: 'whep', state, failures, stats, url, reload, snapshot});
  }, [onStatus, state, failures, stats, url, reload, snapshot]);

  return (
    <Box sx={cameraWrapperSx(display)}>
      <video key={token} ref={videoRef} autoPlay playsInline muted style={cameraMediaStyle(display)} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// MJPEG — fallback path. Browser decodes multipart/x-mixed-replace natively.
// ---------------------------------------------------------------------------

function MjpegStream({
  url,
  display,
  onStatus,
}: {
  url: string;
  display: CameraDisplay;
  onStatus?: (status: CameraStatus) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const reconnectHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [token, setToken] = useState(0);
  const [connected, setConnected] = useState(false);
  const [failures, setFailures] = useState(0);

  // Track the live display config for orientation-aware snapshots without
  // churning the snapshot() callback identity (it flows through onStatus).
  const displayRef = useRef(display);
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

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

  // Snapshot the current MJPEG frame, baking in rotation/mirror. The <img>
  // requests anonymous CORS so the canvas stays untainted when the server sends
  // permissive headers; if it doesn't, toDataURL throws and we return null.
  const snapshot = useCallback((): string | null => {
    const img = imgRef.current;
    if (!img) return null;
    return drawOrientedSnapshot(img, img.naturalWidth, img.naturalHeight, displayRef.current);
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
    onStatus?.({source: 'mjpeg', state, failures, stats: null, url, reload, snapshot});
  }, [onStatus, state, failures, url, reload, snapshot]);

  const cacheBusted = `${url}${url.includes('?') ? '&' : '?'}_=${token}`;

  return (
    <Box sx={cameraWrapperSx(display)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={token}
        ref={imgRef}
        src={cacheBusted}
        alt="USB camera stream"
        // Request anonymous CORS so snapshots work when the server allows it;
        // harmless otherwise (the frame still renders, only toDataURL is gated).
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        decoding="async"
        style={cameraMediaStyle(display)}
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
