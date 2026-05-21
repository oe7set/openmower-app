// Small formatting helpers shared by the drive page and the telemetry strip.
// Kept in their own module so a string like "—" stays consistent across
// surfaces and so the TelemetryStrip doesn't pull a render-heavy module.

export function fmtDeg(rad?: number): string {
  if (rad === undefined) return '—';
  const deg = (rad * 180) / Math.PI;
  return `${deg.toFixed(1)}°`;
}

export function fmtXY(x?: number, y?: number): string {
  if (x === undefined || y === undefined) return '—';
  return `${x.toFixed(2)}, ${y.toFixed(2)} m`;
}

export function fmtMeters(m?: number): string {
  if (m === undefined) return '—';
  return m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`;
}

// pos_accuracy from the backend now always carries the receiver's
// reported accuracy (Float ~1.5 m, 3D ~30 m, …). 999 is reserved for
// "no GPS data at all" (cold start before any fix). Keep the field
// visible at all times so the user can watch quality drift in real time.
export function fmtAccuracy(m?: number): string {
  if (m === undefined) return '—';
  if (m >= 100) return 'no GPS';
  if (m <= 0) return '—';
  return m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`;
}
