'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import type {Datum} from '@/stores/schemas';
import {alpha, useTheme} from '@mui/material';
import {useMemo} from 'react';
import MapMarker from './MapMarker';

export const MOWER_LENGTH_M = 0.55;

interface MowerArrowProps {
  /** Scale factor relative to full size (default 1) */
  scale?: number;
  fill: string;
}

/**
 * Mower arrow shape centered at (16, 16) in a 32×32 viewBox, pointing up (forward at 0° heading).
 * Half-width=10, half-height=13.
 */
export function MowerArrow({scale = 1, fill}: MowerArrowProps) {
  const cx = 16;
  const cy = 16;
  const hw = 10 * scale;
  const hh = 13 * scale;
  const notch = 6 * scale;
  return (
    <path
      d={`M${cx} ${cy - hh} L${cx + hw} ${cy + hh} L${cx} ${cy + hh - notch} L${cx - hw} ${cy + hh} Z`}
      fill={fill}
      stroke="#fff"
      strokeWidth={2 * scale}
      strokeLinejoin="round"
    />
  );
}

interface MowerMarkerProps {
  datum: Datum;
}

export default function MowerMarker({datum}: MowerMarkerProps) {
  // Scalar selectors so the marker only re-renders when the displayed pose
  // changes — `state.pose` is a fresh reference on every robot_state message.
  const x = useSelectedMower((s) => s?.state.pose.x);
  const y = useSelectedMower((s) => s?.state.pose.y);
  const heading = useSelectedMower((s) => s?.state.pose.heading ?? 0);
  const posAccuracy = useSelectedMower((s) => s?.state.pose.pos_accuracy);
  const hasPose = useSelectedMower((s) => Boolean(s?.state.pose));
  const theme = useTheme();

  const position = useMemo(() => {
    if (x === undefined || y === undefined) return null;
    return {x, y};
  }, [x, y]);

  if (!position || !hasPose) return null;

  const hasAccuracy = posAccuracy !== undefined && posAccuracy > 0;
  const markerColor = hasAccuracy ? theme.palette.primary.main : theme.palette.error.main;
  // pos_accuracy is the radius (1-sigma) in meters; MapMarker's sizeM is the
  // bounding diameter, so multiply by 2.
  const accuracyDiameterM = hasAccuracy ? (posAccuracy as number) * 2 : 0;

  return (
    <>
      {hasAccuracy && (
        <MapMarker
          position={position}
          heading={0}
          sizeM={accuracyDiameterM}
          datum={datum}
          className="mower-accuracy-circle"
        >
          {(sizePx) => (
            <svg width={sizePx} height={sizePx} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle
                cx={16}
                cy={16}
                r={15}
                fill={alpha(theme.palette.primary.main, 0.15)}
                stroke={alpha(theme.palette.primary.main, 0.5)}
                strokeWidth={1}
              />
            </svg>
          )}
        </MapMarker>
      )}
      <MapMarker position={position} heading={heading} sizeM={MOWER_LENGTH_M} datum={datum} className="mower-marker">
        {(sizePx) => (
          <svg width={sizePx} height={sizePx} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <MowerArrow fill={markerColor} />
          </svg>
        )}
      </MapMarker>
    </>
  );
}
