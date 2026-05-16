'use client';

import {type MapData} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute} from '@/utils/coordinates';
import type {Feature, FeatureCollection, Point} from 'geojson';
import {RLayer, RSource} from 'maplibre-react-components';
import {useMemo} from 'react';
import {colorFor, METRICS, resolveRange, type MetricId, type Sample} from './metrics';

interface HeatmapLayerProps {
  id: string;
  samples: Sample[];
  metricId: MetricId;
  datum: NonNullable<MapData['datum']>;
  /** Call when the user hovers a point — used to drive the tooltip overlay. */
  onHover?: (sampleIndex: number | null) => void;
}

// Render telemetry samples as a circle layer. Colours come from the per-metric
// resolver; performance is acceptable for ~10k points without clustering.
//
// We do *not* mount the MapLibre 'mousemove'-driven tooltip in here — the
// parent page owns the popover so it can show the full sample detail. We just
// publish hovered-index back via onHover and let the page render.
export default function HeatmapLayer({id, samples, metricId, datum, onHover}: HeatmapLayerProps) {
  const metric = METRICS[metricId];

  const featureCollection = useMemo<FeatureCollection<Point>>(() => {
    if (samples.length === 0) return {type: 'FeatureCollection', features: []};
    const utmDatum = datumToRelative([datum.long, datum.lat]);

    const precomputed = metric.precompute ? metric.precompute(samples) : undefined;
    const [min, max] = resolveRange(metric, samples, precomputed);
    const span = max - min || 1;

    const features: Feature<Point>[] = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let raw: number | undefined;
      if (precomputed) {
        raw = precomputed[i];
      } else if (metric.value) {
        raw = metric.value(s);
      }
      if (raw === undefined || !Number.isFinite(raw)) continue;
      const t = (raw - min) / span;
      const [lng, lat] = pointToAbsolute({x: s.x, y: s.y}, utmDatum);
      features.push({
        type: 'Feature',
        id: i,
        properties: {color: colorFor(metric, t), idx: i, value: raw},
        geometry: {type: 'Point', coordinates: [lng, lat]},
      });
    }
    return {type: 'FeatureCollection', features};
  }, [samples, metric, datum]);

  if (featureCollection.features.length === 0) return null;

  return (
    <>
      <RSource id={id} type="geojson" data={featureCollection} />
      <RLayer
        id={`${id}-points`}
        type="circle"
        source={id}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 16, 2.5, 22, 6],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': 'rgba(0,0,0,0.3)',
        }}
        onMouseMove={
          onHover
            ? (e) => {
                const f = e.features?.[0];
                const idx = f?.properties?.idx;
                onHover(typeof idx === 'number' ? idx : null);
              }
            : undefined
        }
        onMouseLeave={onHover ? () => onHover(null) : undefined}
      />
    </>
  );
}
