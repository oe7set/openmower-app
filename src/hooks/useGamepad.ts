import {useEffect, useRef, useState} from 'react';

// Deadzone for the analog stick — below this magnitude the stick is treated as
// centred, so a resting controller never fights the on-screen joystick.
const DEADZONE = 0.12;
// Only re-publish when an axis moves more than this since the last sent value,
// so a near-static stick doesn't flood useTeleop with redundant updates. Zero
// transitions are always sent regardless (see below) so motion stops promptly.
const SEND_EPSILON = 0.02;

interface UseGamepadOptions {
  /** When false the poll loop and connection tracking are disabled entirely. */
  enabled?: boolean;
}

// Drive teleop from a physical gamepad's left stick. Maps the stick to the same
// (vx, vz) convention as the on-screen VirtualJoystick — forward (stick up) is
// vx+, left is vz+ — and forwards it through `onVelocity`, which the Pilot page
// wires to the same useTeleop setVelocity as the touch joystick. The cap is
// applied downstream in useTeleop, so we emit raw [-1, 1] values here.
//
// Returns whether at least one gamepad is currently connected, so the host can
// show an indicator. Browsers only populate navigator.getGamepads() after the
// first input event on a freshly connected pad, hence the connect/disconnect
// listeners in addition to the poll.
export function useGamepad(onVelocity: (vx: number, vz: number) => void, {enabled = true}: UseGamepadOptions = {}): boolean {
  const [connected, setConnected] = useState(false);
  // Keep the callback in a ref so the rAF loop doesn't restart when the host
  // passes a fresh function identity between renders.
  const cbRef = useRef(onVelocity);
  useEffect(() => {
    cbRef.current = onVelocity;
  }, [onVelocity]);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      setConnected(false);
      return;
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      // Recompute from the live list — another pad may still be attached.
      const pads = navigator.getGamepads();
      setConnected(Array.from(pads).some((p) => p));
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    let raf = 0;
    let lastVx = 0;
    let lastVz = 0;
    let wasMoving = false;

    const applyDeadzone = (v: number) => (Math.abs(v) < DEADZONE ? 0 : v);

    const poll = () => {
      const pads = navigator.getGamepads();
      const pad = Array.from(pads).find((p) => p) ?? null;
      if (pad) {
        if (!connected) setConnected(true);
        const vx = applyDeadzone(-(pad.axes[1] ?? 0));
        const vz = applyDeadzone(-(pad.axes[0] ?? 0));
        const moving = vx !== 0 || vz !== 0;
        // Send when crossing into/out of motion, or when either axis has moved
        // enough to matter. This keeps a held-steady stick from spamming while
        // still delivering a prompt zero on release.
        const changed =
          moving !== wasMoving ||
          Math.abs(vx - lastVx) > SEND_EPSILON ||
          Math.abs(vz - lastVz) > SEND_EPSILON;
        if (changed && (moving || wasMoving)) {
          cbRef.current(vx, vz);
          lastVx = vx;
          lastVz = vz;
          wasMoving = moving;
        }
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      // Final zero so releasing focus/unmounting can't leave the mower driving.
      if (wasMoving) cbRef.current(0, 0);
    };
    // `connected` intentionally excluded — it's only read for an early setState
    // guard inside the loop and including it would needlessly restart the rAF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return connected;
}
