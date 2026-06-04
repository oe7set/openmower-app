'use client';

import {mapStyles} from '@/components/map/mapStyles';
import {getLatestGnss} from '@/stores/gnssStore';
import {useUiStore} from '@/stores/uiStore';
import type {GnssSample} from '@/stores/schemas';
import {solutionStep} from '@/lib/gnss';
import {Box, Typography} from '@mui/material';
import type {FeatureCollection, Point, Polygon} from 'geojson';
import type {Map as MlMap} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RLayer, RMap, RSource} from 'maplibre-react-components';
import {useEffect, useMemo, useRef, useState} from 'react';

interface AccuracyMiniMapProps {
  mowerId: string | undefined;
}

// The map polls the non-reactive latest sample on its own slow cadence rather
// than subscribing to the ~2.5 Hz store — maplibre easeTo is comparatively
// expensive, and the mower position only changes meaningfully at ~1 Hz.
const MAP_REFRESH_MS = 1000;

function useThrottledGnss(mowerId: string | undefined): GnssSample | undefined {
  const [s, setS] = useState<GnssSample | undefined>(() => getLatestGnss(mowerId));
  useEffect(() => {
    const tick = () => setS(getLatestGnss(mowerId));
    const lead = setTimeout(tick, 0);
    const id = setInterval(tick, MAP_REFRESH_MS);
    return () => {
      clearTimeout(lead);
      clearInterval(id);
    };
  }, [mowerId]);
  return s;
}

// Build a GeoJSON polygon approximating a circle of `radiusM` metres around
// (lon, lat). 48 segments is smooth enough at this size. Uses an equirectangular
// metre→degree approximation, which is plenty accurate for a few-metre circle.
function circleCollection(lon: number, lat: number, radiusM: number): FeatureCollection<Polygon> {
  const points: [number, number][] = [];
  const segs = 48;
  const dLat = radiusM / 111320; // metres per degree latitude
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * 2 * Math.PI;
    points.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return {
    type: 'FeatureCollection',
    features: [{type: 'Feature', geometry: {type: 'Polygon', coordinates: [points]}, properties: {}}],
  };
}

export default function AccuracyMiniMap({mowerId}: AccuracyMiniMapProps) {
  const mapStyle = useUiStore((s) => s.mapStyle);
  const mapRef = useRef<MlMap | null>(null);
  const lastCenter = useRef<{lon: number; lat: number} | null>(null);
  const sample = useThrottledGnss(mowerId);

  const hasPos = sample !== undefined && (sample.lat !== 0 || sample.lon !== 0);
  const lon = sample?.lon ?? 0;
  const lat = sample?.lat ?? 0;
  const step = sample ? solutionStep({sol: sample.sol, rtk: sample.rtk, ft: sample.ft}) : 0;
  const color = step >= 4 ? '#2e7d32' : step >= 2 ? '#f9a825' : '#e53935';
  // Accuracy circle: clamp tiny RTK-fixed radii up to a visible minimum.
  const radius = Math.max(sample?.hacc ?? 0, 0.05);

  const circle = useMemo(() => (hasPos ? circleCollection(lon, lat, radius) : null), [hasPos, lon, lat, radius]);
  const point = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: [{type: 'Feature', geometry: {type: 'Point', coordinates: [lon, lat]}, properties: {}}],
    }),
    [lon, lat],
  );

  // Reset the recenter baseline when the selected mower changes, so the first
  // ease after a switch is not skipped by the move-threshold below.
  useEffect(() => {
    lastCenter.current = null;
  }, [mowerId]);

  // Recenter only when the position actually moved beyond ~5 cm (≈5e-7°), so a
  // stationary mower under RTK jitter doesn't thrash maplibre with overlapping
  // easeTo animations.
  useEffect(() => {
    if (!mapRef.current || !hasPos) return;
    const prev = lastCenter.current;
    const moved = !prev || Math.abs(lat - prev.lat) > 5e-7 || Math.abs(lon - prev.lon) > 5e-7;
    if (!moved) return;
    lastCenter.current = {lon, lat};
    mapRef.current.easeTo({center: [lon, lat], duration: 400});
  }, [hasPos, lon, lat]);

  if (!hasPos) {
    return (
      <Box sx={{height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Typography variant="body2" color="text.disabled">
          Waiting for a position fix…
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{position: 'relative', height: 260, borderRadius: 1, overflow: 'hidden'}}>
      <RMap
        ref={mapRef}
        style={{width: '100%', height: '100%'}}
        mapStyle={mapStyles[mapStyle] ?? mapStyles['plain']}
        initialCenter={[lon, lat]}
        initialZoom={19}
        initialAttributionControl={false}
        maxZoom={25}
        initialPitchWithRotate={false}
        dragRotate={false}
        onLoad={(e) => e.target.touchZoomRotate.disableRotation()}
      >
        {circle && (
          <>
            <RSource id="gnss-acc" type="geojson" data={circle} />
            <RLayer
              id="gnss-acc-fill"
              type="fill"
              source="gnss-acc"
              paint={{'fill-color': color, 'fill-opacity': 0.15}}
            />
            <RLayer id="gnss-acc-line" type="line" source="gnss-acc" paint={{'line-color': color, 'line-width': 1.5}} />
          </>
        )}
        <RSource id="gnss-pos" type="geojson" data={point} />
        <RLayer
          id="gnss-pos-dot"
          type="circle"
          source="gnss-pos"
          paint={{
            'circle-radius': 5,
            'circle-color': color,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          }}
        />
      </RMap>
      <Box
        sx={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          bgcolor: 'rgba(0,0,0,0.55)',
          color: '#fff',
        }}
      >
        <Typography variant="caption">±{(sample?.hacc ?? 0).toFixed(2)} m</Typography>
      </Box>
    </Box>
  );
}
