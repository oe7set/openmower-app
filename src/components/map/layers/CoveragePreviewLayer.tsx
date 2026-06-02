'use client';

import type {CoveragePreview} from '@/contexts/MapContext';
import type {MapData} from '@/stores/schemas';
import PathLayer from './PathLayer';

interface CoveragePreviewLayerProps {
  preview: CoveragePreview;
  datum: NonNullable<MapData['datum']>;
  fillColor: string;
  outlineColor: string;
}

// Renders the on-demand slic3r coverage preview computed for a single area.
// Fill passes and outline (perimeter) passes are drawn in distinct colours so
// the user can tell the boundary loops from the infill. Points arrive already
// in mower-relative metres (like Area.outline); PathLayer projects them.
export default function CoveragePreviewLayer({preview, datum, fillColor, outlineColor}: CoveragePreviewLayerProps) {
  const fillPaths = preview.paths.filter((p) => !p.is_outline).map((p) => p.points);
  const outlinePaths = preview.paths.filter((p) => p.is_outline).map((p) => p.points);

  return (
    <>
      {fillPaths.length > 0 && (
        <PathLayer id="coverage-preview-fill" paths={fillPaths} datum={datum} color={fillColor} width={1.5} opacity={0.9} />
      )}
      {outlinePaths.length > 0 && (
        <PathLayer
          id="coverage-preview-outline"
          paths={outlinePaths}
          datum={datum}
          color={outlineColor}
          width={2.5}
          opacity={0.95}
        />
      )}
    </>
  );
}
