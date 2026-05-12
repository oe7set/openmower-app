'use client';

import {useMapboxDraw, useMapContext, useMapHover} from '@/contexts/MapContext';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {fallbackDatum, MapData, type AreaProps} from '@/stores/schemas';
import {useUiStore} from '@/stores/uiStore';
import type {AreaFeature} from '@/types/geojson';
import {generateId, splitPolygonWithLine} from '@/utils/area-utils';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import StaticMode from '@mapbox/mapbox-gl-draw-static-mode';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {Box, Dialog, useMediaQuery, useTheme, type SxProps} from '@mui/material';
import bbox from '@turf/bbox';
import {featureCollection} from '@turf/helpers';
import type {Feature, LineString, Polygon} from 'geojson';
import {ActivityIcon, FocusIcon, GlobeIcon, GridIcon, LayoutListIcon, PencilIcon, PlayCircleIcon, RouteIcon, SquareIcon} from 'lucide-react';
import type {Map} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RFullscreenControl, RMap} from 'maplibre-react-components';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DialogOutlet, useDialog} from 'react-dialog-async';
import {shallow} from 'zustand/vanilla/shallow';
import AreasList from './AreasList';
import {mapPalette} from './colors';
import ControlButton from './ControlButton';
import DockingStationMarker from './DockingStationMarker';
import AreaPopup from './AreaPopup';
import {DrawControl} from './DrawControl';
import {drawStyles} from './drawStyles';
import {AreaSettingsDialog} from './edit/AreaSettingsDialog';
import {DownloadButton} from './edit/DownloadButton';
import EditControls from './edit/EditControls';
import {UploadButton} from './edit/UploadButton';
import MapOverlayLayer from './layers/MapOverlayLayer';
import PathLayer from './layers/PathLayer';
import PatternPreviewLayer from './layers/PatternPreviewLayer';
import {mapStyles} from './mapStyles';
import MowerMarker from './MowerMarker';
import RecordingPanel from './recording/RecordingPanel';
import TeleopControls from './teleop/TeleopControls';
import type {BBox} from './types';

interface MowerMapProps {
  mapData: MapData;
  saveMapToMower: () => Promise<void>;
  sx: SxProps;
}

export function MowerMap({mapData, saveMapToMower, sx}: MowerMapProps) {
  const datum = mapData.datum ?? fallbackDatum;
  const {id, editMode, setEditMode, features, setFeatures, drawWorkflow, setDrawWorkflow} = useMapContext();
  const mapRef = useRef<Map>(null);
  const draw = useMapboxDraw();
  const [hoveredId, setHoveredId] = useMapHover();
  const currentState = useSelectedMower((s) => s?.state.current_state);
  const isDocked = useSelectedMower((s) => s?.state.is_charging ?? false);
  // Pure state-gate. xbot_monitoring re-publishes action IDs prefixed by the
  // owning behavior (e.g. `mower_logic:idle/start_area_recording`), so an
  // `isActionEnabled` check would mis-match unless we also filtered against
  // the running behavior. Reading `current_state === 'IDLE'` is equivalent
  // and resilient if `actions/json` has not landed yet on a fresh connect.
  const canStartRecording = currentState === 'IDLE';
  const plannedPath = useSelectedMower((s) => s?.plannedPath ?? []);
  const coveragePath = useSelectedMower((s) => s?.coveragePath ?? []);
  const mowingTrail = useSelectedMower((s) => s?.mowingTrail ?? []);
  const showTeleop = currentState === 'AREA_RECORDING' && !editMode;
  const areas = useMemo(
    () => features.features.filter((feature) => feature.geometry.type === 'Polygon') as Feature<Polygon, AreaProps>[],
    [features],
  );
  const bounds = useRef<BBox>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pathColors = mapPalette(theme);
  const [showAreaList, setShowAreaList] = useState(!isMobile);
  // Persisted view preferences (theme is in uiStore too — these stay aligned).
  const mapStyle = useUiStore((s) => s.mapStyle);
  const setMapStyle = useUiStore((s) => s.setMapStyle);
  const showPlannedPath = useUiStore((s) => s.showPlannedPath);
  const setShowPlannedPath = useUiStore((s) => s.setShowPlannedPath);
  const showCoveragePath = useUiStore((s) => s.showCoveragePath);
  const setShowCoveragePath = useUiStore((s) => s.setShowCoveragePath);
  const showMowingTrail = useUiStore((s) => s.showMowingTrail);
  const setShowMowingTrail = useUiStore((s) => s.setShowMowingTrail);
  const showPatternPreview = useUiStore((s) => s.showPatternPreview);
  const setShowPatternPreview = useUiStore((s) => s.setShowPatternPreview);
  const showSatelliteLayer = mapStyle === 'satellite';

  // Outlines for the pattern preview come straight from mapData (already in
  // mower-relative metres). We only feed the active mowing-areas so obstacles
  // and nav-areas don't generate stripes.
  const patternOutlines = useMemo(() => {
    if (!showPatternPreview) return [];
    return mapData.areas
      .filter((a) => a.properties.type === 'mow' && a.properties.active)
      .map((a) => a.outline);
  }, [mapData.areas, showPatternPreview]);
  const [popupAreaId, setPopupAreaId] = useState<string | null>(null);
  const areaSettingsDialog = useDialog(AreaSettingsDialog);

  // The popup needs a stable reference to the polygon and its index in the
  // mowing-areas list (so map.start_in_area picks the right one). We derive
  // both off the current `features` collection on every render — cheap, and
  // the dialog re-renders only when popupAreaId or features change.
  const popupArea = useMemo<Feature<Polygon, AreaProps> | null>(() => {
    if (!popupAreaId) return null;
    return areas.find((a) => a.id === popupAreaId) ?? null;
  }, [popupAreaId, areas]);
  const popupMowingIndex = useMemo(() => {
    if (!popupArea || popupArea.properties.type !== 'mow') return -1;
    const mowAreas = areas.filter((a) => a.properties.type === 'mow');
    return mowAreas.findIndex((a) => a.id === popupAreaId);
  }, [popupArea, areas, popupAreaId]);

  const fitToBounds = useCallback(
    (immediate: boolean = false) => {
      if (!mapRef.current || !bounds.current) return;
      mapRef.current.fitBounds(bounds.current, {
        padding: {top: 10, bottom: 10, left: 60, right: showAreaList ? 390 : 60},
        duration: immediate ? 0 : 1000,
      });
    },
    [showAreaList],
  );

  useEffect(() => {
    if (!mapRef.current) return;
    const prevBounds = bounds.current;
    if (features.features.length > 0) {
      bounds.current = bbox(features) as BBox;
    } else {
      const {long, lat} = datum;
      bounds.current = [long, lat, long, lat] as BBox;
    }
    // If the bounds have changed, fit to bounds (except in edit mode).
    if (!prevBounds || (!editMode && !shallow(prevBounds, bounds.current))) {
      fitToBounds(true);
    }
  }, [features, mapData.datum, editMode, fitToBounds]);

  // Mirror source for hover hit-testing. Uses promoteId so layer-scoped mouse
  // events return a usable string id.
  const hoverSourceReady = useRef(false);

  const getPolygonData = useCallback(
    () =>
      featureCollection(
        features.features
          .filter((f) => f.geometry.type === 'Polygon')
          .map((f) => ({...f, id: f.id, properties: {...f.properties, id: f.id}})),
      ),
    [features],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !draw) return;

    const onMouseMove = (e: {features?: {id?: string | number}[]}) => {
      const fid = e.features?.[0]?.id != null ? String(e.features[0].id) : null;
      setHoveredId(fid);
    };
    const onMouseLeave = () => {
      setHoveredId(null);
    };

    const setup = () => {
      const data = getPolygonData();
      if (map.getSource('areas-hover')) {
        return;
      }
      map.addSource('areas-hover', {type: 'geojson', data, promoteId: 'id'} as Parameters<typeof map.addSource>[1]);
      map.addLayer({
        id: 'areas-hover-fill',
        type: 'fill',
        source: 'areas-hover',
        paint: {'fill-color': 'transparent', 'fill-opacity': 0},
      });
      hoverSourceReady.current = true;
      map.on('mousemove', 'areas-hover-fill', onMouseMove);
      map.on('mouseleave', 'areas-hover-fill', onMouseLeave);
    };

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once('style.load', setup);
    }

    return () => {
      map.off('style.load', setup);
      map.off('mousemove', 'areas-hover-fill', onMouseMove);
      map.off('mouseleave', 'areas-hover-fill', onMouseLeave);
      setHoveredId(null);
      try {
        if (map.getLayer('areas-hover-fill')) map.removeLayer('areas-hover-fill');
        if (map.getSource('areas-hover')) map.removeSource('areas-hover');
      } catch {
        /* map may be destroyed */
      }
      hoverSourceReady.current = false;
    };
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep mirror source in sync with features.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hoverSourceReady.current) return;
    const src = map.getSource('areas-hover') as {setData?: (d: GeoJSON.FeatureCollection) => void} | undefined;
    src?.setData?.(getPolygonData());
  }, [features, getPolygonData]);

  // Stamp user_hovered on Draw features so drawStyles can react to it.
  const prevHoveredIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draw) return;
    const prev = prevHoveredIdRef.current;
    prevHoveredIdRef.current = hoveredId;

    if (prev && prev !== hoveredId) {
      const prevFeature = draw.get(prev);
      if (prevFeature) {
        draw.setFeatureProperty(prev, 'hovered', false);
        draw.add(draw.get(prev)!);
      }
    }
    if (hoveredId) {
      const feature = draw.get(hoveredId);
      if (feature) {
        draw.setFeatureProperty(hoveredId, 'hovered', true);
        draw.add(draw.get(hoveredId)!);
      }
    }
  }, [hoveredId, draw]);

  const handleFeaturesCreated = useCallback(
    (createdFeatures: Feature[]) => {
      if (drawWorkflow?.type === 'split_polygon') {
        draw?.delete(createdFeatures.map((feature) => feature.id as string));
        const areaIdx = features.features.findIndex((feature) => feature.id === drawWorkflow.areaId);
        const area = features.features[areaIdx] as AreaFeature;
        const newAreas = splitPolygonWithLine(area, createdFeatures[0] as Feature<LineString>);
        if (newAreas.length >= 2) {
          for (const [index, newArea] of newAreas.entries()) {
            newArea.id = generateId();
            newArea.properties = JSON.parse(JSON.stringify(area.properties)) as AreaProps;
            newArea.properties.name += ` (${index + 1})`;
          }
          draw?.delete(drawWorkflow.areaId).add(featureCollection(newAreas));
          setFeatures((draft) => {
            draft.features.splice(areaIdx, 1, ...newAreas);
          });
        }
        setDrawWorkflow(null);
      } else {
        areaSettingsDialog.open();
      }
    },
    [areaSettingsDialog, draw, drawWorkflow, setDrawWorkflow, features, setFeatures],
  );

  // Map clicks open the AreaPopup when they fall inside a working/navigation
  // area in view mode. Edit mode is exempt — the draw control owns clicks
  // there. The click coordinates come in lng/lat; we test against each area
  // polygon with @turf/boolean-point-in-polygon.
  const handleMapClick = useCallback(
    (e: {lngLat: {lng: number; lat: number}}) => {
      if (editMode) return;
      const pt: Feature<import('geojson').Point> = {
        type: 'Feature',
        properties: {},
        geometry: {type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat]},
      };
      // Lazy import — keeps the helper out of the SSR bundle for non-map routes.
      import('@turf/boolean-point-in-polygon').then(({booleanPointInPolygon}) => {
        for (const area of areas) {
          if (booleanPointInPolygon(pt, area)) {
            setPopupAreaId(area.id as string);
            return;
          }
        }
        setPopupAreaId(null);
      });
    },
    [editMode, areas],
  );

  return (
    <Box sx={{...sx, overflow: 'hidden', position: 'relative'}}>
      <RMap
        key={id}
        // key={id + JSON.stringify(drawStyles)}
        id={id}
        ref={mapRef}
        style={{width: '100%', height: '100%'}}
        mapStyle={mapStyles[mapData.datum && showSatelliteLayer ? 'satellite' : 'white']}
        initialAttributionControl={false}
        maxZoom={25}
        initialPitchWithRotate={false}
        dragRotate={false}
        onLoad={(e) => e.target.touchZoomRotate.disableRotation()}
        onClick={handleMapClick}
      >
        <DrawControl
          displayControlsDefault={false}
          controls={{trash: true}}
          styles={drawStyles}
          modes={{
            ...MapboxDraw.modes,
            static: StaticMode,
          }}
          defaultMode={editMode ? 'simple_select' : 'static'}
          userProperties={true}
          onFeaturesCreated={handleFeaturesCreated}
        />
        {/* Left controls */}
        {editMode ? (
          <EditControls areas={areas} saveMapToMower={saveMapToMower} />
        ) : (
          <>
            <ControlButton position="top-left" icon={PencilIcon} title="Edit mode" onClick={() => setEditMode(true)} />
            {canStartRecording && (
              <ControlButton
                position="top-left"
                spaced
                icon={PlayCircleIcon}
                title="Start area recording — drive the mower around the perimeter to capture a new mowing area"
                onClick={() => {
                  const {mowers, selected} = useMowersStore.getState();
                  mowers[selected]?.publishAction(MOWER_ACTIONS.startAreaRecording);
                }}
                style={{
                  color: theme.palette.primary.main,
                  boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
                }}
              />
            )}
          </>
        )}

        {/* Right controls */}
        <RFullscreenControl />
        <ControlButton position="top-right" icon={FocusIcon} title="Fit to bounds" onClick={() => fitToBounds()} />
        {mapData.datum && (
          <ControlButton
            position="top-right"
            title="Toggle satellite layer"
            icon={GlobeIcon}
            active={showSatelliteLayer}
            onClick={() => setMapStyle(showSatelliteLayer ? 'white' : 'satellite')}
          />
        )}
        <ControlButton
          position="top-right"
          icon={LayoutListIcon}
          title="Show area list"
          active={showAreaList}
          onClick={() => setShowAreaList(!showAreaList)}
        />
        <ControlButton
          position="top-right"
          spaced
          icon={RouteIcon}
          title="Show planned path"
          active={showPlannedPath}
          onClick={() => setShowPlannedPath(!showPlannedPath)}
        />
        <ControlButton
          position="top-right"
          icon={GridIcon}
          title="Show coverage path"
          active={showCoveragePath}
          onClick={() => setShowCoveragePath(!showCoveragePath)}
        />
        <ControlButton
          position="top-right"
          icon={ActivityIcon}
          title="Show mowed trail"
          active={showMowingTrail}
          onClick={() => setShowMowingTrail(!showMowingTrail)}
        />
        <ControlButton
          position="top-right"
          icon={SquareIcon}
          title="Show mowing pattern preview"
          active={showPatternPreview}
          onClick={() => setShowPatternPreview(!showPatternPreview)}
        />
        <DownloadButton />
        <UploadButton />

        {/* Overlays */}
        {!isMobile && showAreaList && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 60,
              bottom: 10,
              width: '320px',
            }}
          >
            <AreasList areas={areas} onClose={() => setShowAreaList(false)} />
          </Box>
        )}
        {isMobile && (
          <Dialog
            open={showAreaList}
            onClose={() => setShowAreaList(false)}
            disablePortal
            slotProps={{
              paper: {
                sx: {
                  margin: 0,
                  width: 'calc(100% - 3rem)',
                  height: 'calc(100% - 10rem)',
                  maxWidth: 'none',
                  maxHeight: 'none',
                },
              },
            }}
          >
            <AreasList areas={areas} onClose={() => setShowAreaList(false)} />
          </Dialog>
        )}
        {mapData.docking_stations.map((station) => (
          <DockingStationMarker key={station.id} station={station} datum={datum} isDocked={isDocked} />
        ))}
        <MapOverlayLayer datum={mapData.datum} />
        {showMowingTrail && (
          <PathLayer
            id="mowing-trail"
            paths={[mowingTrail]}
            datum={mapData.datum}
            color={pathColors.trail}
            width={2}
            opacity={0.7}
          />
        )}
        {showCoveragePath && (
          <PathLayer
            id="coverage-path"
            paths={coveragePath.map((stripe) => stripe.points)}
            datum={mapData.datum}
            color={pathColors.coverage}
            width={2}
            opacity={0.6}
          />
        )}
        {showPlannedPath && (
          <PathLayer
            id="planned-path"
            paths={[plannedPath]}
            datum={mapData.datum}
            color={pathColors.planned}
            width={3}
            opacity={0.95}
            dashed
          />
        )}
        {showPatternPreview && (
          <PatternPreviewLayer
            mowingAreas={areas.filter((a) => a.properties.type === 'mow')}
            outlines={patternOutlines}
            datum={mapData.datum}
          />
        )}
        <MowerMarker datum={datum} isDocked={isDocked} />
        {showTeleop && <TeleopControls />}
        {currentState === 'AREA_RECORDING' && !editMode && <RecordingPanel />}
        <DialogOutlet />
      </RMap>
      {!editMode && popupArea && (
        <AreaPopup area={popupArea} mowingIndex={popupMowingIndex} onClose={() => setPopupAreaId(null)} />
      )}
    </Box>
  );
}
