import MapboxDraw, {type DrawMode} from '@mapbox/mapbox-gl-draw';
import {featureCollection} from '@turf/helpers';
import {Feature, FeatureCollection} from 'geojson';
import {Draft, produce} from 'immer';
import {useMap as useMapLibreMap} from 'maplibre-react-components';
import {createContext, Dispatch, SetStateAction, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {Updater, useImmer} from 'use-immer';

type SetFeatures = (
  recipe: FeatureCollection | ((draft: Draft<FeatureCollection>) => void),
  userChange?: boolean,
) => void;

interface MapContextType {
  id: string;
  features: FeatureCollection;
  setFeatures: SetFeatures;
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
  // Note that here is where we keep the correct order of features (mapbox-gl-draw doesn't maintain it).
  const [features, setFeaturesImmer] = useImmer<FeatureCollection>(featureCollection([]));
  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(MapboxDraw.constants.modes.STATIC);
  const [drawWorkflow, setDrawWorkflow] = useImmer<Workflow | null>(null);
  const [trashEnabled, setTrashEnabled] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [past, setPast] = useState<FeatureCollection[]>([]);
  const [future, setFuture] = useState<FeatureCollection[]>([]);

  // Keep a ref to the current features so undo/redo callbacks don't go stale.
  const featuresRef = useRef(features);
  featuresRef.current = features;

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

  useEffect(() => {
    if (!editMode) {
      setPast([]);
      setFuture([]);
    }
  }, [editMode]);

  return (
    <MapContext
      value={{
        id,
        features,
        setFeatures,
        editMode,
        setEditMode,
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

export function useMapHover(): [string | null, Dispatch<SetStateAction<string | null>>] {
  const {hoveredId, setHoveredId} = useMapContext();
  return [hoveredId, setHoveredId];
}

export function useMapSelection() {
  const map = useMap();
  const draw = useMapboxDraw();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (map && draw) {
      setSelectedIds(draw.getSelectedIds());
      const updateSelectedIds = ({features}: {features: Feature[]}) => {
        setSelectedIds(features.map((feature) => feature.id as string));
      };
      map?.on('draw.selectionchange', updateSelectedIds);
      return () => {
        map.off('draw.selectionchange', updateSelectedIds);
      };
    } else {
      setSelectedIds([]);
    }
  }, [map, draw]);
  return selectedIds;
}
