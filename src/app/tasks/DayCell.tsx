'use client';

import {alpha, Box, Chip, Tooltip, Typography, useTheme} from '@mui/material';
import {Warning as WarningIcon, Block as BlockIcon} from '@mui/icons-material';
import {format} from 'date-fns';
import {describeRrule} from './rrule';
import type {Schedule} from './ScheduleEditor';
import type {BlockedDay, ScheduleRun} from './types';

export interface DayAppointment {
  schedule: Schedule;
  time: string; // HH:mm
  date: Date;
}

interface DayCellProps {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  // 'number' (month grid): a small day-number circle. 'weekday' (week grid): a
  // full weekday + date header so the day stays labelled even when the grid
  // collapses to a single stacked column on mobile.
  headerVariant?: 'number' | 'weekday';
  appointments: DayAppointment[];
  failures: ScheduleRun[];
  blocked?: BlockedDay;
  onSelectSchedule: (s: Schedule) => void;
  // Quick-create: clicking empty space in the cell opens the editor prefilled
  // to this day.
  onCreateAt?: (at: Date) => void;
}

const MAX_VISIBLE = 3;

export default function DayCell({
  day,
  inMonth,
  isToday,
  headerVariant = 'number',
  appointments,
  failures,
  blocked,
  onSelectSchedule,
  onCreateAt,
}: DayCellProps) {
  const theme = useTheme();
  const isBlocked = !!blocked;
  const visible = appointments.slice(0, MAX_VISIBLE);
  const overflow = appointments.length - visible.length;

  return (
    <Box
      onClick={onCreateAt ? () => onCreateAt(atNoon(day)) : undefined}
      sx={{
        minHeight: {xs: 64, md: 96},
        borderRadius: 1.5,
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        border: isToday ? `1px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
        backgroundColor: isBlocked
          ? alpha(theme.palette.warning.main, 0.12)
          : inMonth
            ? theme.palette.background.paper
            : theme.palette.action.hover,
        opacity: inMonth ? 1 : 0.55,
        position: 'relative',
        overflow: 'hidden',
        cursor: onCreateAt ? 'pointer' : 'default',
      }}
    >
      {/* Header + badges */}
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {headerVariant === 'weekday' ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 0.5,
              px: 0.5,
              borderRadius: 1,
              color: isToday ? theme.palette.primary.main : 'text.primary',
            }}
          >
            <Typography variant="caption" fontWeight={700} sx={{textTransform: 'uppercase'}}>
              {format(day, 'EEE')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {/* Full date on mobile (stacked), just the day number on wider grids. */}
              <Box component="span" sx={{display: {xs: 'inline', sm: 'none'}}}>
                {format(day, 'd MMM')}
              </Box>
              <Box component="span" sx={{display: {xs: 'none', sm: 'inline'}}}>
                {format(day, 'd')}
              </Box>
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isToday ? theme.palette.primary.main : 'transparent',
              color: isToday ? theme.palette.primary.contrastText : 'text.primary',
            }}
          >
            <Typography variant="caption" fontWeight={isToday ? 700 : 400}>
              {format(day, 'd')}
            </Typography>
          </Box>
        )}
        <Box sx={{display: 'flex', gap: 0.25}}>
          {isBlocked && (
            <Tooltip title={blocked?.label ?? (blocked?.reason === 'holiday' ? 'Public holiday' : 'Blocking day')}>
              <BlockIcon sx={{fontSize: 14, color: theme.palette.warning.main}} />
            </Tooltip>
          )}
          {failures.length > 0 && (
            <Tooltip
              title={failures
                .map((f) => `${f.name ?? f.schedule_id}: ${f.reason || f.status}`)
                .join('\n')}
            >
              <WarningIcon sx={{fontSize: 14, color: theme.palette.error.main}} />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Appointment chips */}
      {visible.map((appt, i) => (
        <Tooltip key={`${appt.schedule.id ?? appt.schedule.name}-${i}`} title={appointmentTooltip(appt)}>
          <Chip
            size="small"
            label={`${appt.time} ${appt.schedule.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSchedule(appt.schedule);
            }}
            sx={{
              height: 18,
              fontSize: '0.65rem',
              justifyContent: 'flex-start',
              cursor: 'pointer',
              backgroundColor: alpha(theme.palette.primary.main, 0.18),
              '& .MuiChip-label': {px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis'},
            }}
          />
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{fontSize: '0.6rem', pl: 0.5}}>
          +{overflow} more
        </Typography>
      )}
    </Box>
  );
}

// Tooltip describing an appointment: name, recurrence/mode, duration, areas.
function appointmentTooltip(appt: DayAppointment): string {
  const s = appt.schedule;
  const lines = [`${appt.time} · ${s.name || '(unnamed)'}`];
  if (s.mode === 'continuous') lines.push('24/7 — all active areas');
  else if (s.mode === 'time_window') lines.push(`Window ${s.window?.start ?? '?'}–${s.window?.end ?? '?'}`);
  else lines.push(`${describeRrule(s.rrule)} · ${s.duration_minutes} min`);
  lines.push(
    s.areas.length > 0 ? `${s.areas.length} mowing area${s.areas.length === 1 ? '' : 's'}` : 'All active areas',
  );
  return lines.join('\n');
}

// Quick-create from a grid cell defaults to midday so the prefilled schedule
// lands at a sensible hour the user can adjust.
function atNoon(day: Date): Date {
  const d = new Date(day);
  d.setHours(12, 0, 0, 0);
  return d;
}
