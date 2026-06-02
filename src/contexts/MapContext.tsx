import {fallbackDatum, type Datum} from '@/stores/schemas';
import {detectFeatureIssues, type MapIssue} from '@/utils/map-issues';
import MapboxDraw, {type DrawMode} from '@mapbox/mapbox-gl-draw';
import bbox from '@turf/bbox';
import {featureCollection} from '@turf/helpers';
import {Feature, FeatureCollection} from 'geojson';
import {Draft, produce} from 'immer';
import {useMap as useMapLibreMap} from 'maplibre-react-components';
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {Updater, useImmer} from 'use-immer';

type Bounds = [west: number, south: number, east: number, north: number];

function useBounds(features: FeatureCollection, datum: Datum): Bounds {
  // Identity may churn on every render — consumers that care about reacting only
  // to content changes should depend on the four numbers individually (see
  // MowerMap's bounds-changed effect).
  return useMemo<Bounds>(() => {
    return features.features.length > 0
      ? (bbox(features) as Bounds)
      : [datum.long, datum.lat, datum.long, datum.lat];
  }, [features, datum]);
}

type SetFeatures = (
  recipe: FeatureCollection | ((draft: Draft<FeatureCollection>) => void),
  userChange?: boolean,
) => void;

// One slic3r path of the on-demand coverage preview: a polyline in mower-
// relative metres, flagged as an outline pass or a fill pass.
export interface CoveragePreviewPath {
  is_outline: boolean;
  points: {x: number; y: number}[];
}

// The result of a coverage.preview call, held ephemerally on the map context so
// the dialog that requested it and the layer that renders it stay decoupled.
export interface CoveragePreview {
  /** Id of the area the preview was computed for. */
  areaId: string;
  paths: CoveragePreviewPath[];
  fillFallback: boolean;
}

interface MapContextType {
  id: string;
  datum: Datum;
  setDatum: Dispatch<SetStateAction<Datum>>;
  features: FeatureCollection;
  setFeatures: SetFeatures;
  bounds: Bounds;
  issues: MapIssue[];
  editMode: boolean;
  setEditMode: Dispatch<SetStateAction<boolean>>;
  drawMode: DrawMode;
  setDrawMode: Dispatch<SetStateAction<DrawMode>>;
  drawWorkflow: Workflow | null;
  setDrawWorkflow: Updater<Workflow | null>;
  trashEnabled: boolean;
  setTrashEnabled: Dispatch<SetStateAction<boolean>>;
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => FeatureCollection | null;
  redo: () => FeatureCollection | null;
  hoveredId: string | null;
  setHoveredId: Dispatch<SetStateAction<string | null>>;
  coveragePreview: CoveragePreview | null;
  setCoveragePreview: Dispatch<SetStateAction<CoveragePreview | null>>;
}

interface SplitPolygonWorkflow {
  type: 'split_polygon';
  areaId: string;
}

type Workflow = SplitPolygonWorkflow;

const MAX_HISTORY_STEPS = 10;

export function displaySortKey(idx: number, type: string | undefined, features: Feature[]): number {
  return (type === 'obstacle' ? features.length : 0) + idx;
}

export function withDisplaySortKeys(fc: FeatureCollection): FeatureCollection {
  return produce(fc, (draft) => {
    draft.features.forEach((f, i) => {
      f.properties ??= {};
      f.properties.sort_key = displaySortKey(i, f.properties.type, fc.features);
    });
  });
}

export const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapContextProvider = ({id, children}: {id: string; children: React.ReactNode}) => {
  const [datum, setDatum] = useState<Datum>(fallbackDatum);
  // Note that here is where we keep the correct order of features (mapbox-gl-draw doesn't maintain it).
  const [features, setFeaturesImmer] = useImmer<FeatureCollection>(featureCollection([]));
  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(MapboxDraw.constants.modes.STATIC);
  const [drawWorkflow, setDrawWorkflow] = useImmer<Workflow | null>(null);
  const [trashEnabled, setTrashEnabled] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [coveragePreview, setCoveragePreview] = useState<CoveragePreview | null>(null);
  const [past, setPast] = useState<FeatureCollection[]>([]);
  const [future, setFuture] = useState<FeatureCollection[]>([]);

  const bounds = useBounds(features, datum);
  const issues = useMemo(() => features.features.flatMap(detectFeatureIssues), [features]);

  // Keep a ref to the current features so undo/redo callbacks don't go stale.
  const featuresRef = useRef(features);
  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  const setFeatures = useCallback<SetFeatures>(
    (recipe, userChange = true) => {
      if (userChange) {
        setPast((prev) => [...prev, featuresRef.current].slice(-MAX_HISTORY_STEPS));
        setFuture([]);
      }
      setFeaturesImmer(recipe as Parameters<typeof setFeaturesImmer>[0]);
      setHasUnsavedChanges(userChange);
    },
    [setFeaturesImmer],
  );

  const undo = useCallback((): FeatureCollection | null => {
    const prev = past;
    if (prev.length === 0) return null;
    const snapshot = prev[prev.length - 1];
    setPast(prev.slice(0, -1));
    setFuture((f) => [featuresRef.current, ...f]);
    setFeaturesImmer(snapshot);
    setHasUnsavedChanges(prev.length > 1);
    return snapshot;
  }, [past, setFeaturesImmer]);

  const redo = useCallback((): FeatureCollection | null => {
    const prev = future;
    if (prev.length === 0) return null;
    const snapshot = prev[0];
    setFuture(prev.slice(1));
    setPast((p) => [...p, featuresRef.current].slice(-MAX_HISTORY_STEPS));
    setFeaturesImmer(snapshot);
    setHasUnsavedChanges(true);
    return snapshot;
  }, [future, setFeaturesImmer]);

  // Wrap setEditMode so leaving edit mode also clears the undo/redo history.
  // Doing this here (instead of in an effect on editMode) keeps the reset
  // synchronous with the user's intent and avoids a setState-in-effect pass.
  const setEditModeWrapped = useCallback<Dispatch<SetStateAction<boolean>>>((next) => {
    setEditMode((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (!value) {
        setPast([]);
        setFuture([]);
      }
      return value;
    });
  }, []);

  return (
    <MapContext
      value={{
        id,
        datum,
        setDatum,
        features,
        setFeatures,
        bounds,
        issues,
        editMode,
        setEditMode: setEditModeWrapped,
        drawMode,
        setDrawMode,
        drawWorkflow,
        setDrawWorkflow,
        trashEnabled,
        setTrashEnabled,
        hasUnsavedChanges,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        undo,
        redo,
        hoveredId,
        setHoveredId,
        coveragePreview,
        setCoveragePreview,
      }}
    >
      {children}
    </MapContext>
  );
};

export function useMapContext() {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error('useMapContext() must be used within a MapContextProvider');
  }
  return ctx;
}

export function useMap() {
  const {id} = useMapContext();
  return useMapLibreMap(id);
}

export function useMapboxDraw() {
  const map = useMap();
  return map?._controls.find((control) => control instanceof MapboxDraw) ?? null;
}

export function useFitToBounds() {
  const map = useMap();
  const {bounds} = useMapContext();
  return useCallback(
    (immediate: boolean = false, padding = {top: 10, bottom: 10, left: 60, right: 60}) => {
      map?.fitBounds(bounds, {padding, duration: immediate ? 0 : 1000});
    },
    [map, bounds],
  );
}

export function useMapHover(): [string | null, Dispatch<SetStateAction<string | null>>] {
  const {hoveredId, setHoveredId} = useMapContext();
  return [hoveredId, setHoveredId];
}

export function useMapSelection() {
  const map = useMap();
  const draw = useMapboxDraw();
  // Track the selection via useSyncExternalStore: getSnapshot is the source of
  // truth (re-evaluated on every selectionchange tick), so React reads the
  // current value during render without an effect-driven mirror state.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!map) return () => {};
      map.on('draw.selectionchange', onChange);
      return () => {
        map.off('draw.selectionchange', onChange);
      };
    },
    [map],
  );
  const cacheRef = useRef<{key: MapboxDraw | null; ids: string[]} | null>(null);
  const getSnapshot = useCallback((): string[] => {
    if (!draw) return EMPTY_SELECTION;
    const ids = draw.getSelectedIds();
    // Cache by content so the snapshot identity is stable while the actual
    // selection is unchanged — required by useSyncExternalStore.
    const cache = cacheRef.current;
    if (cache && cache.key === draw && idsEqual(cache.ids, ids)) {
      return cache.ids;
    }
    cacheRef.current = {key: draw, ids};
    return ids;
  }, [draw]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const EMPTY_SELECTION: string[] = [];

function getServerSnapshot(): string[] {
  return EMPTY_SELECTION;
}

function idsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
