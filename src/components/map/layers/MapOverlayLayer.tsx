'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import {type MapData, type OverlayColor, type OverlayPolygon} from '@/stores/schemas';
import {datumToRelative, pointsToAbsolute} from '@/utils/coordinates';
import {useTheme} from '@mui/material';
import type {Feature, FeatureCollection, LineString, Polygon} from 'geojson';
import {RLayer, RSource} from 'maplibre-react-components';
import {useMemo} from 'react';

interface MapOverlayLayerProps {
  datum: NonNullable<MapData['datum']>;
}

export default function MapOverlayLayer({datum}: MapOverlayLayerProps) {
  const polygons = useSelectedMower((s) => s?.mapOverlay.polygons ?? []);
  const theme = useTheme();

  // xbot_msgs MapOverlayPolygon.color is encoded as 0|1|2 (red|green|blue).
  // Mapped to theme palette so dark/light + brand stay consistent.
  const colorByCode: Record<OverlayColor, string> = useMemo(
    () => ({
      0: theme.palette.error.main,
      1: theme.palette.primary.main,
      2: theme.palette.info.main,
    }),
    [theme],
  );

  const featureCollection = useMemo<FeatureCollection>(() => {
    if (polygons.length === 0) return {type: 'FeatureCollection', features: []};
    const utmDatum = datumToRelative([datum.long, datum.lat]);
    const features: Feature[] = polygons.map((poly: OverlayPolygon, idx) => {
      const coords = pointsToAbsolute(poly.poly, utmDatum);
      // Closed polygons need their first point repeated at the end so MapLibre
      // renders them as a ring, not an open chain.
      const ringCoords = poly.is_closed && coords.length > 0 ? [...coords, coords[0]] : coords;
      const geometry: LineString | Polygon = poly.is_closed
        ? {type: 'Polygon', coordinates: [ringCoords]}
        : {type: 'LineString', coordinates: ringCoords};
      return {
        type: 'Feature',
        id: idx,
        properties: {
          color: colorByCode[poly.color],
          line_width: Math.max(1, poly.line_width * 8),
        },
        geometry,
      };
    });
    return {type: 'FeatureCollection', features};
  }, [polygons, datum, colorByCode]);

  if (featureCollection.features.length === 0) return null;

  return (
    <>
      <RSource id="map-overlay" type="geojson" data={featureCollection} />
      <RLayer
        id="map-overlay-line"
        type="line"
        source="map-overlay"
        paint={{
          'line-color': ['get', 'color'],
          'line-width': ['get', 'line_width'],
          'line-opacity': 0.85,
        }}
      />
    </>
  );
}
