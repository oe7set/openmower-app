'use client';

import {alpha, Box, Stack, Tooltip, Typography, useTheme} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {Block as BlockIcon, Warning as WarningIcon} from '@mui/icons-material';
import {isSameDay} from 'date-fns';
import {useEffect, useMemo, useState} from 'react';
import {describeRrule} from './rrule';
import type {Schedule} from './ScheduleEditor';
import type {BlockedDay, BlockWindow, ScheduleRun} from './types';
import type {DayAppointment} from './DayCell';

// Pixels per hour on the time axis. The grid height is (endHour-startHour)*this.
const HOUR_PX = 46;
// Minimum rendered block height so a short job's label stays readable.
const MIN_BLOCK_PX = 22;
// Default visible band; expands to cover any earlier/later activity on the day.
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

interface DayTimelineProps {
  day: Date;
  appointments: DayAppointment[];
  failures: ScheduleRun[];
  blocked?: BlockedDay;
  blockWindows: BlockWindow[];
  onSelectSchedule: (s: Schedule) => void;
  // Quick-create: clicking an empty hour slot opens the editor prefilled to that
  // day + hour.
  onCreateAt?: (at: Date) => void;
}

// A single positioned bar on the axis (minutes-from-midnight, clamped to the
// day) plus its owning appointment. continuous schedules have no bar and show
// as an all-day marker instead.
interface TimedBlock {
  appt: DayAppointment;
  start: number;
  end: number;
  lane: number;
}

export default function DayTimeline({
  day,
  appointments,
  failures,
  blocked,
  blockWindows,
  onSelectSchedule,
  onCreateAt,
}: DayTimelineProps) {
  const theme = useTheme();

  // 0=Mon..6=Sun, matching WEEKDAYS order used by the block-window helpers.
  const weekday = (day.getDay() + 6) % 7;

  // Split continuous (all-day) schedules out; the rest get positioned bars.
  const allDay = appointments.filter((a) => a.schedule.mode === 'continuous');
  const timedAppts = appointments.filter((a) => a.schedule.mode !== 'continuous');

  // Block-window segments that fall on this weekday, in minutes-from-midnight.
  const windowSegments = useMemo(
    () => blockWindows.flatMap((w) => windowSegmentsForDay(w, weekday)),
    [blockWindows, weekday],
  );

  // Lay the timed bars into non-overlapping lanes so concurrent jobs sit side
  // by side rather than on top of each other.
  const {blocks, laneCount} = useMemo(() => layoutBlocks(timedAppts), [timedAppts]);

  // Visible hour band: the default window, widened to include any activity.
  const [startHour, endHour] = useMemo(() => {
    const mins: number[] = [];
    for (const b of blocks) mins.push(b.start, b.end);
    for (const s of windowSegments) mins.push(s.start, s.end);
    let lo = DEFAULT_START_HOUR;
    let hi = DEFAULT_END_HOUR;
    if (mins.length > 0) {
      lo = Math.min(lo, Math.floor(Math.min(...mins) / 60));
      hi = Math.max(hi, Math.ceil(Math.max(...mins) / 60));
    }
    return [Math.max(0, lo), Math.min(24, Math.max(hi, lo + 1))];
  }, [blocks, windowSegments]);

  const hours = endHour - startHour;
  const gridHeight = hours * HOUR_PX;
  const topMin = startHour * 60;

  // Position helper: minutes-from-midnight → px offset within the grid.
  const yOf = (min: number) => ((min - topMin) / 60) * HOUR_PX;

  // Live "now" marker, only on today. Re-tick once a minute.
  const isToday = isSameDay(day, new Date());
  const [nowMin, setNowMin] = useState(() => minutesNow());
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNowMin(minutesNow()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);
  const showNow = isToday && nowMin >= topMin && nowMin <= endHour * 60;

  return (
    <Stack spacing={1.5}>
      {blocked && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.25,
            borderRadius: 1.5,
            backgroundColor: alpha(theme.palette.warning.main, 0.18),
          }}
        >
          <BlockIcon sx={{fontSize: 18, color: theme.palette.warning.main}} />
          <Typography variant="body2">
            {blocked.label ?? (blocked.reason === 'holiday' ? 'Public holiday' : 'Blocking day')} — mowing skipped
          </Typography>
        </Box>
      )}

      {allDay.length > 0 && (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
          {allDay.map((a, i) => (
            <Tooltip key={`${a.schedule.id ?? a.schedule.name}-${i}`} title="24/7 — all active areas">
              <Box
                onClick={() => onSelectSchedule(a.schedule)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectSchedule(a.schedule);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  backgroundColor: alpha(theme.palette.primary.main, 0.18),
                }}
              >
                <Typography variant="caption" fontWeight={600}>
                  24/7
                </Typography>
                <Typography variant="caption">{a.schedule.name || '(unnamed)'}</Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      )}

      {/* The hour grid */}
      <Box sx={{display: 'flex', position: 'relative'}}>
        {/* Hour labels */}
        <Box sx={{width: 44, flexShrink: 0}}>
          {Array.from({length: hours}, (_, i) => (
            <Box key={i} sx={{height: HOUR_PX, position: 'relative'}}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{position: 'absolute', top: -8, right: 6, fontVariantNumeric: 'tabular-nums'}}
              >
                {pad2(startHour + i)}:00
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Content column */}
        <Box sx={{position: 'relative', flex: 1, height: gridHeight}}>
          {/* Hour rows: grid lines + click-to-create slots */}
          {Array.from({length: hours}, (_, i) => (
            <Box
              key={i}
              onClick={onCreateAt ? () => onCreateAt(atHour(day, startHour + i)) : undefined}
              sx={{
                position: 'absolute',
                top: i * HOUR_PX,
                left: 0,
                right: 0,
                height: HOUR_PX,
                borderTop: `1px solid ${theme.palette.divider}`,
                cursor: onCreateAt ? 'pointer' : 'default',
                zIndex: 1,
                '&:hover': onCreateAt ? {backgroundColor: alpha(theme.palette.primary.main, 0.04)} : undefined,
              }}
            />
          ))}

          {/* Block-window bands (behind appointments) */}
          {windowSegments.map((seg, i) => (
            <Tooltip key={i} title={`No mowing ${fmtMin(seg.start)}–${fmtMin(seg.end)}`}>
              <Box
                sx={{
                  position: 'absolute',
                  top: yOf(seg.start),
                  height: Math.max(2, yOf(seg.end) - yOf(seg.start)),
                  left: 0,
                  right: 0,
                  zIndex: 0,
                  borderLeft: `2px solid ${theme.palette.warning.main}`,
                  backgroundImage: hatched(theme),
                }}
              />
            </Tooltip>
          ))}

          {/* Appointment blocks */}
          {blocks.map((b, i) => {
            const top = yOf(b.start);
            const height = Math.max(MIN_BLOCK_PX, yOf(b.end) - yOf(b.start));
            const widthPct = 100 / laneCount;
            const tall = height >= 36;
            return (
              <Tooltip key={`${b.appt.schedule.id ?? b.appt.schedule.name}-${i}`} title={appointmentTooltip(b.appt)}>
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSchedule(b.appt.schedule);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectSchedule(b.appt.schedule);
                  }}
                  sx={{
                    position: 'absolute',
                    top,
                    height,
                    left: `calc(${b.lane * widthPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    zIndex: 2,
                    p: 0.5,
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    color: theme.palette.primary.contrastText,
                    backgroundColor: alpha(theme.palette.primary.main, 0.92),
                    borderLeft: `3px solid ${theme.palette.primary.dark}`,
                    '&:hover': {backgroundColor: theme.palette.primary.main},
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{display: 'block', lineHeight: 1.2}} noWrap>
                    {/* Use the block's own start so time_window jobs show their
                        window start, not the 00:00 occurrence anchor. */}
                    {fmtMin(b.start)} {b.appt.schedule.name || '(unnamed)'}
                  </Typography>
                  {tall && (
                    <Typography variant="caption" sx={{display: 'block', opacity: 0.85}} noWrap>
                      {blockSubtitle(b.appt.schedule)}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            );
          })}

          {/* Now line */}
          {showNow && (
            <Box sx={{position: 'absolute', top: yOf(nowMin), left: 0, right: 0, zIndex: 3, pointerEvents: 'none'}}>
              <Box
                sx={{
                  position: 'absolute',
                  left: -3,
                  top: -3,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.error.main,
                }}
              />
              <Box sx={{height: 0, borderTop: `2px solid ${theme.palette.error.main}`}} />
            </Box>
          )}
        </Box>
      </Box>

      {failures.length > 0 && (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, color: theme.palette.error.main}}>
          <WarningIcon sx={{fontSize: 18}} />
          <Typography variant="caption">
            {failures.map((f) => `${f.name ?? f.schedule_id}: ${f.reason || f.status}`).join('; ')}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

// ── Geometry helpers ────────────────────────────────────────────────────────

// Minutes-from-midnight span a schedule occupies on the day. time_area uses the
// occurrence time + duration; time_window uses its window; continuous returns
// null (rendered as an all-day marker, not a bar).
function blockSpan(appt: DayAppointment): {start: number; end: number} | null {
  const s = appt.schedule;
  if (s.mode === 'time_window' && s.window?.start && s.window?.end) {
    const ws = parseHHMM(s.window.start);
    const we = parseHHMM(s.window.end);
    if (ws != null && we != null) {
      // A window that ends before it starts crosses midnight; clamp to the day.
      return {start: ws, end: we > ws ? we : 1440};
    }
  }
  const start = appt.date.getHours() * 60 + appt.date.getMinutes();
  const dur = s.duration_minutes && s.duration_minutes > 0 ? s.duration_minutes : 60;
  return {start, end: Math.min(1440, start + dur)};
}

// Greedy lane assignment so overlapping bars sit in adjacent columns.
function layoutBlocks(appts: DayAppointment[]): {blocks: TimedBlock[]; laneCount: number} {
  const spans = appts
    .map((appt) => ({appt, span: blockSpan(appt)}))
    .filter((x): x is {appt: DayAppointment; span: {start: number; end: number}} => x.span != null)
    .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);

  const laneEnds: number[] = [];
  const blocks: TimedBlock[] = [];
  for (const {appt, span} of spans) {
    let lane = laneEnds.findIndex((end) => end <= span.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.end);
    } else {
      laneEnds[lane] = span.end;
    }
    blocks.push({appt, start: span.start, end: span.end, lane});
  }
  return {blocks, laneCount: Math.max(1, laneEnds.length)};
}

// Block-window segments on the given weekday, clamped to [0,1440]. Mirrors the
// midnight-crossing logic in blockWindows.isBlockWindowActive.
function windowSegmentsForDay(w: BlockWindow, weekday: number): {start: number; end: number}[] {
  const start = parseHHMM(w.start);
  const end = parseHHMM(w.end);
  if (start == null || end == null) return [];
  const days = w.days ?? [];
  const WEEK = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const dayActive = (wd: number) => days.length === 0 || days.includes(WEEK[wd]);
  const prev = (weekday + 6) % 7;
  if (start < end) {
    return dayActive(weekday) ? [{start, end}] : [];
  }
  // Crosses midnight: evening part on this day + morning tail from yesterday.
  const segs: {start: number; end: number}[] = [];
  if (dayActive(weekday)) segs.push({start, end: 1440});
  if (dayActive(prev) && end > 0) segs.push({start: 0, end});
  return segs;
}

function blockSubtitle(s: Schedule): string {
  if (s.mode === 'time_window') return `Window ${s.window?.start ?? '?'}–${s.window?.end ?? '?'}`;
  const dur = s.duration_minutes && s.duration_minutes > 0 ? `${s.duration_minutes} min` : '';
  const areas = s.areas.length > 0 ? `${s.areas.length} area${s.areas.length === 1 ? '' : 's'}` : 'all areas';
  return [dur, areas].filter(Boolean).join(' · ');
}

function appointmentTooltip(appt: DayAppointment): string {
  const s = appt.schedule;
  // time_window jobs start at their window start, not the 00:00 occurrence
  // anchor — lead the tooltip with the time that's actually meaningful.
  const lead = s.mode === 'time_window' ? (s.window?.start ?? appt.time) : appt.time;
  const lines = [`${lead} · ${s.name || '(unnamed)'}`];
  if (s.mode === 'continuous') lines.push('24/7 — all active areas');
  else if (s.mode === 'time_window') lines.push(`Window ${s.window?.start ?? '?'}–${s.window?.end ?? '?'}`);
  else lines.push(`${describeRrule(s.rrule)} · ${s.duration_minutes} min`);
  lines.push(
    s.areas.length > 0 ? `${s.areas.length} mowing area${s.areas.length === 1 ? '' : 's'}` : 'All active areas',
  );
  return lines.join('\n');
}

function hatched(theme: Theme): string {
  const c = alpha(theme.palette.warning.main, 0.16);
  return `repeating-linear-gradient(45deg, ${c} 0, ${c} 6px, transparent 6px, transparent 12px)`;
}

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function minutesNow(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
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

function fmtMin(min: number): string {
  const clamped = Math.max(0, Math.min(1440, min));
  const h = Math.floor(clamped / 60) % 24;
  return `${pad2(h)}:${pad2(clamped % 60)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
