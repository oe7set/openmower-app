// Helpers for recurring block windows (time-of-day ranges that hard-stop
// mowing). Shared by the exceptions editor and the schedule list/legend.
import {WEEKDAYS, type Weekday} from './rrule';
import type {BlockWindow} from './types';

// A compact human-readable summary, e.g. "20:00–08:00 · daily" or
// "22:00–06:00 · Mon, Tue". Empty/omitted days mean every day.
export function describeBlockWindow(w: BlockWindow): string {
  const range = `${w.start}–${w.end}`;
  const days = w.days ?? [];
  if (days.length === 0 || days.length === 7) {
    return `${range} · daily`;
  }
  const labels = days
    .map((d) => WEEKDAYS.find((w) => w.key === (d as Weekday))?.label ?? d)
    .join(', ');
  return `${range} · ${labels}`;
}

// Whether a block window is active at the given local date+time. `weekday` is
// 0=Mon..6=Sun (matching WEEKDAYS order); `minutes` is minutes-since-midnight.
// Mirrors the backend ExceptionsStore.active_block_window logic so the calendar
// can tint days consistently with what the mower will actually do.
export function isBlockWindowActive(w: BlockWindow, weekday: number, minutes: number): boolean {
  const start = parseHHMM(w.start);
  const end = parseHHMM(w.end);
  if (start == null || end == null) return false;
  const days = w.days ?? [];
  const dayActive = (wd: number) => days.length === 0 || days.includes(WEEKDAYS[wd].key);
  const prevWeekday = (weekday + 6) % 7;
  if (start < end) {
    return dayActive(weekday) && minutes >= start && minutes < end;
  }
  // Crosses midnight: active from start on its own day, and before end on the
  // following day (anchored to the day the window started on).
  if (dayActive(weekday) && minutes >= start) return true;
  if (dayActive(prevWeekday) && minutes < end) return true;
  return false;
}

function parseHHMM(value: string | undefined): number | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}
