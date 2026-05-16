import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {MapData} from './schemas';

type Datum = NonNullable<MapData['datum']>;

interface DatumCacheStore {
  byMower: Record<string, Datum>;
  setDatum: (mowerId: string, datum: Datum) => void;
}

// Cache the most recent datum (GPS origin) per mower so the satellite/OSM/hybrid
// map styles still work when the backend later republishes a map without datum
// (e.g. after a reboot before the GPS origin is locked again).
export const useDatumCacheStore = create<DatumCacheStore>()(
  persist(
    (set) => ({
      byMower: {},
      setDatum: (mowerId, datum) =>
        set((s) => ({byMower: {...s.byMower, [mowerId]: datum}})),
    }),
    {name: 'openmower-datum-cache', version: 1},
  ),
);
