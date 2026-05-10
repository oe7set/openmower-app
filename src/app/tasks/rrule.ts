// Tiny iCal RRULE codec covering the schedule shapes the mower_scheduler
// expects. Full RRULE has many edge cases; we deliberately handle only the
// common ones (weekly + daily with BYDAY / BYHOUR / BYMINUTE) and let the
// backend reject anything malformed via its python-dateutil validation.

export type Frequency = 'DAILY' | 'WEEKLY';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export const WEEKDAYS: ReadonlyArray<{key: Weekday; label: string}> = [
  {key: 'MO', label: 'Mon'},
  {key: 'TU', label: 'Tue'},
  {key: 'WE', label: 'Wed'},
  {key: 'TH', label: 'Thu'},
  {key: 'FR', label: 'Fri'},
  {key: 'SA', label: 'Sat'},
  {key: 'SU', label: 'Sun'},
];

export interface RruleParts {
  freq: Frequency;
  byDays: Weekday[];
  hour: number;
  minute: number;
}

export const DEFAULT_RRULE_PARTS: RruleParts = {
  freq: 'WEEKLY',
  byDays: ['MO', 'WE', 'FR'],
  hour: 10,
  minute: 0,
};

export function partsToRrule(p: RruleParts): string {
  const segments = [`FREQ=${p.freq}`];
  if (p.freq === 'WEEKLY' && p.byDays.length > 0) {
    segments.push(`BYDAY=${p.byDays.join(',')}`);
  }
  segments.push(`BYHOUR=${p.hour}`);
  segments.push(`BYMINUTE=${p.minute}`);
  return segments.join(';');
}

// Parse our subset of RRULE strings back into the form fields. Anything we
// don't recognise falls through to the defaults, leaving the user free to
// keep editing the raw string in an "advanced" mode if we ever add one.
export function rruleToParts(rrule: string): RruleParts {
  if (!rrule) return DEFAULT_RRULE_PARTS;
  const map = new Map<string, string>();
  for (const seg of rrule.split(';')) {
    const eq = seg.indexOf('=');
    if (eq > 0) map.set(seg.slice(0, eq).toUpperCase(), seg.slice(eq + 1));
  }
  const freqRaw = map.get('FREQ') ?? 'WEEKLY';
  const freq: Frequency = freqRaw === 'DAILY' ? 'DAILY' : 'WEEKLY';
  const validDays = new Set<Weekday>(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
  const byDays = (map.get('BYDAY') ?? '')
    .split(',')
    .map((d) => d.trim().toUpperCase() as Weekday)
    .filter((d): d is Weekday => validDays.has(d));
  const hour = clampInt(map.get('BYHOUR'), 0, 23, DEFAULT_RRULE_PARTS.hour);
  const minute = clampInt(map.get('BYMINUTE'), 0, 59, DEFAULT_RRULE_PARTS.minute);
  return {
    freq,
    byDays: byDays.length > 0 ? byDays : freq === 'WEEKLY' ? DEFAULT_RRULE_PARTS.byDays : [],
    hour,
    minute,
  };
}

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
