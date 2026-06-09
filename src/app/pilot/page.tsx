'use client';

import CameraStream, {CAMERA_RECONNECT_WARN_AFTER, type CameraStatus} from '@/components/camera/CameraStream';
import {MowerMap} from '@/components/map/MowerMap';
import {MAP_OVERLAY_PANEL, MAP_OVERLAY_TELEOP} from '@/components/map/zIndex';
import VirtualJoystick from '@/components/map/teleop/VirtualJoystick';
import {useMapboxDraw, useMapContext, withDisplaySortKeys} from '@/contexts/MapContext';
import {useGamepad} from '@/hooks/useGamepad';
import {useTeleop} from '@/hooks/useTeleop';
import {useToast} from '@/hooks/useToast';
import {useWakeLock} from '@/hooks/useWakeLock';
import {vibrate} from '@/lib/haptics';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {useUiStore} from '@/stores/uiStore';
import {featuresToMap, mapToFeatures} from '@/utils/area-converter';
import {useEffectiveDatum} from '@/utils/datum';
import {
  ContentCut as MowIcon,
  Insights as InsightsIcon,
  Layers as LayersIcon,
  LayersClear as LayersClearIcon,
  Lightbulb as LightbulbIcon,
  LightbulbOutlined as LightbulbOutlinedIcon,
  Opacity as OpacityIcon,
  PhotoCamera as PhotoCameraIcon,
  SportsEsports as GamepadIcon,
  Stop as StopIcon,
  SwapVert as SwapVertIcon,
  Tune as TuneIcon,
  VerticalSplit as VerticalSplitIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
} from '@mui/icons-material';
import {Box, Chip, IconButton, Slider, Tooltip, Typography, useTheme} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import SensorBarConfig from './SensorBarConfig';

// Mobile-first "Pilot" page: a single, non-scrolling screen with the camera as
// the backdrop, the virtual joystick on top, a draggable sensor bar, and the
// full map foldable in as a translucent, still-interactive overlay. It reuses
// the same building blocks as /drive and /map rather than reimplementing them.

import FloatingSensorBar from './FloatingSensorBar';

// Map visibility cycles hidden → solid → overlay (translucent). 'overlay' lays
// the map at reduced opacity over the camera; it stays interactive (pan/zoom)
// because the joystick sits in its own higher layer and captures its pointers.
type MapMode = 'hidden' | 'solid' | 'overlay';
const MAP_MODE_ORDER: MapMode[] = ['hidden', 'overlay', 'solid'];

// Speed-cap quick presets (fraction of max velocity) shown beside the slider.
const SPEED_PRESETS = [0.3, 0.6, 1] as const;

export default function PilotPage() {
  const theme = useTheme();
  const toast = useToast();
  const cap = useUiStore((s) => s.teleopSpeedCap);
  const setCap = useUiStore((s) => s.setTeleopSpeedCap);
  const {setVelocity} = useTeleop({cap});

  const mapData = useSelectedMower((s) => s?.map);
  const rpc = useSelectedMower((s) => s?.rpc);
  const hasMower = useSelectedMower((s) => Boolean(s));
  const currentState = useSelectedMower((s) => s?.state.current_state);
  const emergency = useSelectedMower((s) => s?.state.emergency ?? false);
  const {datum: effectiveDatum} = useEffectiveDatum();
  const {features, setFeatures, setDatum, editMode} = useMapContext();
  const draw = useMapboxDraw();

  const [mapMode, setMapMode] = useState<MapMode>('hidden');
  const [mapOpacity, setMapOpacity] = useState(0.45);
  const [showOpacity, setShowOpacity] = useState(false);
  const [showHud, setShowHud] = useState(false);
  const [cam, setCam] = useState<CameraStatus | null>(null);
  const [manualMowing, setManualMowing] = useState(false);
  // Sensor-bar config popover anchor and the bar's measured docked height, used
  // to shift other controls out from under a top/bottom-docked bar.
  const [sensorCfgAnchor, setSensorCfgAnchor] = useState<HTMLElement | null>(null);
  const [sensorBarHeight, setSensorBarHeight] = useState(0);
  const sensorPosition = useUiStore((s) => s.pilotSensorPosition);
  const dockTop = sensorPosition === 'top' ? sensorBarHeight + 8 : 0;
  const dockBottom = sensorPosition === 'bottom' ? sensorBarHeight + 8 : 0;

  // Persisted Pilot view prefs: overlay vs split layout, split half order, and
  // whether to hold a screen wake lock while driving.
  const pilotLayout = useUiStore((s) => s.pilotLayout);
  const setPilotLayout = useUiStore((s) => s.setPilotLayout);
  const splitSwapped = useUiStore((s) => s.pilotSplitSwapped);
  const setSplitSwapped = useUiStore((s) => s.setPilotSplitSwapped);
  const keepAwake = useUiStore((s) => s.pilotKeepAwake);
  const setKeepAwake = useUiStore((s) => s.setPilotKeepAwake);
  const isSplit = pilotLayout === 'split' && Boolean(mapData);

  // Keep the display awake while driving (opt-out via the cluster toggle), and
  // let a physical gamepad's left stick drive teleop alongside the touch
  // joystick — both feed the same setVelocity, so the cap still applies.
  useWakeLock(keepAwake);
  const gamepadConnected = useGamepad(setVelocity);

  const inAreaRecording = currentState === 'AREA_RECORDING';
  // Mirror /drive: the manual mow-motor actions are only handled by the
  // AreaRecordingBehavior, so the toggle is disabled (greyed out) outside that
  // state or during an emergency — the backend would drop the action anyway.
  const mowToggleDisabled = !hasMower || !inAreaRecording || emergency;

  // Mirror the effective datum into MapContext so the map's layers consume the
  // same value as the converter (same contract as /map's MapPage).
  useEffect(() => {
    setDatum(effectiveDatum);
  }, [effectiveDatum, setDatum]);

  // Display-mode sync: push map features into the draw control while not in
  // edit mode (the editor takes over otherwise). Identical to MapPage.
  useEffect(() => {
    if (draw && mapData && !editMode) {
      const f = mapToFeatures(mapData, effectiveDatum);
      draw.set(withDisplaySortKeys(f));
      setFeatures(f, false);
    }
  }, [draw, mapData, editMode, setFeatures, effectiveDatum]);

  const saveMapToMower = useCallback(async () => {
    if (!rpc || !mapData) return;
    await rpc.map.replace(featuresToMap(mapData, features, effectiveDatum));
  }, [rpc, mapData, features, effectiveDatum]);

  const cycleMapMode = useCallback(() => {
    setMapMode((m) => MAP_MODE_ORDER[(MAP_MODE_ORDER.indexOf(m) + 1) % MAP_MODE_ORDER.length]);
  }, []);

  const triggerEmergency = useCallback(() => {
    const {mowers, selected} = useMowersStore.getState();
    mowers[selected]?.publishAction(MOWER_ACTIONS.setEmergency);
    // A longer triple buzz marks the emergency as a deliberately heavy action.
    vibrate([60, 40, 60]);
  }, []);

  const publishAction = useCallback((actionId: string): boolean => {
    const {mowers, selected} = useMowersStore.getState();
    const mower = mowers[selected];
    if (!mower) return false;
    mower.publishAction(actionId);
    return true;
  }, []);

  const toggleMowMotor = useCallback(() => {
    if (manualMowing) {
      publishAction(MOWER_ACTIONS.arManualMowOff);
      setManualMowing(false);
    } else {
      publishAction(MOWER_ACTIONS.arManualMowOn);
      setManualMowing(true);
    }
    vibrate(25);
  }, [manualMowing, publishAction]);

  // Speed-cap preset + slider helpers, with a light tap on each change.
  const applyCap = useCallback(
    (v: number) => {
      setCap(v);
      vibrate(10);
    },
    [setCap],
  );

  // Snapshot the current camera frame and trigger a download. The data URL is
  // produced by CameraStream (canvas), so we just hand it to a synthetic link.
  const takeSnapshot = useCallback(() => {
    const dataUrl = cam?.snapshot();
    if (!dataUrl) {
      toast.warning('Snapshot unavailable (no frame yet, or CORS-restricted MJPEG)');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `pilot-snapshot-${cam?.stats?.width ?? 0}x${cam?.stats?.height ?? 0}.png`;
    a.click();
    vibrate(15);
  }, [cam, toast]);

  // Keep the local toggle in sync with the backend, mirroring /drive: the
  // AreaRecordingBehavior clears manual_mowing on exit and setEmergencyMode
  // stops the blade, so fire a defensive off-action and reset our flag when we
  // leave AREA_RECORDING or hit an emergency.
  const manualMowingRef = useRef(manualMowing);
  useEffect(() => {
    manualMowingRef.current = manualMowing;
  }, [manualMowing]);
  useEffect(() => {
    if (!manualMowing) return;
    if (!inAreaRecording || emergency) {
      publishAction(MOWER_ACTIONS.arManualMowOff);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManualMowing(false);
    }
  }, [manualMowing, inAreaRecording, emergency, publishAction]);

  // Hard guarantee: leaving the Pilot page stops the mow motor, mirroring
  // useTeleop's final-zero-twist cleanup so the blade can't keep spinning after
  // the user navigates away.
  useEffect(() => {
    return () => {
      if (manualMowingRef.current) {
        publishAction(MOWER_ACTIONS.arManualMowOff);
      }
    };
  }, [publishAction]);

  // A connected-but-no-media stall is its own warning (it shows immediately,
  // independent of the reconnect failure counter), since reconnecting won't
  // fix it — the cause is host-side routing, not a dropped connection.
  const camStalled = cam?.source !== 'none' && cam?.state === 'stalled';
  const camWarning = useMemo(
    () =>
      cam &&
      cam.source !== 'none' &&
      cam.state !== 'live' &&
      (cam.state === 'stalled' || cam.failures >= CAMERA_RECONNECT_WARN_AFTER),
    [cam],
  );
  const hasCamera = cam != null && cam.source !== 'none';
  const camLive = cam?.state === 'live';

  // In split layout the map is always shown solid; only overlay uses the
  // hidden/overlay/solid cycle. Derive both halves' visibility from that.
  const mapVisible = isSplit || mapMode !== 'hidden';
  const mapOpacityValue = !isSplit && mapMode === 'overlay' ? mapOpacity : 1;

  // Geometry for the camera and map boxes. In overlay layout both fill the
  // whole box (inset:0); in split layout each takes a half, ordered by the
  // swap flag (default: camera on top, map below).
  const fullInset = {top: 0, bottom: 0, left: 0, right: 0};
  const cameraBox = isSplit
    ? splitSwapped
      ? {top: '50%', bottom: 0, left: 0, right: 0}
      : {top: 0, height: '50%', left: 0, right: 0}
    : fullInset;
  const mapBox = isSplit
    ? splitSwapped
      ? {top: 0, height: '50%', left: 0, right: 0}
      : {top: '50%', bottom: 0, left: 0, right: 0}
    : fullInset;

  return (
    // Fill the AppShell <main> content area rather than the whole viewport, so
    // the page sits *between* the TopBar and the MobileBottomBar (both at
    // z-index appBar=1100) instead of behind them. All overlay children below
    // anchor to this box, which the bars already bound — same height pattern as
    // the /map page.
    <Box
      sx={{
        position: 'relative',
        // Root a stacking context (zIndex set + position) so the overlay
        // children below — which use the map z-index scale up to 1201 — are
        // confined beneath this box and never paint over the TopBar /
        // MobileBottomBar (both at theme.zIndex.appBar = 1100).
        zIndex: 0,
        isolation: 'isolate',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        bgcolor: '#000',
        touchAction: 'none',
      }}
    >
      {/* Layer 0 — camera backdrop (or placeholder when none configured). In
          split layout it occupies one half; objectFit follows the layout so
          the picture is never cropped in split but stays full-bleed in overlay. */}
      <Box sx={{position: 'absolute', ...cameraBox, overflow: 'hidden'}}>
        <CameraStream objectFit={isSplit ? 'contain' : 'cover'} onStatus={setCam} />
        {(!cam || cam.source === 'none') && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            <VideocamOffIcon sx={{fontSize: 48}} />
            <Typography variant="body2">No camera configured</Typography>
          </Box>
        )}
        {camWarning && (
          <Box
            sx={{
              position: 'absolute',
              top: `calc(8px + ${dockTop}px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: MAP_OVERLAY_PANEL,
              maxWidth: 'calc(100% - 16px)',
            }}
          >
            <Tooltip
              title={
                camStalled
                  ? 'WebRTC connected but no video frames are arriving. This is almost always a host-side routing issue (bytesReceived stays 0 despite ICE succeeding). On a Pi with multiple network interfaces, check `ip route get <browser-ip>` — see the lowlatency-cam-streamer README.'
                  : 'The camera endpoint is unreachable; retrying every couple of seconds.'
              }
            >
              <Chip
                color={camStalled ? 'warning' : 'error'}
                size="small"
                label={camStalled ? 'Connected — no video signal' : 'Camera reconnecting…'}
                sx={{fontWeight: 600}}
              />
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Layer 1 — map. Kept MOUNTED whenever mapData exists and only
          shown/hidden via opacity + pointer-events. Conditionally unmounting it
          breaks maplibre on re-mount (tiles never reload), so instead we leave
          the container in the tree — maplibre keeps valid dimensions and its
          tiles stay warm. In overlay layout it spans the whole box (translucent
          in overlay mode, still interactive — the joystick layer above captures
          its own pointers); in split layout it takes one half, solid. The box
          geometry transitions so toggling layout/swap animates; MowerMap's
          ResizeObserver calls map.resize() as the box changes size. */}
      {mapData && (
        <Box
          sx={{
            position: 'absolute',
            ...mapBox,
            opacity: mapVisible ? mapOpacityValue : 0,
            pointerEvents: mapVisible ? 'auto' : 'none',
            transition: 'opacity 0.2s, top 0.2s, height 0.2s, bottom 0.2s',
          }}
        >
          <MowerMap
            embedded
            mapData={mapData}
            saveMapToMower={saveMapToMower}
            sx={{
              width: '100%',
              height: '100%',
              backgroundColor: !isSplit && mapMode === 'overlay' ? 'transparent' : 'black',
            }}
          />
        </Box>
      )}

      {/* Layer 2 — configurable sensor bar (placement/rows/metrics from store).
          It reports its docked height so the controls below can shift clear. */}
      <FloatingSensorBar onHeight={setSensorBarHeight} />

      {/* Layer 3 — control cluster (top-right). The page box is already bounded
          below the TopBar, so we only offset by a small margin (top/bottom
          device insets are handled by the bars); left/right insets stay for
          landscape notches. When the sensor bar is docked to the top, the
          cluster shifts down by its height so nothing is covered. */}
      <Box
        sx={{
          position: 'absolute',
          top: `calc(8px + ${dockTop}px)`,
          right: 'calc(8px + env(safe-area-inset-right))',
          zIndex: MAP_OVERLAY_TELEOP,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          alignItems: 'flex-end',
        }}
      >
        {/* Layout toggle: overlay (translucent map over camera) ↔ split
            (camera/map halves). Disabled with no map to lay out. */}
        <OverlayIconButton
          title={isSplit ? 'Overlay layout' : 'Split layout (camera / map)'}
          active={isSplit}
          disabled={!mapData}
          onClick={() => setPilotLayout(isSplit ? 'overlay' : 'split')}
        >
          <VerticalSplitIcon />
        </OverlayIconButton>
        {/* In split layout: swap which half is on top. Otherwise: the original
            hidden → overlay → solid map-visibility cycle. */}
        {isSplit ? (
          <OverlayIconButton title="Swap halves (camera ↔ map)" onClick={() => setSplitSwapped(!splitSwapped)}>
            <SwapVertIcon />
          </OverlayIconButton>
        ) : (
          <OverlayIconButton
            title={
              mapMode === 'hidden' ? 'Show map (overlay)' : mapMode === 'overlay' ? 'Show map (solid)' : 'Hide map'
            }
            onClick={cycleMapMode}
          >
            {mapMode === 'solid' ? <LayersClearIcon /> : <LayersIcon />}
          </OverlayIconButton>
        )}
        <OverlayIconButton title="Sensor bar settings" onClick={(e) => setSensorCfgAnchor(e.currentTarget)}>
          <TuneIcon />
        </OverlayIconButton>
        {!isSplit && mapMode === 'overlay' && (
          <OverlayIconButton
            title="Adjust map transparency"
            active={showOpacity}
            onClick={() => setShowOpacity((v) => !v)}
          >
            <OpacityIcon />
          </OverlayIconButton>
        )}
        {hasCamera && (
          <OverlayIconButton title="Camera stats overlay" active={showHud} onClick={() => setShowHud((v) => !v)}>
            <InsightsIcon />
          </OverlayIconButton>
        )}
        {hasCamera && (
          <OverlayIconButton title="Snapshot (download frame)" onClick={takeSnapshot} disabled={!camLive}>
            <PhotoCameraIcon />
          </OverlayIconButton>
        )}
        <OverlayIconButton
          title={keepAwake ? 'Keep display awake: on' : 'Keep display awake: off'}
          active={keepAwake}
          onClick={() => setKeepAwake(!keepAwake)}
        >
          {keepAwake ? <LightbulbIcon /> : <LightbulbOutlinedIcon />}
        </OverlayIconButton>
        <OverlayIconButton title="Emergency stop" color="error" onClick={triggerEmergency} disabled={!hasMower}>
          <StopIcon />
        </OverlayIconButton>
        {gamepadConnected && (
          <Tooltip title="Gamepad connected — left stick drives" placement="left">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '50%',
                color: theme.palette.success.main,
                bgcolor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <GamepadIcon />
            </Box>
          </Tooltip>
        )}
        <Tooltip
          title={camLive ? 'Camera live' : camStalled ? 'Connected — no video signal' : 'Camera offline'}
          placement="left"
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              color: camLive
                ? theme.palette.success.main
                : camStalled
                  ? theme.palette.warning.main
                  : 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {camLive ? <VideocamIcon /> : <VideocamOffIcon />}
          </Box>
        </Tooltip>
      </Box>

      {/* Camera stats HUD — opt-in, mirrors the /drive footer metrics. Useful
          both as eye-candy and to diagnose a stall (fps/bitrate drop to 0). */}
      {hasCamera && showHud && (
        <Box
          sx={{
            position: 'absolute',
            top: `calc(8px + ${dockTop}px)`,
            left: 'calc(12px + env(safe-area-inset-left))',
            zIndex: MAP_OVERLAY_PANEL,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            color: 'rgba(255,255,255,0.9)',
            fontVariantNumeric: 'tabular-nums',
            maxWidth: 'calc(100% - 80px)',
          }}
        >
          <Typography variant="caption" sx={{display: 'block', fontWeight: 600}}>
            {cam?.source === 'whep' ? 'WebRTC' : 'MJPEG'} · {camLive ? 'live' : camStalled ? 'stalled' : cam?.state}
          </Typography>
          {cam?.stats && cam.stats.width > 0 ? (
            <Typography variant="caption" sx={{display: 'block', opacity: 0.85}}>
              {cam.stats.width}×{cam.stats.height} · {cam.stats.fps.toFixed(0)} fps ·{' '}
              {cam.stats.bitrateKbps.toFixed(0)} kbps · RTT {cam.stats.rttMs.toFixed(0)} ms
            </Typography>
          ) : (
            <Typography variant="caption" sx={{display: 'block', opacity: 0.6}}>
              {cam?.source === 'whep' ? 'waiting for video stats…' : 'no stats for MJPEG'}
            </Typography>
          )}
        </Box>
      )}

      {/* Opacity slider — only when adjusting the overlay */}
      {!isSplit && mapMode === 'overlay' && showOpacity && (
        <Box
          sx={{
            position: 'absolute',
            top: `calc(8px + ${dockTop}px)`,
            right: 'calc(60px + env(safe-area-inset-right))',
            zIndex: MAP_OVERLAY_TELEOP,
            width: 140,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.8)'}}>
            Map opacity
          </Typography>
          <Slider
            size="small"
            min={0.1}
            max={1}
            step={0.05}
            value={mapOpacity}
            onChange={(_, v) => setMapOpacity(v as number)}
          />
        </Box>
      )}

      {/* Speed-cap slider + presets (bottom-left). Sits low in the corner so it
          stays clear of the centred joystick. */}
      <Box
        sx={{
          position: 'absolute',
          left: 'calc(12px + env(safe-area-inset-left))',
          bottom: `calc(8px + ${dockBottom}px)`,
          zIndex: MAP_OVERLAY_TELEOP,
          width: 130,
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.85)', display: 'block'}}>
          Speed {Math.round(cap * 100)}%
        </Typography>
        <Slider
          size="small"
          min={0}
          max={100}
          step={5}
          value={Math.round(cap * 100)}
          onChange={(_, v) => applyCap((v as number) / 100)}
        />
        <Box sx={{display: 'flex', gap: 0.5, mt: 0.25}}>
          {SPEED_PRESETS.map((preset) => {
            const active = Math.round(cap * 100) === Math.round(preset * 100);
            return (
              <Box
                key={preset}
                component="button"
                onClick={() => applyCap(preset)}
                sx={{
                  flex: 1,
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 1,
                  py: 0.25,
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? '#000' : 'rgba(255,255,255,0.85)',
                  bgcolor: active ? theme.palette.primary.main : 'rgba(255,255,255,0.12)',
                  '&:hover': {bgcolor: active ? theme.palette.primary.main : 'rgba(255,255,255,0.22)'},
                }}
              >
                {Math.round(preset * 100)}%
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Mow-motor toggle (bottom-right, mirroring the speed slider bottom-left
          so the joystick stays centred between them). Disabled outside
          AREA_RECORDING / during emergency — the backend drops it otherwise. */}
      <Box
        sx={{
          position: 'absolute',
          right: 'calc(12px + env(safe-area-inset-right))',
          bottom: `calc(24px + ${dockBottom}px)`,
          zIndex: MAP_OVERLAY_TELEOP,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <OverlayIconButton
          title={
            manualMowing
              ? 'Stop mow motor'
              : inAreaRecording
                ? 'Start mow motor'
                : 'Mow motor (enter area recording first)'
          }
          color={manualMowing ? 'warning' : 'success'}
          active={manualMowing}
          onClick={toggleMowMotor}
          disabled={mowToggleDisabled}
        >
          <MowIcon />
        </OverlayIconButton>
        <Typography variant="caption" sx={{color: 'rgba(255,255,255,0.85)', fontSize: 10}}>
          {manualMowing ? 'Mowing' : 'Mow'}
        </Typography>
      </Box>

      {/* Layer 4 — joystick (bottom-centre, always on top). Scaled up ~1.3x for
          easier thumb control on a phone; the scale composes with the centring
          translate and keeps the joystick's pointer hit-testing correct (it is
          getBoundingClientRect-based, so the rendered rect scales with it). */}
      <Box
        sx={{
          position: 'absolute',
          bottom: `calc(24px + ${dockBottom}px)`,
          left: '50%',
          transform: 'translateX(-50%) scale(1.3)',
          transformOrigin: 'bottom center',
          zIndex: MAP_OVERLAY_TELEOP,
        }}
      >
        <VirtualJoystick onVelocityChange={setVelocity} />
      </Box>

      {/* Sensor-bar settings popover, owned by the page so the gear stays
          reachable regardless of the bar's position/visibility. */}
      <SensorBarConfig
        anchorEl={sensorCfgAnchor}
        open={Boolean(sensorCfgAnchor)}
        onClose={() => setSensorCfgAnchor(null)}
      />
    </Box>
  );
}

interface OverlayIconButtonProps {
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  color?: 'error' | 'warning' | 'success';
  children: React.ReactNode;
}

function OverlayIconButton({title, onClick, active, disabled, color, children}: OverlayIconButtonProps) {
  const theme = useTheme();
  // An explicit palette colour wins; otherwise an active button uses the brand
  // accent and the default is white-on-dark.
  const resolvedColor = color
    ? theme.palette[color].main
    : active
      ? theme.palette.primary.main
      : '#fff';
  return (
    <Tooltip title={title} placement="left">
      <span>
        <IconButton
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 40,
            height: 40,
            color: resolvedColor,
            bgcolor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            '&:hover': {bgcolor: 'rgba(0,0,0,0.6)'},
            '&.Mui-disabled': {color: 'rgba(255,255,255,0.3)'},
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}
