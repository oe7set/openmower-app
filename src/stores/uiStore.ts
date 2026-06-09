import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {DEFAULT_PILOT_METRIC_IDS} from '@/app/pilot/sensorMetrics';
import {clampZoom, DEFAULT_CAMERA_DISPLAY, type CameraDisplay} from '@/components/camera/cameraDisplay';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Units = 'metric' | 'imperial';
export type MapStyle = 'plain' | 'satellite' | 'osm' | 'hybrid';
export type DrawerAnchor = 'left' | 'right';
export type TopBarMode = 'always' | 'autoHide' | 'hidden';
export type Density = 'comfortable' | 'compact';
export type RadiusMode = 'sharp' | 'standard' | 'soft';
export type MotionMode = 'system' | 'full' | 'off';
export type PageHeaderStyle = 'hero' | 'flat' | 'minimal';
// Pilot-page sensor bar placement: a free-dragging floating pill, or docked to
// the top/bottom edge of the content area (full width, not draggable).
export type PilotSensorPosition = 'floating' | 'top' | 'bottom';
// Pilot-page main layout: 'overlay' lays the map as a translucent layer over
// the full-bleed camera (the original look); 'split' divides the screen into a
// camera half and a solid map half (stacked vertically); 'minimap' keeps the
// camera full-bleed and shows the map as a small picture-in-picture in a corner.
export type PilotLayout = 'overlay' | 'split' | 'minimap';
// Which corner the minimap sits in.
export type PilotMinimapCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
// Minimap size preset (mapped to pixel widths on the Pilot page).
export type PilotMinimapSize = 'sm' | 'md' | 'lg';
// Tone-mapping modes exposed in the IMU 3D viewer's look controls. Stored as a
// string union (not the numeric THREE.*ToneMapping enums) so the persisted
// value stays stable across three.js upgrades; the viewer maps it to the enum.
export type ToneMappingMode = 'neutral' | 'agx' | 'aces' | 'reinhard' | 'cineon' | 'linear' | 'none';

// Default ordered list of bottom-bar items by path. Mirrors the items
// originally tagged isPrimary in createNavigationItems(), with the two
// action triggers (Menu, Quick) prepended so a fresh install shows the
// same Bar layout the app shipped with before action items became
// configurable. Kept here so resetAppearance() and the migration can
// both reach for it.
export const DEFAULT_BOTTOM_BAR_ITEMS: string[] = ['__menu__', '__quick__', '/', '/map', '/drive', '/tasks'];

// Curated brand-accent presets shown as quick-pick swatches in the
// Appearance page. The hex value of `forest` matches the original
// hardcoded brand green so existing installations see no visible change.
export const ACCENT_PRESETS = {
  forest: '#1B9D52',
  ocean: '#1565C0',
  sunset: '#E25822',
  violet: '#7B5BA6',
  mono: '#444444',
} as const;

interface UiStore {
  themeMode: ThemeMode;
  units: Units;
  mapStyle: MapStyle;
  showPlannedPath: boolean;
  showCoveragePath: boolean;
  showMowingTrail: boolean;
  /** Show a translucent stripe overlay on each mowing area to visualise pattern. */
  showPatternPreview: boolean;
  /** Show the on-demand slic3r coverage-path preview computed for a single area. */
  showCoveragePreview: boolean;
  /** Cap for teleop velocity in [0, 1]. The /drive slider writes this. */
  teleopSpeedCap: number;

  // Pilot-page floating sensor bar preferences.
  /** 1 = single scrolling row, 2 = wrap onto (max) two rows, 'multi' = wrap
      onto as many rows as needed. */
  pilotSensorRows: 1 | 2 | 'multi';
  /** Ordered list of enabled metric ids (see app/pilot/sensorMetrics.ts). */
  pilotSensorMetricIds: string[];
  /** Background opacity of the bar in [0.2, 1]. */
  pilotSensorOpacity: number;
  /** Floating (draggable) or docked to the top/bottom edge. */
  pilotSensorPosition: PilotSensorPosition;
  /** Overlay (translucent map over camera), split (camera/map stacked) or
      minimap (small map in a corner over the full-bleed camera). */
  pilotLayout: PilotLayout;
  /** In split layout, false = camera on top / map below, true = swapped. */
  pilotSplitSwapped: boolean;
  /** Corner the minimap sits in (minimap layout only). */
  pilotMinimapCorner: PilotMinimapCorner;
  /** Minimap size preset (minimap layout only). */
  pilotMinimapSize: PilotMinimapSize;
  /** How the camera frame is fitted/oriented (fit/anchor/rotation/mirror/zoom). */
  pilotCameraDisplay: CameraDisplay;
  /** Hold a screen Wake Lock while the Pilot page is open so the phone display
      doesn't sleep mid-drive. */
  pilotKeepAwake: boolean;

  // Heatmap-page overlay toggles. The three layers are independent and may be
  // combined; the grid (binned) heatmap is the default look, points and the
  // driven path are opt-in.
  heatmapShowGrid: boolean;
  heatmapShowPoints: boolean;
  heatmapShowPath: boolean;

  // Appearance / UX prefs (Appearance page)
  drawerAnchor: DrawerAnchor;
  topBarMode: TopBarMode;
  bottomBarEnabled: boolean;
  /** Ordered list of nav-item paths shown in the mobile bottom bar. */
  bottomBarItems: string[];
  /** Desktop-only: collapse the permanent sidebar to icons-only. */
  sidebarCompact: boolean;
  density: Density;
  /** User-picked brand accent. Replaces the hardcoded brand green at theme-build time. */
  accentColor: string;
  /** Root font-size scale (0.8–1.4). Drives `--ui-scale`; MUI rem typography cascades. */
  fontScale: number;
  /** Drives shape.borderRadius and a per-component multiplier in theme.ts. */
  radiusMode: RadiusMode;
  /** Animation mode. 'system' follows prefers-reduced-motion. */
  motionMode: MotionMode;
  /** PageHeader variant. 'minimal' hides the header and routes the title into the top bar. */
  pageHeaderStyle: PageHeaderStyle;
  /** Per-mower override colour, keyed by mower id. Falls back to a hashed default. */
  mowerColors: Record<string, string>;

  // IMU 3D-viewer look controls (the page-local overlay on /imu). Persisted so
  // a chosen look survives reloads, but kept out of the Appearance page / reset.
  imuToneMapping: ToneMappingMode;
  /** Renderer toneMappingExposure for the IMU viewer. */
  imuExposure: number;
  /** scene.environmentIntensity (IBL strength) for the IMU viewer. */
  imuEnvIntensity: number;

  // Static orientation offsets (degrees) applied to the IMU viewer's 3D model
  // on top of the live IMU rotation. The Tango GLB (3dsMax→FBX→Blender→glTF
  // pipeline) isn't guaranteed axis-aligned with the robot body, so these let
  // the user re-square a mis-oriented model. All 0 = no correction.
  imuModelOffsetX: number;
  imuModelOffsetY: number;
  imuModelOffsetZ: number;

  setThemeMode: (mode: ThemeMode) => void;
  setUnits: (units: Units) => void;
  setMapStyle: (style: MapStyle) => void;
  setShowPlannedPath: (v: boolean) => void;
  setShowCoveragePath: (v: boolean) => void;
  setShowMowingTrail: (v: boolean) => void;
  setShowPatternPreview: (v: boolean) => void;
  setShowCoveragePreview: (v: boolean) => void;
  setTeleopSpeedCap: (v: number) => void;

  setPilotSensorRows: (v: 1 | 2 | 'multi') => void;
  setPilotSensorMetricIds: (v: string[]) => void;
  setPilotSensorOpacity: (v: number) => void;
  setPilotSensorPosition: (v: PilotSensorPosition) => void;
  setPilotLayout: (v: PilotLayout) => void;
  setPilotSplitSwapped: (v: boolean) => void;
  setPilotMinimapCorner: (v: PilotMinimapCorner) => void;
  setPilotMinimapSize: (v: PilotMinimapSize) => void;
  /** Merge a partial patch into the camera display config (zoom is clamped). */
  setPilotCameraDisplay: (patch: Partial<CameraDisplay>) => void;
  setPilotKeepAwake: (v: boolean) => void;

  setHeatmapShowGrid: (v: boolean) => void;
  setHeatmapShowPoints: (v: boolean) => void;
  setHeatmapShowPath: (v: boolean) => void;

  setDrawerAnchor: (v: DrawerAnchor) => void;
  setTopBarMode: (v: TopBarMode) => void;
  setBottomBarEnabled: (v: boolean) => void;
  setBottomBarItems: (v: string[]) => void;
  setSidebarCompact: (v: boolean) => void;
  setDensity: (v: Density) => void;
  setAccentColor: (v: string) => void;
  setFontScale: (v: number) => void;
  setRadiusMode: (v: RadiusMode) => void;
  setMotionMode: (v: MotionMode) => void;
  setPageHeaderStyle: (v: PageHeaderStyle) => void;
  setMowerColor: (id: string, color: string) => void;
  clearMowerColor: (id: string) => void;
  /** Restore appearance defaults; theme/units/map overlays are left alone. */
  resetAppearance: () => void;

  setImuToneMapping: (v: ToneMappingMode) => void;
  setImuExposure: (v: number) => void;
  setImuEnvIntensity: (v: number) => void;
  /** Restore the IMU viewer's look controls to their shipped defaults. */
  resetImuLook: () => void;

  setImuModelOffsetX: (v: number) => void;
  setImuModelOffsetY: (v: number) => void;
  setImuModelOffsetZ: (v: number) => void;
  /** Reset the IMU model orientation offsets to zero (no correction). */
  resetImuModelOffset: () => void;
}

// Shipped defaults for the IMU viewer look. Neutral (Khronos PBR Neutral) is the
// product-viewer tone map: preserves material base colours with minimal hue
// shift. Exposure 1.0 / IBL 0.5 give a natural, non-washed-out result with the
// single directional key light.
const IMU_LOOK_DEFAULTS = {
  imuToneMapping: 'neutral' as ToneMappingMode,
  imuExposure: 1.0,
  imuEnvIntensity: 0.5,
};

// Shipped defaults for the IMU model orientation offsets. All 0 = the model is
// shown exactly as the live IMU quaternion (plus the fixed ROS→three adapter)
// orients it, with no extra correction.
const IMU_MODEL_OFFSET_DEFAULTS = {
  imuModelOffsetX: 0,
  imuModelOffsetY: 0,
  imuModelOffsetZ: 0,
};

const APPEARANCE_DEFAULTS = {
  drawerAnchor: 'left' as DrawerAnchor,
  topBarMode: 'always' as TopBarMode,
  bottomBarEnabled: true,
  bottomBarItems: DEFAULT_BOTTOM_BAR_ITEMS,
  sidebarCompact: false,
  density: 'comfortable' as Density,
  accentColor: ACCENT_PRESETS.forest,
  fontScale: 1,
  radiusMode: 'standard' as RadiusMode,
  motionMode: 'system' as MotionMode,
  pageHeaderStyle: 'hero' as PageHeaderStyle,
  mowerColors: {} as Record<string, string>,
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      themeMode: 'system',
      units: 'metric',
      mapStyle: 'plain',
      showPlannedPath: true,
      showCoveragePath: false,
      showMowingTrail: false,
      showPatternPreview: false,
      showCoveragePreview: true,
      teleopSpeedCap: 0.6,
      pilotSensorRows: 1,
      pilotSensorMetricIds: DEFAULT_PILOT_METRIC_IDS,
      pilotSensorOpacity: 0.6,
      pilotSensorPosition: 'floating',
      pilotLayout: 'overlay',
      pilotSplitSwapped: false,
      pilotMinimapCorner: 'top-right',
      pilotMinimapSize: 'md',
      pilotCameraDisplay: DEFAULT_CAMERA_DISPLAY,
      pilotKeepAwake: true,
      heatmapShowGrid: true,
      heatmapShowPoints: false,
      heatmapShowPath: false,
      ...APPEARANCE_DEFAULTS,
      ...IMU_LOOK_DEFAULTS,
      ...IMU_MODEL_OFFSET_DEFAULTS,
      setThemeMode: (themeMode) => set({themeMode}),
      setUnits: (units) => set({units}),
      setMapStyle: (mapStyle) => set({mapStyle}),
      setShowPlannedPath: (showPlannedPath) => set({showPlannedPath}),
      setShowCoveragePath: (showCoveragePath) => set({showCoveragePath}),
      setShowMowingTrail: (showMowingTrail) => set({showMowingTrail}),
      setShowPatternPreview: (showPatternPreview) => set({showPatternPreview}),
      setShowCoveragePreview: (showCoveragePreview) => set({showCoveragePreview}),
      setTeleopSpeedCap: (teleopSpeedCap) => set({teleopSpeedCap: Math.max(0, Math.min(1, teleopSpeedCap))}),
      setPilotSensorRows: (pilotSensorRows) => set({pilotSensorRows}),
      setPilotSensorMetricIds: (pilotSensorMetricIds) => set({pilotSensorMetricIds}),
      setPilotSensorOpacity: (v) => set({pilotSensorOpacity: Math.max(0.2, Math.min(1, v))}),
      setPilotSensorPosition: (pilotSensorPosition) => set({pilotSensorPosition}),
      setPilotLayout: (pilotLayout) => set({pilotLayout}),
      setPilotSplitSwapped: (pilotSplitSwapped) => set({pilotSplitSwapped}),
      setPilotMinimapCorner: (pilotMinimapCorner) => set({pilotMinimapCorner}),
      setPilotMinimapSize: (pilotMinimapSize) => set({pilotMinimapSize}),
      setPilotCameraDisplay: (patch) =>
        set((s) => {
          const next = {...s.pilotCameraDisplay, ...patch};
          if (patch.zoom !== undefined) next.zoom = clampZoom(patch.zoom);
          return {pilotCameraDisplay: next};
        }),
      setPilotKeepAwake: (pilotKeepAwake) => set({pilotKeepAwake}),
      setHeatmapShowGrid: (heatmapShowGrid) => set({heatmapShowGrid}),
      setHeatmapShowPoints: (heatmapShowPoints) => set({heatmapShowPoints}),
      setHeatmapShowPath: (heatmapShowPath) => set({heatmapShowPath}),
      setDrawerAnchor: (drawerAnchor) => set({drawerAnchor}),
      setTopBarMode: (topBarMode) => set({topBarMode}),
      setBottomBarEnabled: (bottomBarEnabled) => set({bottomBarEnabled}),
      setBottomBarItems: (bottomBarItems) => set({bottomBarItems}),
      setSidebarCompact: (sidebarCompact) => set({sidebarCompact}),
      setDensity: (density) => set({density}),
      setAccentColor: (accentColor) => set({accentColor}),
      setFontScale: (fontScale) => set({fontScale: Math.max(0.8, Math.min(1.4, fontScale))}),
      setRadiusMode: (radiusMode) => set({radiusMode}),
      setMotionMode: (motionMode) => set({motionMode}),
      setPageHeaderStyle: (pageHeaderStyle) => set({pageHeaderStyle}),
      setMowerColor: (id, color) => set((s) => ({mowerColors: {...s.mowerColors, [id]: color}})),
      clearMowerColor: (id) =>
        set((s) => {
          const next = {...s.mowerColors};
          delete next[id];
          return {mowerColors: next};
        }),
      resetAppearance: () => set({...APPEARANCE_DEFAULTS}),
      setImuToneMapping: (imuToneMapping) => set({imuToneMapping}),
      setImuExposure: (imuExposure) => set({imuExposure: Math.max(0.2, Math.min(2, imuExposure))}),
      setImuEnvIntensity: (imuEnvIntensity) => set({imuEnvIntensity: Math.max(0, Math.min(2, imuEnvIntensity))}),
      resetImuLook: () => set({...IMU_LOOK_DEFAULTS}),
      setImuModelOffsetX: (imuModelOffsetX) => set({imuModelOffsetX: Math.max(-180, Math.min(180, imuModelOffsetX))}),
      setImuModelOffsetY: (imuModelOffsetY) => set({imuModelOffsetY: Math.max(-180, Math.min(180, imuModelOffsetY))}),
      setImuModelOffsetZ: (imuModelOffsetZ) => set({imuModelOffsetZ: Math.max(-180, Math.min(180, imuModelOffsetZ))}),
      resetImuModelOffset: () => set({...IMU_MODEL_OFFSET_DEFAULTS}),
    }),
    {
      name: 'openmower-ui',
      version: 7,
      // v0 used 'white' as the plain-background style; rename it on load.
      // v1 → v2 introduces the appearance-prefs block; v2 → v3 adds the
      // batch-2 appearance keys (accent, font scale, radius, motion, page
      // header, mower colours). v3 → v4 prepends the new __menu__/__quick__
      // action items to bottomBarItems so existing users keep their Menu
      // trigger after the upgrade. v4 → v5 adds the IMU model orientation
      // offsets (imuModelOffsetX/Y/Z) — no migration logic needed, the missing
      // keys fall through to the store factory's defaults (all 0). v5 → v6 adds
      // the Pilot layout prefs (pilotLayout/pilotSplitSwapped/pilotKeepAwake) —
      // again no migration logic, the missing keys fall through to the factory
      // defaults. v6 → v7 adds the Pilot minimap layout + camera display prefs
      // (pilotMinimapCorner/Size, pilotCameraDisplay) — same story, missing keys
      // fall through to the factory defaults. Missing keys fall through to the
      // store factory's defaults.
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 1 && state?.mapStyle === 'white') {
          state.mapStyle = 'plain';
        }
        if (version < 4 && Array.isArray(state?.bottomBarItems)) {
          const items = state.bottomBarItems as string[];
          const prepend: string[] = [];
          if (!items.includes('__menu__')) prepend.push('__menu__');
          if (!items.includes('__quick__')) prepend.push('__quick__');
          if (prepend.length > 0) {
            state.bottomBarItems = [...prepend, ...items];
          }
        }
        return state as unknown as UiStore;
      },
    },
  ),
);

// Resolve 'system' to the actual preferred mode. Returns null during SSR so
// callers can defer rendering the theme until the client has hydrated.
export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' | null {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return null;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
