'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useToast} from '@/hooks/useToast';
import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  Add as AddIcon,
  Block as BlockIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  ViewList as ListIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import ScheduleEditor, {type Schedule} from './ScheduleEditor';
import CalendarView from './CalendarView';
import ExceptionsManager from './ExceptionsManager';
import RunHistoryDrawer from './RunHistoryDrawer';
import StartMowingDialog from './StartMowingDialog';
import {DEFAULT_RRULE_PARTS, describeRrule, partsToRrule, WEEKDAYS} from './rrule';
import {describeBlockWindow} from './blockWindows';
import type {BlockedDay, Holiday, MowingExceptions, ScheduleRun} from './types';
import {detectTimezone} from './timezone';
import ConfirmDialog from './ConfirmDialog';
import {usePersistentState} from './useCalendarState';

// Build a blank schedule. When `at` is given (quick-create from clicking a
// calendar slot), prefill the recurrence to that weekday and time so the editor
// opens with sensible defaults the user can tweak.
function emptySchedule(at?: Date): Schedule {
  const parts = {...DEFAULT_RRULE_PARTS};
  if (at) {
    const weekday = WEEKDAYS[(at.getDay() + 6) % 7].key; // 0=Mon..6=Sun
    parts.byDays = [weekday];
    parts.hour = at.getHours();
    parts.minute = at.getMinutes();
  }
  return {
    name: '',
    enabled: true,
    mode: 'time_area',
    areas: [],
    rrule: partsToRrule(parts),
    duration_minutes: 60,
    timezone: detectTimezone(),
  };
}

const SKIP_LABELS: Record<NonNullable<Schedule['last_skip_reason']>, string> = {
  no_state: 'Skipped: mower offline',
  emergency: 'Skipped: emergency stop',
  not_idle: 'Skipped: mower busy',
  charging: 'Skipped: charging',
  rain: 'Skipped: rain detected',
  blocked: 'Skipped: blocking day',
  holiday: 'Skipped: public holiday',
  block_window: 'Skipped: block window',
};

const MODE_LABELS: Record<NonNullable<Schedule['mode']>, string> = {
  time_area: 'Time / Area',
  time_window: 'Time window',
  continuous: '24/7',
};

function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Replace a schedule with the same id, or append it when it's new (no id yet
// or an id we haven't seen). Used for optimistic list updates after upsert.
function upsertSchedule(list: Schedule[], saved: Schedule): Schedule[] {
  const idx = saved.id ? list.findIndex((s) => s.id === saved.id) : -1;
  if (idx === -1) return [...list, saved];
  const next = list.slice();
  next[idx] = saved;
  return next;
}

type ViewMode = 'list' | 'calendar';

export default function TasksPage() {
  const theme = useTheme();
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);

  // `loading` covers the first load (shows the full spinner); `refreshing` is
  // every subsequent reload and only drives a thin top progress bar so the
  // calendar/list stays visible and doesn't flash empty.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [exceptions, setExceptions] = useState<MowingExceptions>({});
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [editingExceptions, setEditingExceptions] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [view, setView] = usePersistentState<ViewMode>('om.tasks.view', 'calendar');
  const [pendingDelete, setPendingDelete] = useState<Schedule | null>(null);
  // Public holidays resolved from the backend, keyed by ISO 'YYYY-MM-DD'. The
  // calendar drives which years we fetch via onRangeChange; we keep a set of
  // already-requested years so navigating months doesn't refetch endlessly.
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const fetchedYears = useRef<Set<number>>(new Set());
  const hasLoaded = useRef(false);
  // The country/region the holiday cache was built for. Only when this changes
  // do we drop the cache — otherwise a routine refresh keeps the resolved names
  // and the calendar doesn't flicker.
  const holidayRegion = useRef<string>('');

  const refresh = useCallback(async () => {
    if (!rpc) return;
    // First load gets the full spinner; later reloads only the top bar.
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // schedule.list is the only call that must succeed; history/exceptions
      // are best-effort enrichers added by newer scheduler builds. Fire them in
      // parallel so the total latency is the slowest call, not their sum.
      const [listRes, histRes, excRes] = await Promise.allSettled([
        rpc.schedule.list() as unknown as Promise<Schedule[]>,
        rpc.schedule.history({limit: 200}) as unknown as Promise<ScheduleRun[]>,
        rpc.exceptions.get() as unknown as Promise<MowingExceptions>,
      ]);
      if (listRes.status === 'rejected') throw listRes.reason;
      setSchedules(listRes.value ?? []);
      setRuns(histRes.status === 'fulfilled' ? (histRes.value ?? []) : []);
      const exc = excRes.status === 'fulfilled' ? (excRes.value ?? {}) : {};
      setExceptions(exc);
      // Drop the holiday cache only when the configured country/region actually
      // changed; a routine refresh keeps the resolved names so the calendar
      // doesn't flash blank while it refetches.
      const region = `${exc.country ?? ''}/${exc.subdiv ?? ''}`;
      if (region !== holidayRegion.current) {
        holidayRegion.current = region;
        fetchedYears.current = new Set();
        setHolidays(new Map());
      }
      hasLoaded.current = true;
    } catch (e) {
      setError((e as Error).message);
      setSchedules([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rpc]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Resolve public-holiday names for any year that becomes visible in the
  // calendar. Best-effort: older scheduler builds without exceptions.holidays
  // simply yield no names, and the calendar falls back to manual blocks only.
  const loadHolidays = useCallback(
    async (from: Date, to: Date) => {
      if (!rpc || !exceptions.country) return;
      const years: number[] = [];
      for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        if (!fetchedYears.current.has(y)) years.push(y);
      }
      if (years.length === 0) return;
      for (const y of years) fetchedYears.current.add(y);
      try {
        const result = (await rpc.exceptions.holidays({
          from: `${years[0]}-01-01`,
          to: `${years[years.length - 1]}-12-31`,
        })) as unknown as {holidays?: Holiday[]};
        const list = result?.holidays ?? [];
        setHolidays((prev) => {
          const next = new Map(prev);
          for (const h of list) next.set(h.date, h.name);
          return next;
        });
      } catch {
        // Roll the years back so a later navigation can retry.
        for (const y of years) fetchedYears.current.delete(y);
      }
    },
    [rpc, exceptions.country],
  );

  const handleSave = async (schedule: Schedule) => {
    if (!rpc) return;
    const prev = schedules;
    try {
      // upsert returns the persisted schedule (with a server-assigned id on
      // create); merge that into local state so the calendar updates without
      // waiting for the reconcile refresh.
      const saved = ((await rpc.schedule.upsert({schedule: schedule as never})) as unknown as Schedule) ?? schedule;
      setSchedules((cur) => upsertSchedule(cur, saved));
      toast.success(`Saved ${schedule.name}`);
      setEditing(null);
      // Reconcile read-only fields (next_run, last_*) in the background.
      refresh();
    } catch (e) {
      setSchedules(prev);
      toast.error(`Save failed: ${(e as Error).message}`);
      throw e; // keep the editor open + spinner cleared by its own catch
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    if (!rpc || !schedule.id) return;
    const prev = schedules;
    const next = {...schedule, enabled: !schedule.enabled};
    // Flip immediately, roll back on failure.
    setSchedules((cur) => upsertSchedule(cur, next));
    try {
      await rpc.schedule.upsert({schedule: next as never});
      refresh();
    } catch (e) {
      setSchedules(prev);
      toast.error(`Toggle failed: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (schedule: Schedule) => {
    if (!rpc || !schedule.id) return;
    const prev = schedules;
    setPendingDelete(null);
    setSchedules((cur) => cur.filter((s) => s.id !== schedule.id));
    try {
      await rpc.schedule.delete({id: schedule.id});
      toast.success('Deleted');
      refresh();
    } catch (e) {
      setSchedules(prev);
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleSaveExceptions = async (e: MowingExceptions) => {
    if (!rpc) return;
    const prev = exceptions;
    try {
      await rpc.exceptions.set({exceptions: e as never});
      // Apply immediately so the calendar's block tints/windows update at once.
      setExceptions(e);
      toast.success('Saved exceptions');
      setEditingExceptions(false);
      refresh();
    } catch (err) {
      setExceptions(prev);
      toast.error(`Save failed: ${(err as Error).message}`);
      throw err;
    }
  };

  // Calendar tint per ISO day: manual full-day blocks plus resolved public
  // holidays (with their name for the tooltip). Holidays are fetched lazily by
  // loadHolidays as the visible range changes.
  const blockedDays = useMemo(() => {
    const m = new Map<string, BlockedDay>();
    for (const [date, name] of holidays) {
      m.set(date, {reason: 'holiday', label: name});
    }
    // Manual blocks take precedence over a holiday tint on the same day.
    for (const d of exceptions.blocking_days ?? []) {
      m.set(d, {reason: 'blocked'});
    }
    return m;
  }, [exceptions, holidays]);

  // Upcoming holidays + manual blocks for the list view (next ~90 days).
  const upcomingBlocks = useMemo(() => {
    const out: {date: string; label: string; reason: 'blocked' | 'holiday'}[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 90);
    for (const [date, day] of blockedDays) {
      const d = new Date(`${date}T00:00:00`);
      if (d >= today && d <= horizon) {
        out.push({date, reason: day.reason, label: day.label ?? (day.reason === 'holiday' ? 'Public holiday' : 'Blocking day')});
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [blockedDays]);

  const enabledCount = schedules.filter((s) => s.enabled).length;
  const failureCount = runs.filter((r) => r.status === 'aborted' || r.status === 'failed').length;

  return (
    <Page>
      <PageHeader title="Tasks" subtitle="Plan recurring mowing jobs">
        <HeaderStat icon={<ScheduleIcon />} value={schedules.length} label="Total schedules" />
        <HeaderStat icon={<CheckIcon />} value={enabledCount} label="Enabled" />
        <HeaderStat icon={<HistoryIcon />} value={failureCount} label="Recent failures" />
      </PageHeader>

      <PageContent>
        {error && (
          <Alert severity="warning" sx={{mb: 2}}>
            Could not load schedules: {error}. Make sure the <code>mower_scheduler</code> node is running on the mower.
          </Alert>
        )}

        <Card sx={outerCardStyles(theme)}>
          <CardContent>
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
              <ToggleButtonGroup
                size="small"
                exclusive
                value={view}
                onChange={(_, v: ViewMode | null) => v && setView(v)}
              >
                <ToggleButton value="calendar" aria-label="Calendar view">
                  <CalendarIcon fontSize="small" sx={{mr: 0.5}} /> Calendar
                </ToggleButton>
                <ToggleButton value="list" aria-label="List view">
                  <ListIcon fontSize="small" sx={{mr: 0.5}} /> List
                </ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                <Button
                  variant="outlined"
                  startIcon={<PlayIcon />}
                  onClick={() => setStartOpen(true)}
                  disabled={!rpc}
                >
                  Mow now
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<BlockIcon />}
                  onClick={() => setEditingExceptions(true)}
                  disabled={!rpc}
                >
                  Exceptions
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => setHistoryOpen(true)}
                  disabled={!rpc}
                >
                  History
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setEditing(emptySchedule())}
                  disabled={!rpc}
                >
                  New
                </Button>
              </Box>
            </Box>

            {/* Background reloads keep the content visible behind a thin bar so
                the calendar/list never flashes empty mid-refresh. */}
            <Box sx={{height: 4, mb: 1}}>{refreshing && <LinearProgress />}</Box>

            {loading ? (
              <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                <CircularProgress />
              </Box>
            ) : view === 'calendar' ? (
              <>
                {schedules.length === 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      flexWrap: 'wrap',
                      mb: 1.5,
                      p: 1.5,
                      borderRadius: 1.5,
                      backgroundColor: theme.palette.action.hover,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No schedules yet — pick a day or time slot below, or click New to create one.
                    </Typography>
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(emptySchedule())}>
                      New
                    </Button>
                  </Box>
                )}
                <CalendarView
                  schedules={schedules}
                  runs={runs}
                  blockedDays={blockedDays}
                  blockWindows={exceptions.block_windows ?? []}
                  onSelectSchedule={setEditing}
                  onCreateAt={(at) => setEditing(emptySchedule(at))}
                  onRangeChange={loadHolidays}
                />
              </>
            ) : schedules.length === 0 && (exceptions.block_windows ?? []).length === 0 && upcomingBlocks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{py: 2}}>
                No schedules yet. Click <strong>New</strong> to create one.
              </Typography>
            ) : (
              <>
              <List disablePadding>
                {schedules.map((s) => (
                  <ListItem
                    key={s.id ?? s.name}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      backgroundColor: theme.palette.action.hover,
                      px: {xs: 1.5, md: 2},
                      py: {xs: 1, md: 1.5},
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: {xs: 'column', md: 'row'},
                        alignItems: {xs: 'stretch', md: 'center'},
                        gap: {xs: 1, md: 2},
                        width: '100%',
                      }}
                    >
                      <ListItemText
                        sx={{flex: 1, minWidth: 0, m: 0}}
                        primary={
                          <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                            <Typography variant="body1" fontWeight="600">
                              {s.name || '(unnamed)'}
                            </Typography>
                            <Chip size="small" variant="outlined" label={MODE_LABELS[s.mode ?? 'time_area']} />
                            {s.areas.length > 0 && (
                              <Chip size="small" label={`${s.areas.length} area${s.areas.length === 1 ? '' : 's'}`} />
                            )}
                            {s.last_skip_reason && (
                              <Chip size="small" color="warning" label={SKIP_LABELS[s.last_skip_reason]} />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{display: 'block'}}>
                            <Typography component="span" variant="caption" sx={{display: 'block'}}>
                              {s.mode === 'time_window'
                                ? `Window ${s.window?.start ?? '?'}–${s.window?.end ?? '?'}`
                                : s.mode === 'continuous'
                                  ? '24/7 — all active areas'
                                  : `${describeRrule(s.rrule)} · ${s.duration_minutes} min`}
                            </Typography>
                            <Typography component="span" variant="caption" color="text.secondary">
                              Next run: {formatNextRun(s.next_run)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          flexShrink: 0,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Switch checked={s.enabled} onChange={() => handleToggle(s)} />
                        <Button size="small" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        <IconButton color="error" onClick={() => setPendingDelete(s)} aria-label="Delete">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </List>

              {(exceptions.block_windows ?? []).length > 0 && (
                <Box sx={{mt: 2}}>
                  <Typography variant="subtitle2" sx={{mb: 1}}>
                    Block windows
                  </Typography>
                  <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
                    {(exceptions.block_windows ?? []).map((w, i) => (
                      <Chip
                        key={i}
                        size="small"
                        color="warning"
                        variant="outlined"
                        icon={<BlockIcon />}
                        label={describeBlockWindow(w)}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {upcomingBlocks.length > 0 && (
                <Box sx={{mt: 2}}>
                  <Typography variant="subtitle2" sx={{mb: 1}}>
                    Upcoming blocked days
                  </Typography>
                  <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
                    {upcomingBlocks.map((b) => (
                      <Chip
                        key={b.date}
                        size="small"
                        color="warning"
                        variant={b.reason === 'holiday' ? 'filled' : 'outlined'}
                        label={`${b.date} · ${b.label}`}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              </>
            )}
          </CardContent>
        </Card>

        {editing !== null && (
          <ScheduleEditor initial={editing} onCancel={() => setEditing(null)} onSave={handleSave} />
        )}
        {editingExceptions && (
          <ExceptionsManager
            initial={exceptions}
            onCancel={() => setEditingExceptions(false)}
            onSave={handleSaveExceptions}
          />
        )}
        {startOpen && <StartMowingDialog onClose={() => setStartOpen(false)} />}
        <RunHistoryDrawer open={historyOpen} runs={runs} onClose={() => setHistoryOpen(false)} />
        <ConfirmDialog
          open={pendingDelete !== null}
          title="Delete schedule?"
          message={
            <>
              This removes <strong>{pendingDelete?.name || '(unnamed)'}</strong> and its recurrence. This cannot be
              undone.
            </>
          }
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete) return handleDelete(pendingDelete);
          }}
        />
      </PageContent>
    </Page>
  );
}
