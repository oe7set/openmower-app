// Tiny color-ramp helper. Avoids pulling in d3-scale-chromatic (~30 KB) for
// just the few gradients we render.
//
// Each ramp accepts a value normalised to [0, 1] and returns a CSS rgb()
// string. `goodGreen=true` reverses the gradient so high values render as
// the "good" colour (green) — used for signal-quality metrics where higher
// = better. For sensor metrics where higher = worse (motor current,
// temperatures), keep `goodGreen=false`.

type Rgb = [number, number, number];

// Stops sampled from d3-scale-chromatic's interpolateRdYlGn so the look
// matches what the user expects from typical map heatmaps.
const RD_YL_GN: Rgb[] = [
  [165, 0, 38],   // 0.00 — deep red
  [215, 48, 39],  // 0.10
  [244, 109, 67], // 0.25
  [253, 174, 97], // 0.40
  [254, 224, 139],// 0.55
  [217, 239, 139],// 0.70
  [166, 217, 106],// 0.85
  [102, 189, 99], // 0.95
  [26, 152, 80],  // 1.00 — deep green
];

// Sequential dark→light ramp for "intensity" metrics (current, temperature)
// where any extreme is worth flagging. Inspired by inferno but trimmed.
const INFERNO: Rgb[] = [
  [0, 0, 4],
  [40, 11, 84],
  [101, 21, 110],
  [159, 42, 99],
  [212, 72, 66],
  [245, 125, 21],
  [250, 193, 39],
  [252, 255, 164],
];

function interp(stops: Rgb[], t: number): Rgb {
  const clamped = Math.min(1, Math.max(0, t));
  const idx = clamped * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(stops.length - 1, lo + 1);
  const f = idx - lo;
  return [
    Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * f),
    Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * f),
    Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * f),
  ];
}

export function rdYlGn(t: number, goodGreen = true): string {
  const v = goodGreen ? t : 1 - t;
  const [r, g, b] = interp(RD_YL_GN, v);
  return `rgb(${r}, ${g}, ${b})`;
}

export function inferno(t: number): string {
  const [r, g, b] = interp(INFERNO, t);
  return `rgb(${r}, ${g}, ${b})`;
}

// Sample a small set of stops at fixed positions for legend rendering.
export function rampSwatch(metric: 'rdYlGn' | 'inferno', goodGreen = true): string[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) =>
    metric === 'rdYlGn' ? rdYlGn(t, goodGreen) : inferno(t),
  );
}
