import {useUiStore} from '@/stores/uiStore';

// Curated palette for auto-picking a stable per-mower colour. Hand-picked
// to look distinct on both light and dark surfaces; the order is also the
// preference order for the first few mowers.
const PALETTE = ['#1B9D52', '#1565C0', '#E25822', '#7B5BA6', '#0F766E', '#C2410C', '#9333EA'];

/**
 * Map a stable mower id to a colour from PALETTE. Same id always picks the
 * same colour. The hash is intentionally simple — it just needs to spread
 * a small number of ids across the palette.
 */
export function autoPickMowerColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

/**
 * Resolve the per-mower colour, preferring the user's override from
 * `uiStore.mowerColors` and falling back to a stable hash of the id.
 * Returns undefined when no id is provided so callers can skip rendering
 * the colour treatment cleanly.
 */
export function useMowerColor(id: string | undefined): string | undefined {
  const override = useUiStore((s) => (id ? s.mowerColors[id] : undefined));
  if (!id) return undefined;
  return override ?? autoPickMowerColor(id);
}
