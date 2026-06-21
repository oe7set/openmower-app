'use client';

import maplibregl, {type Map as MlMap} from 'maplibre-gl';
import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';

export interface HoverMarkerHandle {
  /** Move the marker to lng/lat, or hide it when passed null. */
  setPosition: (lngLat: [number, number] | null) => void;
}

interface HoverMarkerProps {
  /** The maplibre map instance (from the RMap ref). */
  map: MlMap | null;
}

// An imperative maplibre Marker for the chart↔map hover highlight. A DOM marker
// repositions itself on pan/zoom via a CSS transform and — unlike a GeoJSON
// source — triggers no GL repaint when it moves, so high-frequency hover stays
// cheap. Magenta halo + ring + white core stand out on both colour ramps.
const HoverMarker = forwardRef<HoverMarkerHandle, HoverMarkerProps>(function HoverMarker({map}, ref) {
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.style.pointerEvents = 'none';
    el.style.width = '26px';
    el.style.height = '26px';
    el.innerHTML = `
      <div style="position:absolute;inset:0;border-radius:50%;background:#ff00ff;opacity:0.25"></div>
      <div style="position:absolute;left:5px;top:5px;width:16px;height:16px;border-radius:50%;border:3px solid #ff00ff;box-sizing:border-box"></div>
      <div style="position:absolute;left:10px;top:10px;width:6px;height:6px;border-radius:50%;background:#fff;border:1px solid #ff00ff;box-sizing:border-box"></div>`;
    const marker = new maplibregl.Marker({element: el});
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map]);

  useImperativeHandle(
    ref,
    () => ({
      setPosition: (lngLat) => {
        const marker = markerRef.current;
        if (!marker || !map) return;
        if (lngLat == null) {
          marker.remove();
        } else {
          marker.setLngLat(lngLat);
          // addTo is idempotent — re-adding an already-added marker just moves it.
          marker.addTo(map);
        }
      },
    }),
    [map],
  );

  return null;
});

export default HoverMarker;
