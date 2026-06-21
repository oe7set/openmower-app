import uPlot from 'uplot';
import {METRICS, type Sample} from './metrics';

// Multi-signal time-series definitions for the heatmap chart panel. Twin of the
// standalone viewer's src/chart.ts (openmower-heatmap-viewer) — keep the signal
// set and uPlot option shape in sync between the two.
//
// A plottable signal: raw engineering units (no normalisation), its own colour
// and y-scale so several can share one chart with independent axes. `extract`
// returns the value for a single sample; `precompute` runs once over the ordered
// samples (windowed derivations like speed). Missing values become line gaps.
export interface SignalDef {
  key: string;
  label: string;
  unit: string;
  color: string;
  extract?: (s: Sample) => number | undefined;
  precompute?: (samples: Sample[]) => Float32Array;
}

// Reuse the heatmap metric derivations so the chart's speed/tilt match the map.
const speedPrecompute = METRICS.speed.precompute!;
const tiltValue = METRICS.tilt.value!;

export const SIGNALS: SignalDef[] = [
  {key: 'om_mow_motor_current', label: 'Mow current', unit: 'A', color: '#ef4444', extract: (s) => s.om_mow_motor_current},
  {key: 'om_mow_motor_rpm', label: 'Mow RPM', unit: 'rpm', color: '#3b82f6', extract: (s) => s.om_mow_motor_rpm},
  {key: 'om_mow_esc_temp', label: 'Mow ESC temp', unit: '°C', color: '#f97316', extract: (s) => s.om_mow_esc_temp},
  {key: 'om_mow_motor_temp', label: 'Mow motor temp', unit: '°C', color: '#fb923c', extract: (s) => s.om_mow_motor_temp},
  {key: 'om_left_esc_temp', label: 'Left ESC temp', unit: '°C', color: '#22c55e', extract: (s) => s.om_left_esc_temp},
  {key: 'om_right_esc_temp', label: 'Right ESC temp', unit: '°C', color: '#14b8a6', extract: (s) => s.om_right_esc_temp},
  {key: 'om_v_battery', label: 'Battery', unit: 'V', color: '#a855f7', extract: (s) => s.om_v_battery},
  {key: 'gps_accuracy', label: 'GPS accuracy', unit: 'm', color: '#eab308', extract: (s) => s.gps_accuracy},
  {key: 'gps_satellite_count', label: 'GPS sats', unit: '', color: '#84cc16', extract: (s) => s.gps_satellite_count},
  {key: 'gps_pdop', label: 'GPS PDOP', unit: '', color: '#06b6d4', extract: (s) => s.gps_pdop},
  {key: 'wifi_dbm', label: 'WLAN', unit: 'dBm', color: '#ec4899', extract: (s) => s.wifi_dbm},
  {key: 'speed', label: 'Speed', unit: 'm/s', color: '#f59e0b', precompute: speedPrecompute},
  {key: 'tilt', label: 'Tilt', unit: '°', color: '#8b5cf6', extract: tiltValue},
];

export const SIGNAL_BY_KEY: Record<string, SignalDef> = Object.fromEntries(SIGNALS.map((s) => [s.key, s]));

// Which signals actually have data in this session — used to disable chips for
// signals the recorder never wrote.
export function availableSignals(samples: Sample[]): Set<string> {
  const out = new Set<string>();
  if (samples.length === 0) return out;
  for (const sig of SIGNALS) {
    if (sig.precompute) {
      // Derivations only need x/y/ts which every sample has.
      out.add(sig.key);
      continue;
    }
    for (const s of samples) {
      const v = sig.extract!(s);
      if (v !== undefined && Number.isFinite(v)) {
        out.add(sig.key);
        break;
      }
    }
  }
  return out;
}

// Build uPlot data: index [0..n-1] for x, then one y-array per selected signal.
// Missing/non-finite values become null so uPlot draws gaps rather than zeros.
export function buildChartData(samples: Sample[], selectedKeys: string[]): uPlot.AlignedData {
  const n = samples.length;
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) x[i] = i;

  const series: Array<Array<number | null>> = [];
  for (const key of selectedKeys) {
    const sig = SIGNAL_BY_KEY[key];
    const col = new Array<number | null>(n);
    if (sig.precompute) {
      const pc = sig.precompute(samples);
      for (let i = 0; i < n; i++) col[i] = Number.isFinite(pc[i]) ? pc[i] : null;
    } else {
      const ex = sig.extract!;
      for (let i = 0; i < n; i++) {
        const v = ex(samples[i]);
        col[i] = v !== undefined && Number.isFinite(v) ? v : null;
      }
    }
    series.push(col);
  }
  return [x, ...series] as uPlot.AlignedData;
}

// Theme-driven colours so the chart matches MUI dark/light mode.
export interface ChartTheme {
  axis: string;
  grid: string;
  ticks: string;
}

// Build uPlot options: one independent scale per selected signal (keyed by the
// signal key) so curves with different ranges (A vs rpm vs °C) don't squash each
// other. The first two selected signals also get a labelled visible axis (left,
// right); beyond that the legend + units carry the scale info.
export function buildChartOpts(
  selectedKeys: string[],
  width: number,
  height: number,
  onCursor: (idx: number | null) => void,
  theme: ChartTheme,
): uPlot.Options {
  const series: uPlot.Series[] = [{label: '#'}]; // x — sample index
  const axes: uPlot.Axis[] = [
    {
      stroke: theme.axis,
      grid: {stroke: theme.grid},
      ticks: {stroke: theme.ticks},
    },
  ];

  selectedKeys.forEach((key, i) => {
    const sig = SIGNAL_BY_KEY[key];
    series.push({
      label: sig.unit ? `${sig.label} (${sig.unit})` : sig.label,
      scale: key,
      stroke: sig.color,
      width: 1.5,
      points: {show: false},
      spanGaps: false,
      value: (_u, v) => (v == null ? '—' : `${(v as number).toFixed(2)}${sig.unit ? ' ' + sig.unit : ''}`),
    });
    if (i < 2) {
      axes.push({
        scale: key,
        side: i === 0 ? 3 : 1, // 3 = left, 1 = right
        stroke: sig.color,
        grid: {show: false},
        ticks: {stroke: sig.color, width: 1},
        size: 52,
      });
    }
  });

  const scales: uPlot.Scales = {x: {time: false}};
  for (const key of selectedKeys) scales[key] = {auto: true};

  return {
    width,
    height,
    scales,
    series,
    axes,
    legend: {show: true, live: true},
    cursor: {
      x: true,
      y: false,
      points: {show: true},
      // Disable uPlot's built-in drag-to-box-zoom so a drag pans instead (see
      // attachDragPan). Zoom is via the wheel; double-click resets.
      drag: {x: false, y: false, setScale: false},
      bind: {
        mouseleave: (_u, _t, handler) => (e) => {
          onCursor(null);
          return handler(e);
        },
      },
    },
    hooks: {
      setCursor: [(u) => onCursor(u.cursor.idx ?? null)],
      ready: [attachWheelZoom, attachDragPan],
    },
  };
}

// Mouse-wheel zoom on the x-axis, centred on the cursor (uPlot has no built-in
// wheel zoom — only drag-select). Wheel up zooms in, down zooms out; the window
// is clamped to the data range. uPlot's double-click resets it.
function attachWheelZoom(u: uPlot) {
  const ZOOM_STEP = 0.1;
  u.over.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const {min, max} = u.scales.x;
      if (min == null || max == null) return;
      const range = max - min;
      if (range <= 0) return;

      const rect = u.over.getBoundingClientRect();
      const frac = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
      const cursorVal = min + frac * range;

      const factor = e.deltaY < 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
      const newRange = range * factor;

      const xs = u.data[0];
      const dataMin = xs.length ? (xs[0] as number) : 0;
      const dataMax = xs.length ? (xs[xs.length - 1] as number) : 1;

      let newMin = cursorVal - frac * newRange;
      let newMax = cursorVal + (1 - frac) * newRange;
      if (newMin < dataMin) newMin = dataMin;
      if (newMax > dataMax) newMax = dataMax;
      if (newMax - newMin < 1) return;

      u.setScale('x', {min: newMin, max: newMax});
    },
    {passive: false},
  );
}

// Drag-to-pan on the x-axis: while zoomed in, press and drag horizontally to
// scroll the visible window. Panning is clamped to the data range and keeps the
// current zoom width. A click without movement is left to uPlot (cursor only).
function attachDragPan(u: uPlot) {
  let startX = 0;
  let startMin = 0;
  let startMax = 0;

  const onMove = (e: MouseEvent) => {
    const rect = u.over.getBoundingClientRect();
    if (rect.width <= 0) return;
    const range = startMax - startMin;
    // Pixels dragged → value delta; drag right moves the window left (earlier).
    const dxVal = ((e.clientX - startX) / rect.width) * range;
    const xs = u.data[0];
    const dataMin = xs.length ? (xs[0] as number) : 0;
    const dataMax = xs.length ? (xs[xs.length - 1] as number) : 1;
    let newMin = startMin - dxVal;
    let newMax = startMax - dxVal;
    if (newMin < dataMin) {
      newMax += dataMin - newMin;
      newMin = dataMin;
    }
    if (newMax > dataMax) {
      newMin -= newMax - dataMax;
      newMax = dataMax;
    }
    u.setScale('x', {min: newMin, max: newMax});
  };

  const onUp = () => {
    u.over.style.cursor = '';
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  u.over.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    const {min, max} = u.scales.x;
    if (min == null || max == null) return;
    const xs = u.data[0];
    const dataMin = xs.length ? (xs[0] as number) : 0;
    const dataMax = xs.length ? (xs[xs.length - 1] as number) : 1;
    // Only pan when actually zoomed in (otherwise the full range is shown).
    if (min <= dataMin && max >= dataMax) return;
    startX = e.clientX;
    startMin = min;
    startMax = max;
    u.over.style.cursor = 'grabbing';
    e.preventDefault();
    // Track on window so a drag leaving the plot still pans and ends cleanly;
    // removed on mouseup so listeners never accumulate across chart rebuilds.
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
