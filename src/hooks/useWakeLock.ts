import {useEffect} from 'react';

// Hold a screen Wake Lock while `enabled` is true so the device display stays
// on — used by the Pilot page so the phone doesn't sleep mid-drive. The lock is
// released by the platform whenever the page is hidden (tab switch, lock
// button), so we re-acquire it on visibilitychange. All of this is best-effort:
// the API is gated behind a secure context and absent on some browsers, and a
// request can reject (e.g. low battery) — none of that should surface as an
// error to the caller.
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      // Can't hold a lock while hidden; the re-acquire on visibilitychange
      // handles coming back to the foreground.
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Rejected (battery saver, permissions, …) — leave it released.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
