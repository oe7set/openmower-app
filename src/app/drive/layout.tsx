'use client';

import {MapContextProvider} from '@/contexts/MapContext';
import {RMapContextProvider} from 'maplibre-react-components';

// The Drive page embeds the full MowerMap as a translucent overlay, which needs
// the same map providers as /map. A distinct MapContext id keeps its edit/draw
// state isolated from the main map editor.
export default function DriveLayout({children}: {children: React.ReactNode}) {
  return (
    <RMapContextProvider>
      <MapContextProvider id="drive">{children}</MapContextProvider>
    </RMapContextProvider>
  );
}
