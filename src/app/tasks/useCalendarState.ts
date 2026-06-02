'use client';

import {useCallback, useEffect, useState} from 'react';

// Small localStorage-backed state for the tasks page so a chosen calendar view,
// the focused date, and the list/calendar toggle survive tab switches and
// reloads instead of resetting to month/today every mount. SSR-safe: the
// initial render uses the fallback and we read localStorage only after mount,
// so server and first client render agree (avoiding a hydration mismatch).
export function usePersistentState<T>(
  key: string,
  fallback: T,
  // How to (de)serialize. Defaults to JSON; the cursor uses a Date codec.
  serialize: (v: T) => string = JSON.stringify,
  deserialize: (s: string) => T = JSON.parse,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(fallback);

  // Read the stored value once on the client after mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(deserialize(raw));
    } catch {
      // Corrupt/unavailable storage: keep the fallback.
    }
    // Only re-read when the key changes; deserialize is stable per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, serialize(next));
        } catch {
          // Ignore write failures (private mode, quota, etc.).
        }
        return next;
      });
    },
    [key, serialize],
  );

  return [value, set];
}

// Codec for persisting a Date as an ISO 'YYYY-MM-DD' day key.
export const dateCodec = {
  serialize: (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    const y = c.getFullYear();
    const m = `${c.getMonth() + 1}`.padStart(2, '0');
    const day = `${c.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  deserialize: (s: string): Date => {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  },
};
