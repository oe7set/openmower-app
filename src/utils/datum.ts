import {useDatumCacheStore} from '@/stores/datumCacheStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {fallbackDatum, type MapData} from '@/stores/schemas';

type Datum = NonNullable<MapData['datum']>;

export function resolveDatum(
  mapDatum: Datum | undefined,
  cachedDatum: Datum | undefined,
): {datum: Datum; hasReal: boolean} {
  const real = mapDatum ?? cachedDatum;
  return {datum: real ?? fallbackDatum, hasReal: Boolean(real)};
}

export function useEffectiveDatum() {
  const mowerId = useSelectedMower((s) => s?.id);
  const mapDatum = useSelectedMower((s) => s?.map.datum);
  const cachedDatum = useDatumCacheStore((s) => (mowerId ? s.byMower[mowerId] : undefined));
  return resolveDatum(mapDatum, cachedDatum);
}
