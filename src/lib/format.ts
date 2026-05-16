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
