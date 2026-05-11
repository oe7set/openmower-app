'use client';

import {type MapData} from '@/stores/schemas';
import {useTheme} from '@mui/material';
import MapMarker from './MapMarker';
import {MOWER_LENGTH_M, MowerArrow} from './MowerMarker';

const DOCK_PADDING_M = 0.45;
const DOCK_SIZE_M = MOWER_LENGTH_M + DOCK_PADDING_M;

interface DockingStation {
  position: {x: number; y: number};
  heading: number;
}

interface DockingStationMarkerProps {
  station: DockingStation;
  datum: NonNullable<MapData['datum']>;
  isDocked?: boolean;
}

export default function DockingStationMarker({station, datum, isDocked = false}: DockingStationMarkerProps) {
  const theme = useTheme();
  const dockColor = theme.palette.warning.main;
  const dockedAccent = theme.palette.primary.main;

  return (
    <MapMarker
      position={station.position}
      heading={station.heading}
      sizeM={DOCK_SIZE_M}
      datum={datum}
      className="docking-station-marker"
    >
      {(sizePx) => {
        const opacity = isDocked ? 0.6 : 0.3;
        // The chevron sits just above the dock's peak and points "up" in the
        // SVG, so after MapMarker rotates by `heading` it ends up pointing in
        // the heading direction — the orientation the mower assumes when
        // docked. Without it the dock looked symmetric on the map and users
        // couldn't tell which way it was facing.
        const chevronOpacity = isDocked ? 0.9 : 0.7;
        return (
          <svg
            width={sizePx}
            height={sizePx}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            // Allow the heading chevron to render outside the geometric bounds
            // of the icon — viewBox kept at 32×32 so MowerArrow stays centred.
            style={{overflow: 'visible'}}
          >
            <path
              d="M16 2 L30 14 L26 14 L26 29 L6 29 L6 14 L2 14 Z"
              fill={dockColor}
              fillOpacity={opacity}
              stroke={dockColor}
              strokeWidth={1.5}
              strokeOpacity={opacity}
              strokeLinejoin="round"
            />
            <path
              d="M7.5 13.75 L24.5 13.75 M13 28 L13 22 L19 22 L19 28"
              stroke={dockColor}
              strokeWidth={0.75}
              strokeOpacity={opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M11 -3 L16 -5.5 L21 -3"
              stroke={dockColor}
              strokeWidth={1.6}
              strokeOpacity={chevronOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {isDocked && <MowerArrow scale={MOWER_LENGTH_M / DOCK_SIZE_M} fill={dockedAccent} />}
          </svg>
        );
      }}
    </MapMarker>
  );
}
