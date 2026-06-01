'use client';

import {alpha, Box, Chip, Tooltip, Typography, useTheme} from '@mui/material';
import {Warning as WarningIcon, Block as BlockIcon} from '@mui/icons-material';
import {format} from 'date-fns';
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
  appointments: DayAppointment[];
  failures: ScheduleRun[];
  blocked?: BlockedDay;
  onSelectSchedule: (s: Schedule) => void;
}

const MAX_VISIBLE = 3;

export default function DayCell({
  day,
  inMonth,
  isToday,
  appointments,
  failures,
  blocked,
  onSelectSchedule,
}: DayCellProps) {
  const theme = useTheme();
  const isBlocked = !!blocked;
  const visible = appointments.slice(0, MAX_VISIBLE);
  const overflow = appointments.length - visible.length;

  return (
    <Box
      sx={{
        minHeight: {xs: 64, md: 96},
        borderRadius: 1.5,
        p: 0.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: isBlocked
          ? alpha(theme.palette.warning.main, 0.12)
          : inMonth
            ? theme.palette.background.paper
            : theme.palette.action.hover,
        opacity: inMonth ? 1 : 0.55,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Day number + badges */}
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
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
        <Chip
          key={`${appt.schedule.id ?? appt.schedule.name}-${i}`}
          size="small"
          label={`${appt.time} ${appt.schedule.name}`}
          onClick={() => onSelectSchedule(appt.schedule)}
          sx={{
            height: 18,
            fontSize: '0.65rem',
            justifyContent: 'flex-start',
            cursor: 'pointer',
            backgroundColor: alpha(theme.palette.primary.main, 0.18),
            '& .MuiChip-label': {px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis'},
          }}
        />
      ))}
      {overflow > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{fontSize: '0.6rem', pl: 0.5}}>
          +{overflow} more
        </Typography>
      )}
    </Box>
  );
}
