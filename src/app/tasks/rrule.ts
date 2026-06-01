// iCal RRULE codec for the scheduler. We model the common shapes the UI builds
// (DAILY / WEEKLY / MONTHLY with BYDAY / BYHOUR / BYMINUTE, plus INTERVAL and a
// COUNT/UNTIL bound) and let the backend reject anything malformed via its
// python-dateutil validation. Occurrence expansion for the calendar uses the
// `rrule` npm library; the RRULE *string* stays the single source of truth and
// must remain parseable by both this codec and python-dateutil.
import {RRule, rrulestr} from 'rrule';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
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
  interval: number; // every N days/weeks/months; 1 = every
  byDays: Weekday[];
  hour: number;
  minute: number;
  // Optional end bound. 'count' repeats N times, 'until' ends on a date
  // (inclusive, ISO 'YYYY-MM-DD'), 'never' is open-ended.
  endMode: 'never' | 'count' | 'until';
  count?: number;
  until?: string;
  // Day-of-month for MONTHLY (1–31). Ignored for other frequencies.
  byMonthDay?: number;
}

export const DEFAULT_RRULE_PARTS: RruleParts = {
  freq: 'WEEKLY',
  interval: 1,
  byDays: ['MO', 'WE', 'FR'],
  hour: 10,
  minute: 0,
  endMode: 'never',
};

export function partsToRrule(p: RruleParts): string {
  const segments = [`FREQ=${p.freq}`];
  if (p.interval && p.interval > 1) {
    segments.push(`INTERVAL=${p.interval}`);
  }
  if (p.freq === 'WEEKLY' && p.byDays.length > 0) {
    segments.push(`BYDAY=${p.byDays.join(',')}`);
  }
  if (p.freq === 'MONTHLY' && p.byMonthDay) {
    segments.push(`BYMONTHDAY=${p.byMonthDay}`);
  }
  segments.push(`BYHOUR=${p.hour}`);
  segments.push(`BYMINUTE=${p.minute}`);
  if (p.endMode === 'count' && p.count && p.count > 0) {
    segments.push(`COUNT=${p.count}`);
  } else if (p.endMode === 'until' && p.until) {
    // UNTIL is a UTC timestamp in iCal; use end-of-day so the final date is
    // inclusive regardless of the BYHOUR/BYMINUTE time-of-day.
    segments.push(`UNTIL=${p.until.replace(/-/g, '')}T235959Z`);
  }
  return segments.join(';');
}

// Parse our subset of RRULE strings back into the form fields. Anything we
// don't recognise falls through to the defaults, leaving the raw string intact
// for the backend.
export function rruleToParts(rrule: string): RruleParts {
  if (!rrule) return {...DEFAULT_RRULE_PARTS};
  const map = new Map<string, string>();
  for (const seg of rrule.split(';')) {
    const eq = seg.indexOf('=');
    if (eq > 0) map.set(seg.slice(0, eq).toUpperCase(), seg.slice(eq + 1));
  }
  const freqRaw = (map.get('FREQ') ?? 'WEEKLY').toUpperCase();
  const freq: Frequency = freqRaw === 'DAILY' ? 'DAILY' : freqRaw === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY';
  const validDays = new Set<Weekday>(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
  const byDays = (map.get('BYDAY') ?? '')
    .split(',')
    .map((d) => d.trim().toUpperCase() as Weekday)
    .filter((d): d is Weekday => validDays.has(d));
  const hour = clampInt(map.get('BYHOUR'), 0, 23, DEFAULT_RRULE_PARTS.hour);
  const minute = clampInt(map.get('BYMINUTE'), 0, 59, DEFAULT_RRULE_PARTS.minute);
  const interval = clampInt(map.get('INTERVAL'), 1, 999, 1);
  const byMonthDayRaw = map.get('BYMONTHDAY');
  const byMonthDay = byMonthDayRaw ? clampInt(byMonthDayRaw, 1, 31, 1) : undefined;

  let endMode: RruleParts['endMode'] = 'never';
  let count: number | undefined;
  let until: string | undefined;
  if (map.has('COUNT')) {
    endMode = 'count';
    count = clampInt(map.get('COUNT'), 1, 9999, 1);
  } else if (map.has('UNTIL')) {
    endMode = 'until';
    until = parseUntilDate(map.get('UNTIL'));
  }

  return {
    freq,
    interval,
    byDays: byDays.length > 0 ? byDays : freq === 'WEEKLY' ? DEFAULT_RRULE_PARTS.byDays : [],
    hour,
    minute,
    endMode,
    count,
    until,
    byMonthDay,
  };
}

// Expand an RRULE into concrete occurrence Dates between [from, to] (inclusive).
// `from`/`to` are JS Dates in the browser's local zone — good enough for the
// calendar grid, which itself renders local days. Returns [] on any parse
// error so a malformed rule never crashes the calendar.
export function expandOccurrences(rrule: string, from: Date, to: Date): Date[] {
  if (!rrule) return [];
  try {
    // Anchor the series at the start of the visible range so weekly/monthly
    // rules without an explicit DTSTART still line up on the right weekday.
    const rule = rrulestr(rrule, {dtstart: startOfDay(from)});
    return rule.between(from, to, true);
  } catch {
    return [];
  }
}

// A compact human-readable summary of an RRULE, e.g. "Weekly on Mon, Wed at
// 10:00". Falls back to the raw string when it can't be summarised.
export function describeRrule(rrule: string): string {
  if (!rrule) return '';
  try {
    const parts = rruleToParts(rrule);
    const time = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
    const every = parts.interval > 1 ? `every ${parts.interval} ` : '';
    let base: string;
    if (parts.freq === 'DAILY') {
      base = `${every ? `Every ${parts.interval} days` : 'Daily'}`;
    } else if (parts.freq === 'MONTHLY') {
      const dom = parts.byMonthDay ? ` on day ${parts.byMonthDay}` : '';
      base = `${every ? `Every ${parts.interval} months` : 'Monthly'}${dom}`;
    } else {
      const days = parts.byDays.length
        ? ` on ${parts.byDays.map((d) => WEEKDAYS.find((w) => w.key === d)?.label ?? d).join(', ')}`
        : '';
      base = `${every ? `Every ${parts.interval} weeks` : 'Weekly'}${days}`;
    }
    let suffix = '';
    if (parts.endMode === 'count' && parts.count) suffix = `, ${parts.count}×`;
    else if (parts.endMode === 'until' && parts.until) suffix = `, until ${parts.until}`;
    return `${base} at ${time}${suffix}`;
  } catch {
    return rrule;
  }
}

function parseUntilDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Accept both basic (20261225T235959Z) and date-only (2026-12-25) forms.
  const m = raw.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Re-exported so callers can build rules programmatically without importing
// the library directly.
export {RRule};
