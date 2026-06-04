// Shared GNSS constellation/band metadata and label helpers for the GNSS page.
// gnss_id follows the u-blox convention used end-to-end (firmware → ROS → app).

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
