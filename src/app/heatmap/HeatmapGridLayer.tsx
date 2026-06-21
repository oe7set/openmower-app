'use client';

import {type MapData} from '@/stores/schemas';
import {datumToRelative, pointToAbsolute} from '@/utils/coordinates';
import type {Feature, FeatureCollection, Polygon} from 'geojson';
import {RLayer, RSource} from 'maplibre-react-components';
import {memo, useMemo} from 'react';
import {colorFor, METRICS, resolveRange, type MetricId, type Sample} from './metrics';

export interface GridCellInfo {
  /** Mean metric value over the samples in the cell (raw units). */
  mean: number;
  /** Number of samples that fell into the cell. */
  count: number;
}

interface HeatmapGridLayerProps {
  id: string;
  samples: Sample[];
  metricId: MetricId;
  datum: NonNullable<MapData['datum']>;
  /** Cell size in metres. Smaller = finer grid (and more polygons). */
  cellSize: number;
  /** Hovered cell stats for the tooltip, or null on leave. */
  onHover?: (info: GridCellInfo | null) => void;
}

// Renders the samples as a binned density-style heatmap: the lawn is divided
// into square cells (in mower-relative metres), the metric is averaged per cell,
// and each cell is drawn as a filled polygon coloured by that average. Unlike
// the per-sample circle layer this fills gaps into a continuous surface and —
// because every sample at the same spot lands in the same cell — naturally
// collapses pause / RTK-loss pile-ups (hundreds of stacked points → one cell).
//
// Aggregation runs in a useMemo over the samples (same dep shape as the circle
// layer), so it only recomputes when the data, metric, datum or cell size
// changes. Metrics that need a rolling window (IMU jerk, composite) are
// precomputed over the raw ordered samples first, then averaged per cell.
function HeatmapGridLayer({id, samples, metricId, datum, cellSize, onHover}: HeatmapGridLayerProps) {
  const metric = METRICS[metricId];

  const featureCollection = useMemo<FeatureCollection<Polygon>>(() => {
    if (samples.length === 0) return {type: 'FeatureCollection', features: []};
    const utmDatum = datumToRelative([datum.long, datum.lat]);

    const precomputed = metric.precompute ? metric.precompute(samples) : undefined;
    const [min, max] = resolveRange(metric, samples, precomputed);
    const span = max - min || 1;

    // Accumulate sum + count per cell key. Binning in relative metres keeps the
    // grid axis-aligned to the lawn regardless of UTM zone.
    const sums = new Map<string, {sum: number; count: number; cx: number; cy: number}>();
    for (let i = 0; i < samples.length; i++) {
      let raw: number | undefined;
      if (precomputed) {
        raw = precomputed[i];
      } else if (metric.value) {
        raw = metric.value(samples[i]);
      }
      if (raw === undefined || !Number.isFinite(raw)) continue;
      const cx = Math.floor(samples[i].x / cellSize);
      const cy = Math.floor(samples[i].y / cellSize);
      const key = `${cx}:${cy}`;
      const entry = sums.get(key);
      if (entry) {
        entry.sum += raw;
        entry.count += 1;
      } else {
        sums.set(key, {sum: raw, count: 1, cx, cy});
      }
    }

    const features: Feature<Polygon>[] = [];
    for (const {sum, count, cx, cy} of sums.values()) {
      const mean = sum / count;
      const t = (mean - min) / span;
      // Cell corners in relative metres → absolute lng/lat.
      const x0 = cx * cellSize;
      const y0 = cy * cellSize;
      const x1 = x0 + cellSize;
      const y1 = y0 + cellSize;
      const ring = [
        pointToAbsolute({x: x0, y: y0}, utmDatum),
        pointToAbsolute({x: x1, y: y0}, utmDatum),
        pointToAbsolute({x: x1, y: y1}, utmDatum),
        pointToAbsolute({x: x0, y: y1}, utmDatum),
        pointToAbsolute({x: x0, y: y0}, utmDatum),
      ];
      features.push({
        type: 'Feature',
        properties: {color: colorFor(metric, t), mean, count},
        geometry: {type: 'Polygon', coordinates: [ring]},
      });
    }
    return {type: 'FeatureCollection', features};
  }, [samples, metric, datum, cellSize]);

  if (featureCollection.features.length === 0) return null;

  return (
    <>
      <RSource id={id} type="geojson" data={featureCollection} />
      <RLayer
        id={`${id}-fill`}
        type="fill"
        source={id}
        paint={{
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.7,
        }}
        onMouseMove={
          onHover
            ? (e) => {
                const f = e.features?.[0];
                const mean = f?.properties?.mean;
                const count = f?.properties?.count;
                if (typeof mean === 'number' && typeof count === 'number') {
                  onHover({mean, count});
                } else {
                  onHover(null);
                }
              }
            : undefined
        }
        onMouseLeave={onHover ? () => onHover(null) : undefined}
      />
    </>
  );
}

// Memoised so a parent hover re-render doesn't re-bin all samples into the grid.
export default memo(HeatmapGridLayer);
