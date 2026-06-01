'use client';

import {alpha, Box, IconButton, Stack, ToggleButton, ToggleButtonGroup, Typography, useTheme} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {Block as BlockIcon, ChevronLeft, ChevronRight, Warning as WarningIcon} from '@mui/icons-material';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import {useEffect, useMemo, useState} from 'react';
import {expandOccurrences} from './rrule';
import {isBlockWindowActive} from './blockWindows';
import type {Schedule} from './ScheduleEditor';
import type {BlockedDay, BlockWindow, ScheduleRun} from './types';
import DayCell, {type DayAppointment} from './DayCell';

type CalView = 'day' | 'week' | 'month' | 'year';

interface CalendarViewProps {
  schedules: Schedule[];
  runs: ScheduleRun[];
  // ISO YYYY-MM-DD → tint info (manual block or holiday), pre-resolved by the
  // page for the visible range.
  blockedDays: Map<string, BlockedDay>;
  // Recurring time-of-day block windows (global), for the day-view banner.
  blockWindows: BlockWindow[];
  onSelectSchedule: (s: Schedule) => void;
  // Called whenever the visible date range changes so the page can lazily
  // resolve public holidays for newly visible years.
  onRangeChange?: (from: Date, to: Date) => void;
}

// Monday-first week. date-fns weekStartsOn: 1 = Monday.
const WEEK_OPTS = {weekStartsOn: 1 as const};

const VIEWS: ReadonlyArray<{value: CalView; label: string}> = [
  {value: 'day', label: 'Day'},
  {value: 'week', label: 'Week'},
  {value: 'month', label: 'Month'},
  {value: 'year', label: 'Year'},
];

export default function CalendarView({
  schedules,
  runs,
  blockedDays,
  blockWindows,
  onSelectSchedule,
  onRangeChange,
}: CalendarViewProps) {
  const theme = useTheme();
  const [view, setView] = useState<CalView>('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  // The visible date range depends on the active view. The grid views (week/
  // month) pad out to full Monday-first weeks; day/year cover their unit.
  const [rangeStart, rangeEnd] = useMemo((): [Date, Date] => {
    switch (view) {
      case 'day':
        return [startOfDay(cursor), startOfDay(cursor)];
      case 'week':
        return [startOfWeek(cursor, WEEK_OPTS), endOfWeek(cursor, WEEK_OPTS)];
      case 'year':
        return [startOfYear(cursor), endOfYear(cursor)];
      case 'month':
      default:
        return [startOfWeek(startOfMonth(cursor), WEEK_OPTS), endOfWeek(endOfMonth(cursor), WEEK_OPTS)];
    }
  }, [view, cursor]);

  // Notify the page so it can fetch holidays for any newly visible year.
  useEffect(() => {
    onRangeChange?.(rangeStart, rangeEnd);
  }, [onRangeChange, rangeStart, rangeEnd]);

  // Expand every enabled schedule's occurrences across the visible range, then
  // bucket them by ISO day. Recomputed when the range or schedules change.
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, DayAppointment[]>();
    for (const s of schedules) {
      if (!s.enabled) continue;
      // continuous schedules have no discrete occurrences; show them as a daily
      // marker so the user sees they are active.
      const rule = s.mode === 'continuous' ? 'FREQ=DAILY' : s.rrule;
      const occ = expandOccurrences(rule, rangeStart, addDays(rangeEnd, 1));
      const exdates = new Set(s.exdates ?? []);
      for (const date of occ) {
        const key = format(date, 'yyyy-MM-dd');
        if (exdates.has(key)) continue;
        const list = map.get(key) ?? [];
        list.push({schedule: s, time: format(date, 'HH:mm'), date});
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [schedules, rangeStart, rangeEnd]);

  // Bucket failed/aborted runs by ISO day for the failure badge.
  const failuresByDay = useMemo(() => {
    const map = new Map<string, ScheduleRun[]>();
    for (const r of runs) {
      if (r.status !== 'aborted' && r.status !== 'failed') continue;
      const iso = r.occurrence_iso?.slice(0, 10);
      if (!iso) continue;
      const list = map.get(iso) ?? [];
      list.push(r);
      map.set(iso, list);
    }
    return map;
  }, [runs]);

  const today = new Date();

  const title = useMemo(() => {
    switch (view) {
      case 'day':
        return format(cursor, 'EEEE, d MMMM yyyy');
      case 'week': {
        const ws = startOfWeek(cursor, WEEK_OPTS);
        const we = endOfWeek(cursor, WEEK_OPTS);
        return `${format(ws, 'd MMM')} – ${format(we, 'd MMM yyyy')}`;
      }
      case 'year':
        return format(cursor, 'yyyy');
      case 'month':
      default:
        return format(cursor, 'MMMM yyyy');
    }
  }, [view, cursor]);

  const step = (dir: 1 | -1) => {
    setCursor((c) => {
      switch (view) {
        case 'day':
          return addDays(c, dir);
        case 'week':
          return addWeeks(c, dir);
        case 'year':
          return addYears(c, dir);
        case 'month':
        default:
          return addMonths(c, dir);
      }
    });
  };

  const renderDayCell = (day: Date, inMonth: boolean) => {
    const key = format(day, 'yyyy-MM-dd');
    return (
      <DayCell
        key={key}
        day={day}
        inMonth={inMonth}
        isToday={isSameDay(day, today)}
        appointments={appointmentsByDay.get(key) ?? []}
        failures={failuresByDay.get(key) ?? []}
        blocked={blockedDays.get(key)}
        onSelectSchedule={onSelectSchedule}
      />
    );
  };

  return (
    <Box>
      {/* Header: view switcher + navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" fontWeight={600} sx={{minWidth: 0, flexShrink: 1}}>
          {title}
        </Typography>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v: CalView | null) => v && setView(v)}
          >
            {VIEWS.map((v) => (
              <ToggleButton key={v.value} value={v.value} sx={{px: {xs: 1, sm: 1.5}}}>
                {v.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{display: 'flex', alignItems: 'center'}}>
            <IconButton onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft />
            </IconButton>
            <IconButton onClick={() => setCursor(startOfDay(new Date()))} aria-label="Today" size="small">
              <Typography variant="caption" fontWeight={600}>
                Today
              </Typography>
            </IconButton>
            <IconButton onClick={() => step(1)} aria-label="Next">
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {view === 'day' && (
        <DayAgenda
          day={cursor}
          appointments={appointmentsByDay.get(format(cursor, 'yyyy-MM-dd')) ?? []}
          failures={failuresByDay.get(format(cursor, 'yyyy-MM-dd')) ?? []}
          blocked={blockedDays.get(format(cursor, 'yyyy-MM-dd'))}
          blockWindows={blockWindows}
          onSelectSchedule={onSelectSchedule}
        />
      )}

      {view === 'week' && <WeekGrid start={startOfWeek(cursor, WEEK_OPTS)} renderDayCell={renderDayCell} />}

      {view === 'month' && <MonthGrid cursor={cursor} renderDayCell={renderDayCell} />}

      {view === 'year' && (
        <YearGrid
          cursor={cursor}
          appointmentsByDay={appointmentsByDay}
          blockedDays={blockedDays}
          today={today}
          onPickMonth={(d) => {
            setCursor(d);
            setView('month');
          }}
        />
      )}

      {/* Legend */}
      <Box sx={{display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap'}}>
        <Legend color={theme.palette.primary.main} label="Scheduled mow" />
        <Legend color={theme.palette.error.main} label="Failed / aborted" />
        <Legend color={theme.palette.warning.main} label="Blocked / holiday" />
      </Box>
    </Box>
  );
}

// ── Month grid (full Monday-first weeks covering the month) ─────────────────

function MonthGrid({cursor, renderDayCell}: {cursor: Date; renderDayCell: (day: Date, inMonth: boolean) => React.ReactNode}) {
  const gridStart = startOfWeek(startOfMonth(cursor), WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(cursor), WEEK_OPTS);
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <Box>
      <WeekdayHeader />
      <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5}}>
        {days.map((day) => renderDayCell(day, isSameMonth(day, cursor)))}
      </Box>
    </Box>
  );
}

// ── Week grid (7 columns on >= sm, vertical stack on xs) ────────────────────

function WeekGrid({start, renderDayCell}: {start: Date; renderDayCell: (day: Date, inMonth: boolean) => React.ReactNode}) {
  const days = Array.from({length: 7}, (_, i) => addDays(start, i));
  return (
    <Box>
      <Box sx={{display: {xs: 'none', sm: 'block'}}}>
        <WeekdayHeader />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {xs: '1fr', sm: 'repeat(7, 1fr)'},
          gap: 0.5,
        }}
      >
        {days.map((day) => renderDayCell(day, true))}
      </Box>
    </Box>
  );
}

// ── Year grid (12 mini months, click to drill into Month view) ──────────────

function YearGrid({
  cursor,
  appointmentsByDay,
  blockedDays,
  today,
  onPickMonth,
}: {
  cursor: Date;
  appointmentsByDay: Map<string, DayAppointment[]>;
  blockedDays: Map<string, BlockedDay>;
  today: Date;
  onPickMonth: (d: Date) => void;
}) {
  const theme = useTheme();
  const months = eachMonthOfInterval({start: startOfYear(cursor), end: endOfYear(cursor)});
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)'},
        gap: 1.5,
      }}
    >
      {months.map((m) => (
        <Box
          key={m.toISOString()}
          onClick={() => onPickMonth(m)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onPickMonth(m);
          }}
          sx={{
            p: 1,
            borderRadius: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            cursor: 'pointer',
            '&:hover': {borderColor: theme.palette.primary.main},
          }}
        >
          <Typography variant="caption" fontWeight={600} sx={{display: 'block', mb: 0.5}}>
            {format(m, 'MMMM')}
          </Typography>
          <MiniMonth month={m} appointmentsByDay={appointmentsByDay} blockedDays={blockedDays} today={today} />
        </Box>
      ))}
    </Box>
  );
}

function MiniMonth({
  month,
  appointmentsByDay,
  blockedDays,
  today,
}: {
  month: Date;
  appointmentsByDay: Map<string, DayAppointment[]>;
  blockedDays: Map<string, BlockedDay>;
  today: Date;
}) {
  const theme = useTheme();
  const gridStart = startOfWeek(startOfMonth(month), WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(month), WEEK_OPTS);
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px'}}>
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const inMonth = isSameMonth(day, month);
        const hasAppt = (appointmentsByDay.get(key)?.length ?? 0) > 0;
        const blocked = blockedDays.get(key);
        const isToday = isSameDay(day, today);
        return (
          <Box
            key={key}
            sx={{
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '3px',
              fontSize: '0.6rem',
              opacity: inMonth ? 1 : 0.35,
              color: isToday ? theme.palette.primary.contrastText : 'text.secondary',
              backgroundColor: isToday
                ? theme.palette.primary.main
                : blocked
                  ? alphaWarn(theme)
                  : hasAppt
                    ? alphaPrimary(theme)
                    : 'transparent',
            }}
          >
            {format(day, 'd')}
          </Box>
        );
      })}
    </Box>
  );
}

// ── Day agenda (vertical list, mobile-first) ────────────────────────────────

function DayAgenda({
  day,
  appointments,
  failures,
  blocked,
  blockWindows,
  onSelectSchedule,
}: {
  day: Date;
  appointments: DayAppointment[];
  failures: ScheduleRun[];
  blocked?: BlockedDay;
  blockWindows: BlockWindow[];
  onSelectSchedule: (s: Schedule) => void;
}) {
  const theme = useTheme();
  // Which block windows touch this weekday (active at its start, end, or any
  // point) — show them all as the day's "no mowing" periods.
  const weekday = (day.getDay() + 6) % 7; // 0=Mon..6=Sun
  const dayWindows = blockWindows.filter(
    (w) => isBlockWindowActive(w, weekday, 0) || isBlockWindowActive(w, weekday, 12 * 60) || isBlockWindowActive(w, weekday, 23 * 60 + 59) || (w.days ?? []).length === 0 || windowStartsOnDay(w, weekday),
  );

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
            backgroundColor: alphaWarn(theme),
          }}
        >
          <BlockIcon sx={{fontSize: 18, color: theme.palette.warning.main}} />
          <Typography variant="body2">
            {blocked.label ?? (blocked.reason === 'holiday' ? 'Public holiday' : 'Blocking day')} — mowing skipped
          </Typography>
        </Box>
      )}

      {dayWindows.length > 0 && (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
          {dayWindows.map((w, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                border: `1px solid ${theme.palette.warning.main}`,
                color: theme.palette.warning.main,
              }}
            >
              <BlockIcon sx={{fontSize: 14}} />
              <Typography variant="caption">No mowing {w.start}–{w.end}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {appointments.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{py: 2}}>
          No mowing scheduled on this day.
        </Typography>
      ) : (
        appointments.map((appt, i) => (
          <Box
            key={`${appt.schedule.id ?? appt.schedule.name}-${i}`}
            onClick={() => onSelectSchedule(appt.schedule)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectSchedule(appt.schedule);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              border: `1px solid ${theme.palette.divider}`,
              cursor: 'pointer',
              '&:hover': {borderColor: theme.palette.primary.main},
            }}
          >
            <Typography variant="body2" fontWeight={700} sx={{minWidth: 48}}>
              {appt.time}
            </Typography>
            <Typography variant="body2" sx={{flex: 1, minWidth: 0}} noWrap>
              {appt.schedule.name || '(unnamed)'}
            </Typography>
          </Box>
        ))
      )}

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

// Does a midnight-crossing window's "carry-over" (the morning tail) land on the
// given weekday because it started the previous day? Used by the day agenda so
// e.g. a Mon 20:00–08:00 window also shows on Tue morning.
function windowStartsOnDay(w: BlockWindow, weekday: number): boolean {
  const days = w.days ?? [];
  if (days.length === 0) return true;
  const prev = (weekday + 6) % 7;
  // Active on the previous day means the morning tail bleeds into today.
  return isBlockWindowActive(w, prev, 23 * 60 + 59);
}

function WeekdayHeader() {
  const labels = useMemo(() => {
    const base = startOfWeek(new Date(), WEEK_OPTS);
    return Array.from({length: 7}, (_, i) => format(addDays(base, i), 'EEE'));
  }, []);
  return (
    <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5}}>
      {labels.map((w) => (
        <Typography key={w} variant="caption" color="text.secondary" align="center" fontWeight={600}>
          {w}
        </Typography>
      ))}
    </Box>
  );
}

function Legend({color, label}: {color: string; label: string}) {
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
      <Box sx={{width: 10, height: 10, borderRadius: '50%', backgroundColor: color}} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

// Small theme-tint helpers shared by the mini-month and banners.
function alphaWarn(theme: Theme): string {
  return alpha(theme.palette.warning.main, 0.18);
}
function alphaPrimary(theme: Theme): string {
  return alpha(theme.palette.primary.main, 0.35);
}
