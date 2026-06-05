// Shared GNSS constellation/band metadata and label helpers for the GNSS page.
// gnss_id follows the u-blox convention used end-to-end (firmware → ROS → app).

import type {GnssSatellite} from '@/stores/schemas';

export const GNSS_GPS = 0;
export const GNSS_SBAS = 1;
export const GNSS_GALILEO = 2;
export const GNSS_BEIDOU = 3;
export const GNSS_QZSS = 5;
export const GNSS_GLONASS = 6;

export interface ConstellationMeta {
  id: number;
  name: string;
  short: string;
  // Single-letter prefix used in u-center-style SV labels (G12, R08, …).
  prefix: string;
  // Stable colour, roughly aligned with u-center's palette.
  color: string;
}

const CONSTELLATIONS: Record<number, ConstellationMeta> = {
  [GNSS_GPS]: {id: GNSS_GPS, name: 'GPS', short: 'GPS', prefix: 'G', color: '#1565c0'},
  [GNSS_GLONASS]: {id: GNSS_GLONASS, name: 'GLONASS', short: 'GLO', prefix: 'R', color: '#2e7d32'},
  [GNSS_GALILEO]: {id: GNSS_GALILEO, name: 'Galileo', short: 'GAL', prefix: 'E', color: '#ef6c00'},
  [GNSS_BEIDOU]: {id: GNSS_BEIDOU, name: 'BeiDou', short: 'BDS', prefix: 'B', color: '#c62828'},
  [GNSS_QZSS]: {id: GNSS_QZSS, name: 'QZSS', short: 'QZSS', prefix: 'Q', color: '#6a1b9a'},
  [GNSS_SBAS]: {id: GNSS_SBAS, name: 'SBAS', short: 'SBAS', prefix: 'S', color: '#607d8b'},
};

const UNKNOWN_CONSTELLATION: ConstellationMeta = {
  id: 255,
  name: 'Unknown',
  short: '?',
  prefix: 'U',
  color: '#9e9e9e',
};

// Order constellations are displayed in (summaries, signal bars).
export const CONSTELLATION_ORDER = [GNSS_GPS, GNSS_GLONASS, GNSS_GALILEO, GNSS_BEIDOU, GNSS_QZSS, GNSS_SBAS];

export function constellation(gnssId: number): ConstellationMeta {
  return CONSTELLATIONS[gnssId] ?? UNKNOWN_CONSTELLATION;
}

export function gnssIdName(gnssId: number): string {
  return constellation(gnssId).name;
}

export function gnssIdColor(gnssId: number): string {
  return constellation(gnssId).color;
}

// u-center-style satellite label, e.g. "G12", "R08", "E07".
export function svLabel(gnssId: number, svId: number): string {
  return `${constellation(gnssId).prefix}${svId}`;
}

// Normalized band label. band: 1 = L1/E1/B1, 2 = L2/B2I, 5 = L5/E5/B2a.
export function bandLabel(gnssId: number, band: number): string {
  switch (band) {
    case 1:
      switch (gnssId) {
        case GNSS_GALILEO:
          return 'E1';
        case GNSS_BEIDOU:
          return 'B1';
        case GNSS_GLONASS:
          return 'L1';
        default:
          return 'L1';
      }
    case 2:
      return gnssId === GNSS_BEIDOU ? 'B2I' : 'L2';
    case 5:
      switch (gnssId) {
        case GNSS_GALILEO:
          return 'E5';
        case GNSS_BEIDOU:
          return 'B2a';
        default:
          return 'L5';
      }
    default:
      return '—';
  }
}

// Slightly different shade per band so multi-band bars of one constellation
// stay visually grouped but distinguishable. Returns a CSS filter-free hex by
// blending the constellation colour toward white for higher bands.
export function bandColor(gnssId: number, band: number): string {
  const base = gnssIdColor(gnssId);
  const lighten = band === 2 ? 0.25 : band === 5 ? 0.45 : 0;
  if (lighten === 0) return base;
  return lightenHex(base, lighten);
}

function lightenHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${((1 << 24) | (mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).slice(1)}`;
}

// RTK solution label. rtk: 0 none, 1 float, 2 fixed.
export function rtkLabel(rtk: number): string {
  switch (rtk) {
    case 2:
      return 'RTK Fixed';
    case 1:
      return 'RTK Float';
    default:
      return 'No RTK';
  }
}

// DOP quality bucket → MUI palette colour. Lower DOP is better.
export function dopColor(dop: number): 'success' | 'warning' | 'error' | 'default' {
  if (dop <= 0) return 'default'; // not reported
  if (dop < 2) return 'success';
  if (dop < 5) return 'warning';
  return 'error';
}

// C/N0 quality bucket for signal bars (dB-Hz). Mirrors u-center's green/amber.
export function cn0Color(cn0: number): string {
  if (cn0 >= 40) return '#2e7d32';
  if (cn0 >= 30) return '#9acd32';
  if (cn0 >= 20) return '#f9a825';
  return '#e53935';
}

// Shallow per-field equality for two satellite arrays. Used store-side so the
// reactive `latest.sats` reference stays stable across epochs where the sky is
// unchanged — the memoized skyplot/bars/scatter panels then skip reconciliation.
// Compares the exact satelliteSchema field set (g,s,c,b,e,a,u,hl).
export function satsShallowEqual(a: GnssSatellite[], b: GnssSatellite[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.g !== y.g ||
      x.s !== y.s ||
      x.c !== y.c ||
      x.b !== y.b ||
      x.e !== y.e ||
      x.a !== y.a ||
      x.u !== y.u ||
      x.hl !== y.hl
    ) {
      return false;
    }
  }
  return true;
}

// RTCM/RTK correction age traffic light. Fresh corrections (< 5 s) are green,
// aging (< 30 s) amber, stale/none red. `age` of 0 means "not reported yet".
export function correctionAgeColor(ageSeconds: number | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (ageSeconds === undefined) return 'default';
  if (ageSeconds <= 0) return 'default'; // not reported
  if (ageSeconds < 5) return 'success';
  if (ageSeconds < 30) return 'warning';
  return 'error';
}

// The discrete solution stages a receiver climbs toward RTK-Fixed. Used by the
// RTK status stepper so the operator can see how close to a fixed solution the
// receiver is. Order matters: index = progress toward fix.
export const SOLUTION_STEPS = ['No fix', '3D', 'DGPS', 'RTK Float', 'RTK Fixed'] as const;

// Resolve the current solution step index (0..4) from the available fields.
// Prefers the explicit Unicore `solution_status` (sol), then the rtk flag,
// then the NMEA fix type. Returns 0 when nothing indicates a usable fix.
export function solutionStep(opts: {sol?: number; rtk?: number; ft?: number}): number {
  const {sol, rtk, ft} = opts;
  // Explicit Unicore solution status: 0 none,1 single,2 DGPS,3 float,4 fixed.
  // 255 = "not reported" sentinel (UBX path / pre-first-GGA window) — fall
  // through to rtk/ft instead of clamping it to 4 (= a false "RTK Fixed").
  if (sol !== undefined && sol > 0 && sol <= 4) return sol;
  if (rtk === 2) return 4; // fixed
  if (rtk === 1) return 3; // float
  // Fall back to NMEA fix type: 5 RTK-fixed,4 RTK-float,3 DGPS,2 3D,1 2D.
  switch (ft) {
    case 5:
      return 4;
    case 4:
      return 3;
    case 3:
      return 2;
    case 2:
    case 1:
      return 1;
    default:
      return 0;
  }
}

// Human label for a solution-status code (Unicore `sol`).
export function solutionLabel(sol: number | undefined): string {
  switch (sol) {
    case 4:
      return 'RTK Fixed';
    case 3:
      return 'RTK Float';
    case 2:
      return 'DGPS';
    case 1:
      return 'Single (3D)';
    default:
      return 'No fix';
  }
}
