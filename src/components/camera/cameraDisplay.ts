import type {CSSProperties} from 'react';

// Pure, framework-agnostic styling helpers for the camera viewport. Kept out of
// the React component so the store, the settings panel and the stream component
// can all share one source of truth for how a frame is fitted, anchored,
// rotated, mirrored and zoomed. No imports from React/MUI beyond the CSS type.

// How the frame fills its box:
//  - cover:   fill the box, cropping overflow (full-bleed background)
//  - contain: show the whole frame, letterboxing the remainder
//  - fill:    stretch to the box, ignoring aspect ratio
//  - width:   match the box width ("links-rechts passend"); height runs free
//  - height:  match the box height ("höhe passend"); width runs free
export type CameraFit = 'cover' | 'contain' | 'fill' | 'width' | 'height';
// Which part is kept/where the frame sits when there is crop or letterbox slack.
export type CameraAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right';
// Quarter-turn rotation for cameras mounted upside-down or sideways.
export type CameraRotation = 0 | 90 | 180 | 270;

export interface CameraDisplay {
  fit: CameraFit;
  anchor: CameraAnchor;
  rotation: CameraRotation;
  /** Mirror left↔right (e.g. a rear-facing camera). */
  mirrorH: boolean;
  /** Flip top↔bottom. mirrorH+mirrorV together == 180° upside-down. */
  mirrorV: boolean;
  /** Digital zoom multiplier in [1, 3]. */
  zoom: number;
}

export const DEFAULT_CAMERA_DISPLAY: CameraDisplay = {
  fit: 'cover',
  anchor: 'center',
  rotation: 0,
  mirrorH: false,
  mirrorV: false,
  zoom: 1,
};

// Clamp a free-form zoom into the supported range.
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(1, Math.min(3, zoom));
}

const QUARTER_TURN = (r: CameraRotation): boolean => r === 90 || r === 270;

// object-position for cover/contain, derived from the anchor. Only has a visible
// effect when there is crop (cover) or letterbox (contain) slack on that axis.
function anchorObjectPosition(anchor: CameraAnchor): string {
  switch (anchor) {
    case 'top':
      return '50% 0%';
    case 'bottom':
      return '50% 100%';
    case 'left':
      return '0% 50%';
    case 'right':
      return '100% 50%';
    default:
      return '50% 50%';
  }
}

// Flex alignment for the width/height fits, where the media element is naturally
// sized and the wrapper positions the overflow/letterbox via the anchor.
function anchorFlex(anchor: CameraAnchor): {alignItems: string; justifyContent: string} {
  switch (anchor) {
    case 'top':
      return {alignItems: 'flex-start', justifyContent: 'center'};
    case 'bottom':
      return {alignItems: 'flex-end', justifyContent: 'center'};
    case 'left':
      return {alignItems: 'center', justifyContent: 'flex-start'};
    case 'right':
      return {alignItems: 'center', justifyContent: 'flex-end'};
    default:
      return {alignItems: 'center', justifyContent: 'center'};
  }
}

/**
 * Style for the wrapper Box that bounds the camera viewport. Fills its parent,
 * flex-centres the media (anchor-aware for the free-running fits), paints the
 * letterbox black, and — for quarter-turn rotations — becomes a size container
 * so the media can size itself in cqh/cqw units (see cameraMediaStyle).
 */
export function cameraWrapperSx(d: CameraDisplay): CSSProperties {
  const {alignItems, justifyContent} = anchorFlex(d.anchor);
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems,
    justifyContent,
    overflow: 'hidden',
    backgroundColor: '#000',
    // Establish a size container only when needed; the cqh/cqw units below
    // resolve against this box so a rotated frame can fill correctly.
    ...(QUARTER_TURN(d.rotation) ? {containerType: 'size'} : null),
  };
}

/**
 * Style for the media element (<video>/<img>) inside the wrapper. Encodes the
 * fit (element sizing + object-fit), the anchor (object-position), and the
 * rotation/mirror/zoom (transform).
 *
 * Quarter-turn fill: a CSS transform rotates around the element's centre but
 * does NOT re-fit the rotated box to the container. So for 90/270° we size the
 * pre-rotation box in the *swapped* axis using container-query units — width
 * = 100cqh, height = 100cqw — and after the rotation the visual box is exactly
 * the container's width × height. Pure CSS, no measuring/ResizeObserver.
 */
export function cameraMediaStyle(d: CameraDisplay): CSSProperties {
  const quarter = QUARTER_TURN(d.rotation);
  const style: CSSProperties = {display: 'block'};

  switch (d.fit) {
    case 'cover':
    case 'contain':
    case 'fill':
      style.objectFit = d.fit;
      style.objectPosition = anchorObjectPosition(d.anchor);
      style.width = quarter ? '100cqh' : '100%';
      style.height = quarter ? '100cqw' : '100%';
      break;
    case 'width':
      // Match the box width; height runs free (crop/letterbox handled by the
      // wrapper's overflow + anchor flex). Under a quarter turn the displayed
      // width is the element's height, so drive that axis instead.
      if (quarter) {
        style.height = '100cqw';
        style.width = 'auto';
      } else {
        style.width = '100%';
        style.height = 'auto';
      }
      break;
    case 'height':
      if (quarter) {
        style.width = '100cqh';
        style.height = 'auto';
      } else {
        style.height = '100%';
        style.width = 'auto';
      }
      break;
  }

  const sx = (d.mirrorH ? -1 : 1) * d.zoom;
  const sy = (d.mirrorV ? -1 : 1) * d.zoom;
  const transforms: string[] = [];
  if (d.rotation) transforms.push(`rotate(${d.rotation}deg)`);
  if (sx !== 1 || sy !== 1) transforms.push(`scale(${sx}, ${sy})`);
  if (transforms.length) {
    style.transform = transforms.join(' ');
    style.transformOrigin = 'center';
  }

  return style;
}

/**
 * Render the current frame of a video/image source to a PNG data URL, baking in
 * the rotation and mirror so a saved snapshot matches what the user sees. Fit,
 * anchor and zoom are viewport-only concerns (crop/letterbox), so the snapshot
 * deliberately captures the full, correctly-oriented frame. Returns null if the
 * source has no frame yet or the canvas is tainted (cross-origin MJPEG).
 */
export function drawOrientedSnapshot(
  source: HTMLVideoElement | HTMLImageElement,
  srcW: number,
  srcH: number,
  d: Pick<CameraDisplay, 'rotation' | 'mirrorH' | 'mirrorV'>,
): string | null {
  if (!srcW || !srcH) return null;
  const quarter = QUARTER_TURN(d.rotation);
  const canvas = document.createElement('canvas');
  // After a quarter turn the output dimensions are swapped.
  canvas.width = quarter ? srcH : srcW;
  canvas.height = quarter ? srcW : srcH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Move to the canvas centre, apply mirror then rotation, and draw the source
  // centred — the same order the CSS transform uses.
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(d.mirrorH ? -1 : 1, d.mirrorV ? -1 : 1);
  if (d.rotation) ctx.rotate((d.rotation * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
