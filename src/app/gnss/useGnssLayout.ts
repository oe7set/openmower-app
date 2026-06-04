'use client';

import {usePersistentState} from '@/app/tasks/useCalendarState';
import {useCallback} from 'react';

// Section identifiers for the toggleable GNSS panels. Persisted so the user's
// choice of which panels to show survives reloads (localStorage).
export type GnssSectionId = 'skyplot' | 'signals' | 'constellations' | 'dop' | 'charts' | 'position';

export const GNSS_SECTIONS: {id: GnssSectionId; label: string}[] = [
  {id: 'skyplot', label: 'Skyplot'},
  {id: 'signals', label: 'Signal strength'},
  {id: 'constellations', label: 'Constellations'},
  {id: 'dop', label: 'Dilution of precision'},
  {id: 'charts', label: 'Trends'},
  {id: 'position', label: 'Position & velocity'},
];

export type GnssLayout = Record<GnssSectionId, boolean>;

const DEFAULT_LAYOUT: GnssLayout = {
  skyplot: true,
  signals: true,
  constellations: true,
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
