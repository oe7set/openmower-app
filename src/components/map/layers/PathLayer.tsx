'use client';

import {fallbackDatum, type MapData} from '@/stores/schemas';
import {datumToRelative, pointsToAbsolute} from '@/utils/coordinates';
import type {Feature, FeatureCollection, LineString} from 'geojson';
import {RLayer, RSource} from 'maplibre-react-components';
import {useMemo} from 'react';

interface PathLayerProps {
  id: string;
  /** Either a single polyline (planned/trail) or many short ones (coverage). */
  paths: Array<Array<{x: number; y: number}>>;
  datum?: MapData['datum'];
  color: string;
  /** Pixel width at the rendered zoom — MapLibre interpolates between zooms. */
  width?: number;
  opacity?: number;
  /** When true, the line is drawn as a dashed pattern (useful for the planned path). */
  dashed?: boolean;
}

export default function PathLayer({
  id,
  paths,
  datum,
  color,
  width = 3,
  opacity = 0.85,
  dashed = false,
}: PathLayerProps) {
  const effectiveDatum = datum ?? fallbackDatum;

  const featureCollection = useMemo<FeatureCollection>(() => {
    if (paths.length === 0) return {type: 'FeatureCollection', features: []};
    const utmDatum = datumToRelative([effectiveDatum.long, effectiveDatum.lat]);
    const features: Feature<LineString>[] = paths
      .filter((path) => path.length >= 2)
      .map((path, idx) => ({
        type: 'Feature',
        id: idx,
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: pointsToAbsolute(path, utmDatum),
        },
      }));
    return {type: 'FeatureCollection', features};
  }, [paths, effectiveDatum]);

  if (featureCollection.features.length === 0) return null;

  return (
    <>
      <RSource id={id} type="geojson" data={featureCollection} />
      <RLayer
        id={`${id}-line`}
        type="line"
        source={id}
        paint={{
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
          ...(dashed ? {'line-dasharray': [2, 2]} : {}),
        }}
      />
    </>
  );
}
