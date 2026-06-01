'use client';

import {Box, IconButton, Typography, useTheme} from '@mui/material';
import {ChevronLeft, ChevronRight} from '@mui/icons-material';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {useMemo, useState} from 'react';
import {expandOccurrences} from './rrule';
import type {Schedule} from './ScheduleEditor';
import type {ScheduleRun} from './types';
import DayCell, {type DayAppointment} from './DayCell';

interface CalendarViewProps {
  schedules: Schedule[];
  runs: ScheduleRun[];
  // ISO YYYY-MM-DD strings that block mowing (manual + holidays), pre-resolved
  // by the page for the visible range.
  blockedDays: Map<string, string>;
  onSelectSchedule: (s: Schedule) => void;
}

// Monday-first week. date-fns weekStartsOn: 1 = Monday.
const WEEK_OPTS = {weekStartsOn: 1 as const};

export default function CalendarView({schedules, runs, blockedDays, onSelectSchedule}: CalendarViewProps) {
  const theme = useTheme();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  // Visible grid range: full weeks covering the month.
  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor), WEEK_OPTS), [cursor]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(cursor), WEEK_OPTS), [cursor]);

  const days = useMemo(() => {
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [gridStart, gridEnd]);

  // Expand every enabled schedule's occurrences across the visible range, then
  // bucket them by ISO day. Cheap enough to recompute on month change.
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, DayAppointment[]>();
    for (const s of schedules) {
      if (!s.enabled) continue;
      // continuous schedules have no discrete occurrences; show them as a daily
      // marker so the user sees they are active.
      const rule = s.mode === 'continuous' ? 'FREQ=DAILY' : s.rrule;
      const occ = expandOccurrences(rule, gridStart, gridEnd);
      const exdates = new Set(s.exdates ?? []);
      for (const date of occ) {
        const key = format(date, 'yyyy-MM-dd');
        if (exdates.has(key)) continue;
        const list = map.get(key) ?? [];
        list.push({schedule: s, time: format(date, 'HH:mm'), date});
        map.set(key, list);
      }
    }
    // Stable sort each day by time.
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [schedules, gridStart, gridEnd]);

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
  const weekdayLabels = useMemo(() => {
    const base = startOfWeek(new Date(), WEEK_OPTS);
    return Array.from({length: 7}, (_, i) => format(addDays(base, i), 'EEE'));
  }, []);

  return (
    <Box>
      {/* Month navigation */}
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5}}>
        <Typography variant="h6" fontWeight={600}>
          {format(cursor, 'MMMM yyyy')}
        </Typography>
        <Box>
          <IconButton onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
            <ChevronLeft />
          </IconButton>
          <IconButton onClick={() => setCursor(startOfMonth(new Date()))} aria-label="Today" size="small">
            <Typography variant="caption" fontWeight={600}>
              Today
            </Typography>
          </IconButton>
          <IconButton onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>

      {/* Weekday header */}
      <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5}}>
        {weekdayLabels.map((w) => (
          <Typography key={w} variant="caption" color="text.secondary" align="center" fontWeight={600}>
            {w}
          </Typography>
        ))}
      </Box>

      {/* Day grid */}
      <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5}}>
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          return (
            <DayCell
              key={key}
              day={day}
              inMonth={isSameMonth(day, cursor)}
              isToday={isSameDay(day, today)}
              appointments={appointmentsByDay.get(key) ?? []}
              failures={failuresByDay.get(key) ?? []}
              blockedReason={blockedDays.get(key)}
              onSelectSchedule={onSelectSchedule}
            />
          );
        })}
      </Box>

      {/* Legend */}
      <Box sx={{display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap'}}>
        <Legend color={theme.palette.primary.main} label="Scheduled mow" />
        <Legend color={theme.palette.error.main} label="Failed / aborted" />
        <Legend color={theme.palette.warning.main} label="Blocked / holiday" />
      </Box>
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
