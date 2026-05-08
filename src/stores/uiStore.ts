import {create} from 'zustand';
import {persist} from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Units = 'metric' | 'imperial';
export type MapStyle = 'white' | 'satellite';

interface UiStore {
  themeMode: ThemeMode;
  units: Units;
  mapStyle: MapStyle;
  showPlannedPath: boolean;
  showCoveragePath: boolean;
  showMowingTrail: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setUnits: (units: Units) => void;
  setMapStyle: (style: MapStyle) => void;
  setShowPlannedPath: (v: boolean) => void;
  setShowCoveragePath: (v: boolean) => void;
  setShowMowingTrail: (v: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      themeMode: 'system',
      units: 'metric',
      mapStyle: 'white',
      showPlannedPath: true,
      showCoveragePath: false,
      showMowingTrail: false,
      setThemeMode: (themeMode) => set({themeMode}),
      setUnits: (units) => set({units}),
      setMapStyle: (mapStyle) => set({mapStyle}),
      setShowPlannedPath: (showPlannedPath) => set({showPlannedPath}),
      setShowCoveragePath: (showCoveragePath) => set({showCoveragePath}),
      setShowMowingTrail: (showMowingTrail) => set({showMowingTrail}),
    }),
    {name: 'openmower-ui'},
  ),
);

// Resolve 'system' to the actual preferred mode. Returns null during SSR so
// callers can defer rendering the theme until the client has hydrated.
export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' | null {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return null;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
