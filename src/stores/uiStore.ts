import {create} from 'zustand';
import {persist} from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Units = 'metric' | 'imperial';
export type MapStyle = 'plain' | 'satellite' | 'osm' | 'hybrid';

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
  setThemeMode: (mode: ThemeMode) => void;
  setUnits: (units: Units) => void;
  setMapStyle: (style: MapStyle) => void;
  setShowPlannedPath: (v: boolean) => void;
  setShowCoveragePath: (v: boolean) => void;
  setShowMowingTrail: (v: boolean) => void;
  setShowPatternPreview: (v: boolean) => void;
  setTeleopSpeedCap: (v: number) => void;
}

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
      setThemeMode: (themeMode) => set({themeMode}),
      setUnits: (units) => set({units}),
      setMapStyle: (mapStyle) => set({mapStyle}),
      setShowPlannedPath: (showPlannedPath) => set({showPlannedPath}),
      setShowCoveragePath: (showCoveragePath) => set({showCoveragePath}),
      setShowMowingTrail: (showMowingTrail) => set({showMowingTrail}),
      setShowPatternPreview: (showPatternPreview) => set({showPatternPreview}),
      setTeleopSpeedCap: (teleopSpeedCap) =>
        set({teleopSpeedCap: Math.max(0, Math.min(1, teleopSpeedCap))}),
    }),
    {
      name: 'openmower-ui',
      version: 1,
      // v0 used 'white' as the plain-background style; rename it on load.
      migrate: (persisted, version) => {
        const state = persisted as Partial<UiStore> & {mapStyle?: string};
        if (version < 1 && state?.mapStyle === 'white') {
          state.mapStyle = 'plain';
        }
        return state as UiStore;
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
