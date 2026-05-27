import {useMowersStore} from '@/stores/mowersStore';
import {useCallback, useEffect, useRef} from 'react';

const PUBLISH_INTERVAL_MS = 100;

interface UseTeleopOptions {
  /**
   * Velocity multiplier in [0, 1]. Applied to both vx and vz before publish so
   * a slider on /drive can attenuate the joystick output without changing the
   * joystick component itself. Defaults to 1.0.
   */
  cap?: number;
}

export function useTeleop({cap = 1}: UseTeleopOptions = {}) {
  const vel = useRef({vx: 0, vz: 0});
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const capRef = useRef(cap);
  useEffect(() => {
    capRef.current = cap;
  }, [cap]);

  // Track which mower the active interval is publishing to, so a mower switch
  // can fire a final zero at the *previous* mower instead of orphaning it
  // mid-motion. Without this, the user driving robot A and selecting robot B
  // in the dropdown leaves robot A driving with its last commanded velocity
  // until the next setVelocity(0) — which may never come if the joystick is
  // released after the switch.
  const activeMowerIndex = useRef<number | null>(null);

  const publishTo = useCallback((mowerIndex: number, vx: number, vz: number) => {
    const {mowers} = useMowersStore.getState();
    const c = Math.max(0, Math.min(1, capRef.current));
    mowers[mowerIndex]?.publishTeleop(vx * c, vz * c);
  }, []);

  const publishCurrent = useCallback(() => {
    const {selected} = useMowersStore.getState();
    activeMowerIndex.current = selected;
    publishTo(selected, vel.current.vx, vel.current.vz);
  }, [publishTo]);

  const setVelocity = useCallback(
    (vx: number, vz: number) => {
      vel.current = {vx: Math.max(-1, Math.min(1, vx)), vz: Math.max(-1, Math.min(1, vz))};

      const moving = vx !== 0 || vz !== 0;
      const wasMoving = interval.current !== null;

      if (moving && !wasMoving) {
        publishCurrent();
        interval.current = setInterval(publishCurrent, PUBLISH_INTERVAL_MS);
      } else if (!moving && wasMoving) {
        clearInterval(interval.current!);
        interval.current = null;
        publishCurrent();
      }
    },
    [publishCurrent],
  );

  // Watch the selected mower; if it changes while we're driving, send a final
  // zero to the previous mower and re-arm the interval against the new one.
  const selected = useMowersStore((s) => s.selected);
  useEffect(() => {
    const previous = activeMowerIndex.current;
    if (previous !== null && previous !== selected) {
      publishTo(previous, 0, 0);
    }
    if (interval.current !== null) {
      // Re-bind the interval to the new mower without losing the current
      // velocity (the user may still be holding the joystick).
      activeMowerIndex.current = selected;
    }
  }, [selected, publishTo]);

  useEffect(() => {
    return () => {
      if (interval.current !== null) clearInterval(interval.current);
      const last = activeMowerIndex.current;
      vel.current = {vx: 0, vz: 0};
      if (last !== null) publishTo(last, 0, 0);
    };
  }, [publishTo]);

  return {setVelocity};
}
