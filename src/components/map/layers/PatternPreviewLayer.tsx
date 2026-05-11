'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import type {AreaProps, MapData} from '@/stores/schemas';
import {generateStripes, stripesToPaths, type XY} from '@/utils/stripe-lines';
import {alpha, useTheme} from '@mui/material';
import type {Feature, Polygon} from 'geojson';
import {useEffect, useMemo, useState} from 'react';
import PathLayer from './PathLayer';

const DEFAULT_ANGLE_DEG = 0;
const DEFAULT_TOOL_WIDTH_M = 0.13;
const MAX_STRIPES_PER_AREA = 200;

interface PatternPreviewLayerProps {
  mowingAreas: Feature<Polygon, AreaProps>[];
  /** Outline data already in mower-relative metres (drives the geometry). */
  outlines: XY[][];
  datum?: MapData['datum'];
}

// Optional preview of the planned mowing pattern. Reads
// OM_MOWING_ANGLE_OFFSET (degrees) and OM_TOOL_WIDTH (metres) from the live
// mower config. If meta.config.get() isn't reachable (older backend, broker
// down) we silently use defaults — the preview is purely informational so a
// degraded result is fine.
export default function PatternPreviewLayer({outlines, datum}: PatternPreviewLayerProps) {
  const theme = useTheme();
  const rpc = useSelectedMower((s) => s?.rpc);

  const [angleDeg, setAngleDeg] = useState(DEFAULT_ANGLE_DEG);
  const [toolWidthM, setToolWidthM] = useState(DEFAULT_TOOL_WIDTH_M);

  useEffect(() => {
    let cancelled = false;
    if (!rpc) return;
    rpc.meta.config
      .get()
      .then((cfg) => {
        if (cancelled) return;
        const a = cfg?.['OM_MOWING_ANGLE_OFFSET'];
        const w = cfg?.['OM_TOOL_WIDTH'];
        if (typeof a === 'string' && Number.isFinite(parseFloat(a))) setAngleDeg(parseFloat(a));
        if (typeof w === 'string' && Number.isFinite(parseFloat(w)) && parseFloat(w) > 0) setToolWidthM(parseFloat(w));
      })
      .catch(() => {
        // No backend — keep defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [rpc]);

  const paths = useMemo(() => {
    if (outlines.length === 0) return [];
    const angleRad = (angleDeg * Math.PI) / 180;
    const all: XY[][] = [];
    for (const outline of outlines) {
      const stripes = generateStripes({
        outline,
        angleRad,
        toolWidthM,
        maxStripes: MAX_STRIPES_PER_AREA,
      });
      all.push(...stripesToPaths(stripes));
    }
    return all;
  }, [outlines, angleDeg, toolWidthM]);

  if (paths.length === 0) return null;

  // Muted, semi-transparent so the preview doesn't drown out the map. Brand
  // success.light reads green on both light and dark surfaces.
  const stripeColor = alpha(theme.palette.success.light, 0.55);

  return (
    <PathLayer id="pattern-preview" paths={paths} datum={datum} color={stripeColor} width={1.5} opacity={0.9} dashed />
  );
}
