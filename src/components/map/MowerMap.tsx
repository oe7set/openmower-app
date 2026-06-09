'use client';

import {useFitToBounds, useMapboxDraw, useMapContext, useMapHover} from '@/contexts/MapContext';
import {MOWER_ACTIONS} from '@/lib/mowerActions';
import {useDatumCacheStore} from '@/stores/datumCacheStore';
import {useMowersStore, useSelectedMower} from '@/stores/mowersStore';
import {MapData, type AreaProps} from '@/stores/schemas';
import {useUiStore} from '@/stores/uiStore';
import type {AreaFeature} from '@/types/geojson';
import {generateId, splitPolygonWithLine} from '@/utils/area-utils';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import StaticMode from '@mapbox/mapbox-gl-draw-static-mode';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {Box, useMediaQuery, useTheme, type SxProps} from '@mui/material';
import {featureCollection} from '@turf/helpers';
import type {Feature, LineString, Polygon} from 'geojson';
import {ActivityIcon, FocusIcon, GridIcon, LayoutListIcon, PencilIcon, PlayCircleIcon, RouteIcon, SplineIcon, SquareIcon} from 'lucide-react';
import type {Map} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RFullscreenControl, RMap} from 'maplibre-react-components';
import {useCallback, useEffect, useEffectEvent, useMemo, useRef, useState} from 'react';
import {DialogOutlet, useDialog} from 'react-dialog-async';
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
import {IssuesButton} from './edit/IssuesButton';
import {UploadButton} from './edit/UploadButton';
import CoveragePreviewLayer from './layers/CoveragePreviewLayer';
import MapOverlayLayer from './layers/MapOverlayLayer';
import PathLayer from './layers/PathLayer';
import PatternPreviewLayer from './layers/PatternPreviewLayer';
import MapDialog from './MapDialog';
import {mapStyles} from './mapStyles';
import MapStyleSelector from './MapStyleSelector';
import MowerMarker from './MowerMarker';
import RecordingPanel from './recording/RecordingPanel';
import TeleopControls from './teleop/TeleopControls';

interface MowerMapProps {
  mapData: MapData;
  saveMapToMower: () => Promise<void>;
  sx: SxProps;
  // When true, the map renders as a chrome-less, display-only embed: no edit
  // button, no right-hand layer/style/area controls, no import/export, and no
  // built-in teleop joystick. Used by the Pilot page, which lays the map as a
  // translucent overlay and provides its own controls. Pan/zoom stay enabled.
  embedded?: boolean;
}

export function MowerMap({mapData, saveMapToMower, sx, embedded = false}: MowerMapProps) {
  const mowerId = useSelectedMower((s) => s?.id);
  const cachedDatum = useDatumCacheStore((s) => (mowerId ? s.byMower[mowerId] : undefined));
  const realDatum = mapData.datum ?? cachedDatum;
  const hasRealDatum = Boolean(realDatum);
  // MapContext owns bounds/fitToBounds/issues — its datum is mirrored from
  // MapPage's useEffectiveDatum hook. We use realDatum for our path/marker
  // layers (only render them when a real datum is known, never the fallback).
  const {id, editMode, setEditMode, features, setFeatures, drawWorkflow, setDrawWorkflow, bounds, coveragePreview} =
    useMapContext();
  const mapRef = useRef<Map>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  // Embedded mode brings its own joystick (Pilot page), so suppress the map's.
  const showTeleop = currentState === 'AREA_RECORDING' && !editMode && !embedded;
  const areas = useMemo(
    () => features.features.filter((feature) => feature.geometry.type === 'Polygon') as Feature<Polygon, AreaProps>[],
    [features],
  );
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pathColors = mapPalette(theme);
  const [showAreaList, setShowAreaList] = useState(!isMobile);
  // Persisted view preferences (theme is in uiStore too — these stay aligned).
  const mapStyle = useUiStore((s) => s.mapStyle);
  const showPlannedPath = useUiStore((s) => s.showPlannedPath);
  const setShowPlannedPath = useUiStore((s) => s.setShowPlannedPath);
  const showCoveragePath = useUiStore((s) => s.showCoveragePath);
  const setShowCoveragePath = useUiStore((s) => s.setShowCoveragePath);
  const showMowingTrail = useUiStore((s) => s.showMowingTrail);
  const setShowMowingTrail = useUiStore((s) => s.setShowMowingTrail);
  const showPatternPreview = useUiStore((s) => s.showPatternPreview);
  const setShowPatternPreview = useUiStore((s) => s.setShowPatternPreview);
  const showCoveragePreview = useUiStore((s) => s.showCoveragePreview);
  const setShowCoveragePreview = useUiStore((s) => s.setShowCoveragePreview);

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
  const padding = useMemo(() => ({top: 10, bottom: 10, left: 60, right: showAreaList ? 390 : 60}), [showAreaList]);
  const fitToBounds = useFitToBounds();

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

  const onBoundsChanged = useEffectEvent(() => {
    if (!editMode) fitToBounds(true, padding);
  });

  // Depend on the bounds tuple's primitive values so a re-render of MapContext
  // that produces an equal-but-fresh array doesn't refire the fit.
  const [west, south, east, north] = bounds;
  useEffect(() => {
    onBoundsChanged();
  }, [west, south, east, north]);

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
      // Edit mode owns clicks; embedded mode (e.g. the Pilot page) is
      // display-only, so taps must not pop up area details there.
      if (editMode || embedded) return;
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
    [editMode, embedded, areas],
  );

  // maplibre only listens for *window* resizes, not changes to its own
  // container. Hosts that resize the map box without a window resize (e.g. the
  // Pilot page toggling its overlay/split layout, or swapping the split halves)
  // would otherwise leave the canvas at its old size with grey gutters. Observe
  // the container and call map.resize() on the next frame (rAF-debounced so a
  // burst of layout changes coalesces into one resize).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapRef.current?.resize());
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <Box ref={containerRef} sx={{...sx, overflow: 'hidden', position: 'relative'}}>
      <RMap
        key={id}
        // key={id + JSON.stringify(drawStyles)}
        id={id}
        ref={mapRef}
        style={{width: '100%', height: '100%'}}
        mapStyle={mapStyles[hasRealDatum ? mapStyle : 'plain']}
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
        {/* Left controls — hidden in embedded mode (Pilot is a display-only,
            non-editing overlay). */}
        {editMode ? (
          <EditControls areas={areas} saveMapToMower={saveMapToMower} />
        ) : (
          !embedded && (
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
          )
        )}

        {/* Right controls — the layer/style/area/import/export chrome is
            suppressed in embedded mode so it doesn't collide with the host's
            own control cluster (e.g. the Pilot page). Pan/zoom stay enabled. */}
        {!embedded && (
          <>
            <RFullscreenControl />
            <ControlButton
              position="top-right"
              icon={FocusIcon}
              title="Fit to bounds"
              onClick={() => fitToBounds(false, padding)}
            />
            <MapStyleSelector />
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
            {coveragePreview && (
              <ControlButton
                position="top-right"
                icon={SplineIcon}
                title="Show coverage path preview (slic3r)"
                active={showCoveragePreview}
                onClick={() => setShowCoveragePreview(!showCoveragePreview)}
              />
            )}
            <DownloadButton />
            <UploadButton />
            <IssuesButton />
          </>
        )}

        {/* Overlays. The area list (both the desktop side panel and the mobile
            dialog) is editor chrome, so it is suppressed in embedded mode — its
            toggle button lives in the !embedded controls block, and the Pilot
            page that embeds the map provides its own controls. */}
        {!embedded && !isMobile && showAreaList && (
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
        {!embedded && isMobile && (
          <MapDialog
            open={showAreaList}
            onClose={() => setShowAreaList(false)}
            slotProps={{
              paper: {
                sx: {
                  margin: 0,
                  width: 'calc(100% - 2rem)',
                  height: 'calc(100% - 2rem)',
                  maxWidth: 'none',
                  maxHeight: 'none',
                },
              },
            }}
          >
            <AreasList areas={areas} onClose={() => setShowAreaList(false)} />
          </MapDialog>
        )}
        {realDatum &&
          mapData.docking_stations.map((station) => (
            <DockingStationMarker key={station.id} station={station} datum={realDatum} isDocked={isDocked} />
          ))}
        {realDatum && <MapOverlayLayer datum={realDatum} />}
        {realDatum && showMowingTrail && (
          <PathLayer
            id="mowing-trail"
            paths={[mowingTrail]}
            datum={realDatum}
            color={pathColors.trail}
            width={2}
            opacity={0.7}
          />
        )}
        {realDatum && showCoveragePath && (
          <PathLayer
            id="coverage-path"
            paths={coveragePath.map((stripe) => stripe.points)}
            datum={realDatum}
            color={pathColors.coverage}
            width={2}
            opacity={0.6}
          />
        )}
        {realDatum && showPlannedPath && (
          <PathLayer
            id="planned-path"
            paths={[plannedPath]}
            datum={realDatum}
            color={pathColors.planned}
            width={3}
            opacity={0.95}
            dashed
          />
        )}
        {realDatum && showPatternPreview && (
          <PatternPreviewLayer
            mowingAreas={areas.filter((a) => a.properties.type === 'mow')}
            outlines={patternOutlines}
            datum={realDatum}
          />
        )}
        {realDatum && showCoveragePreview && coveragePreview && (
          <CoveragePreviewLayer
            preview={coveragePreview}
            datum={realDatum}
            fillColor={pathColors.previewFill}
            outlineColor={pathColors.previewOutline}
          />
        )}
        {realDatum && <MowerMarker datum={realDatum} />}
        {showTeleop && <TeleopControls />}
        {currentState === 'AREA_RECORDING' && !editMode && <RecordingPanel />}
        <DialogOutlet />
      </RMap>
      {!editMode && !embedded && popupArea && (
        <AreaPopup area={popupArea} mowingIndex={popupMowingIndex} onClose={() => setPopupAreaId(null)} />
      )}
    </Box>
  );
}
