'use client';

import {usePersistentState} from '@/app/tasks/useCalendarState';
import {useCallback} from 'react';

// Section identifiers for the toggleable GNSS panels. Persisted so the user's
// choice of which panels to show survives reloads (localStorage).
export type GnssSectionId =
  | 'skyplot'
  | 'signals'
  | 'constellations'
  | 'rtk'
  | 'heading'
  | 'rf'
  | 'scatter'
  | 'map'
  | 'trajectory'
  | 'dop'
  | 'charts'
  | 'position';

export const GNSS_SECTIONS: {id: GnssSectionId; label: string}[] = [
  {id: 'skyplot', label: 'Skyplot'},
  {id: 'signals', label: 'Signal strength'},
  {id: 'scatter', label: 'C/N0 vs elevation'},
  {id: 'constellations', label: 'Constellations'},
  {id: 'rtk', label: 'RTK detail'},
  {id: 'heading', label: 'Heading (dual antenna)'},
  {id: 'rf', label: 'RF health & jamming'},
  {id: 'map', label: 'Position map'},
  {id: 'trajectory', label: 'Discrete trajectory'},
  {id: 'dop', label: 'Dilution of precision'},
  {id: 'charts', label: 'Trends'},
  {id: 'position', label: 'Position & velocity'},
];

export type GnssLayout = Record<GnssSectionId, boolean>;

const DEFAULT_LAYOUT: GnssLayout = {
  skyplot: true,
  signals: true,
  scatter: true,
  constellations: true,
  rtk: true,
  heading: true,
  rf: true,
  map: true,
  trajectory: true,
  dop: true,
  charts: true,
  position: true,
};

export function useGnssLayout() {
  const [layout, setLayout] = usePersistentState<GnssLayout>('gnss.layout', DEFAULT_LAYOUT);

  // Merge defaults so a newly added section appears even with an old stored
  // value that predates it.
  const effective: GnssLayout = {...DEFAULT_LAYOUT, ...layout};

  const toggle = useCallback(
    (id: GnssSectionId) => setLayout((prev) => ({...DEFAULT_LAYOUT, ...prev, [id]: !{...DEFAULT_LAYOUT, ...prev}[id]})),
    [setLayout],
  );

  return {layout: effective, toggle};
}
