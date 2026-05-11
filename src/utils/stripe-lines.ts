// Generate parallel stripe segments that cover a polygon, simulating how the
// mower will cut. All coordinates are in mower-relative metres (the MapData
// outline format) — we never touch lng/lat here so callers can hand the result
// straight to PathLayer.
//
// Algorithm:
//   1. Rotate the outline by -angle so stripes become axis-aligned (along x).
//   2. Walk parallel scanlines at constant y (every `toolWidthM`).
//   3. Each scanline is intersected with every polygon edge; intersections are
//      sorted by x and paired up to yield "inside" segments.
//   4. Endpoints are rotated back by +angle, producing stripes in the original
//      frame.
//
// Notes:
// - Pure function. No turf / no GeoJSON. Easy to unit-test if we ever add a
//   runner.
// - Polygons are assumed to be simple (no self-intersection). Holes aren't
//   supported here — mowing-areas in this app don't carry holes either.
// - Performance guard: caller picks an effective stripe width so total stripes
//   stay below MAX_STRIPES; we don't auto-throttle inside.

export interface XY {
  x: number;
  y: number;
}

export interface StripeOptions {
  /** Outline points (closed polygon — first point may but doesn't need to repeat). */
  outline: XY[];
  /** Mowing angle in radians. 0 means stripes run along +x. */
  angleRad: number;
  /** Distance between stripe centres in metres. */
  toolWidthM: number;
  /** Hard cap on emitted stripes. Anything past the cap is silently dropped. */
  maxStripes?: number;
}

const EPS = 1e-9;

export function generateStripes({outline, angleRad, toolWidthM, maxStripes = 200}: StripeOptions): Array<[XY, XY]> {
  if (outline.length < 3 || toolWidthM <= 0) return [];
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const rotForward = (p: XY): XY => ({x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos});
  const cosBack = Math.cos(angleRad);
  const sinBack = Math.sin(angleRad);
  const rotBack = (p: XY): XY => ({x: p.x * cosBack - p.y * sinBack, y: p.x * sinBack + p.y * cosBack});

  // Rotate the outline so stripes are horizontal in this frame.
  const rotated = outline.map(rotForward);

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of rotated) {
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return [];

  // Collect edges as pairs in the rotated frame.
  const edges: Array<[XY, XY]> = [];
  for (let i = 0; i < rotated.length; i++) {
    const a = rotated[i];
    const b = rotated[(i + 1) % rotated.length];
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) continue;
    edges.push([a, b]);
  }

  const stripes: Array<[XY, XY]> = [];
  // Start half a stripe in from yMin so the first stripe doesn't sit exactly on
  // the bbox edge (which produces edge-case scanline hits).
  const firstY = yMin + toolWidthM / 2;
  for (let y = firstY; y < yMax && stripes.length < maxStripes; y += toolWidthM) {
    const xs: number[] = [];
    for (const [a, b] of edges) {
      // Skip edges that don't cross y. Using a half-open interval avoids
      // double-counting shared vertices.
      const yMinE = Math.min(a.y, b.y);
      const yMaxE = Math.max(a.y, b.y);
      if (y < yMinE - EPS || y >= yMaxE - EPS) continue;
      const t = (y - a.y) / (b.y - a.y);
      xs.push(a.x + t * (b.x - a.x));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    // Pair intersections to get inside-segments. Even count expected for
    // simple polygons; if odd (numerical edge case), drop the last.
    for (let i = 0; i + 1 < xs.length; i += 2) {
      stripes.push([rotBack({x: xs[i], y}), rotBack({x: xs[i + 1], y})]);
      if (stripes.length >= maxStripes) break;
    }
  }
  return stripes;
}

/**
 * Convert stripe segments to the path shape PathLayer expects:
 * `Array<Array<{x,y}>>` — one tiny 2-point line per stripe.
 */
export function stripesToPaths(stripes: Array<[XY, XY]>): Array<XY[]> {
  return stripes.map(([a, b]) => [a, b]);
}
