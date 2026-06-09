// Tiny haptic-feedback helper around the Vibration API. A no-op where it isn't
// supported (notably iOS Safari, which never exposes navigator.vibrate), so
// callers can fire it unconditionally without feature-checking at each site.

/**
 * Trigger a short vibration. `pattern` is a single duration in ms or an
 * on/off pattern array (see the Vibration API). Swallows the rare case where a
 * browser throws on an out-of-range pattern instead of returning false.
 */
export function vibrate(pattern: number | number[] = 15): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore — haptics are a nice-to-have, never a failure path.
  }
}
