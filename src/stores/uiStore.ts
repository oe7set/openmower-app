import {create} from 'zustand';
import {persist} from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Units = 'metric' | 'imperial';
export type MapStyle = 'plain' | 'satellite' | 'osm' | 'hybrid';
export type DrawerAnchor = 'left' | 'right';
export type TopBarMode = 'always' | 'autoHide' | 'hidden';
export type Density = 'comfortable' | 'compact';

// Default ordered list of bottom-bar items by path. Mirrors the items
// originally tagged isPrimary in createNavigationItems(). Kept here so
// resetAppearance() and the v1→v2 migration can both reach for it.
export const DEFAULT_BOTTOM_BAR_ITEMS: string[] = ['/', '/map', '/drive', '/tasks'];

interface UiStore {
  themeMode: ThemeMode;
  units: Units;
  mapStyle: MapStyle;
  showPlannedPath: boolean;
  showCoveragePath: boolean;
  showMowingTrail: boolean;
  /** Show a translucent stripe overlay on each mowing area to visualise pattern. */
  showPatternPreview: boolean;
  /** Cap for teleop velocity in [0, 1]. The /drive slider writes this. */
  teleopSpeedCap: number;

  // Appearance / UX prefs (Appearance page)
  drawerAnchor: DrawerAnchor;
  topBarMode: TopBarMode;
  bottomBarEnabled: boolean;
  /** Ordered list of nav-item paths shown in the mobile bottom bar. */
  bottomBarItems: string[];
  /** Desktop-only: collapse the permanent sidebar to icons-only. */
  sidebarCompact: boolean;
  density: Density;

  setThemeMode: (mode: ThemeMode) => void;
  setUnits: (units: Units) => void;
  setMapStyle: (style: MapStyle) => void;
  setShowPlannedPath: (v: boolean) => void;
  setShowCoveragePath: (v: boolean) => void;
  setShowMowingTrail: (v: boolean) => void;
  setShowPatternPreview: (v: boolean) => void;
  setTeleopSpeedCap: (v: number) => void;

  setDrawerAnchor: (v: DrawerAnchor) => void;
  setTopBarMode: (v: TopBarMode) => void;
  setBottomBarEnabled: (v: boolean) => void;
  setBottomBarItems: (v: string[]) => void;
  setSidebarCompact: (v: boolean) => void;
  setDensity: (v: Density) => void;
  /** Restore appearance defaults; theme/units/map overlays are left alone. */
  resetAppearance: () => void;
}

const APPEARANCE_DEFAULTS = {
  drawerAnchor: 'left' as DrawerAnchor,
  topBarMode: 'always' as TopBarMode,
  bottomBarEnabled: true,
  bottomBarItems: DEFAULT_BOTTOM_BAR_ITEMS,
  sidebarCompact: false,
  density: 'comfortable' as Density,
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
      teleopSpeedCap: 0.6,
      ...APPEARANCE_DEFAULTS,
      setThemeMode: (themeMode) => set({themeMode}),
      setUnits: (units) => set({units}),
      setMapStyle: (mapStyle) => set({mapStyle}),
      setShowPlannedPath: (showPlannedPath) => set({showPlannedPath}),
      setShowCoveragePath: (showCoveragePath) => set({showCoveragePath}),
      setShowMowingTrail: (showMowingTrail) => set({showMowingTrail}),
      setShowPatternPreview: (showPatternPreview) => set({showPatternPreview}),
      setTeleopSpeedCap: (teleopSpeedCap) =>
        set({teleopSpeedCap: Math.max(0, Math.min(1, teleopSpeedCap))}),
      setDrawerAnchor: (drawerAnchor) => set({drawerAnchor}),
      setTopBarMode: (topBarMode) => set({topBarMode}),
      setBottomBarEnabled: (bottomBarEnabled) => set({bottomBarEnabled}),
      setBottomBarItems: (bottomBarItems) => set({bottomBarItems}),
      setSidebarCompact: (sidebarCompact) => set({sidebarCompact}),
      setDensity: (density) => set({density}),
      resetAppearance: () => set({...APPEARANCE_DEFAULTS}),
    }),
    {
      name: 'openmower-ui',
      version: 2,
      // v0 used 'white' as the plain-background style; rename it on load.
      // v1 → v2 introduces the appearance-prefs block; missing keys fall
      // through to the store factory's defaults already, so the migration
      // only needs to normalise the legacy mapStyle value.
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 1 && state?.mapStyle === 'white') {
          state.mapStyle = 'plain';
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
