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
  List,
  ListItem,
  ListItemText,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useState} from 'react';
import ScheduleEditor, {type Schedule} from './ScheduleEditor';
import CalendarView from './CalendarView';
import ExceptionsManager from './ExceptionsManager';
import RunHistoryDrawer from './RunHistoryDrawer';
import {DEFAULT_RRULE_PARTS, describeRrule, partsToRrule} from './rrule';
import type {MowingExceptions, ScheduleRun} from './types';

// Resolve the browser's IANA zone (e.g. 'Europe/Vienna'). Falls back to UTC
// on the rare engines that don't expose a name — the scheduler accepts that.
// TODO: this hard-wires the schedule timezone to whatever zone the browser
// happens to be in when a schedule is created. That is fine for the common
// case (mower owner edits from home), but breaks for travelling owners and
// for headless edits. Move the timezone to a per-mower config param or surface
// a picker in the editor so the choice is explicit instead of implicit.
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function emptySchedule(): Schedule {
  return {
    name: '',
    enabled: true,
    mode: 'time_area',
    areas: [],
    rrule: partsToRrule(DEFAULT_RRULE_PARTS),
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

type ViewMode = 'list' | 'calendar';

export default function TasksPage() {
  const theme = useTheme();
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [exceptions, setExceptions] = useState<MowingExceptions>({});
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [editingExceptions, setEditingExceptions] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('calendar');

  const refresh = useCallback(async () => {
    if (!rpc) return;
    setLoading(true);
    setError(null);
    try {
      // schedule.list is the only call that must succeed; history/exceptions
      // are best-effort enrichers added by newer scheduler builds.
      const result = (await rpc.schedule.list()) as unknown as Schedule[];
      setSchedules(result ?? []);
      try {
        const hist = (await rpc.schedule.history({limit: 200})) as unknown as ScheduleRun[];
        setRuns(hist ?? []);
      } catch {
        setRuns([]);
      }
      try {
        const exc = (await rpc.exceptions.get()) as unknown as MowingExceptions;
        setExceptions(exc ?? {});
      } catch {
        setExceptions({});
      }
    } catch (e) {
      setError((e as Error).message);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async (schedule: Schedule) => {
    if (!rpc) return;
    try {
      await rpc.schedule.upsert({schedule: schedule as never});
      toast.success(`Saved ${schedule.name}`);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    if (!rpc || !schedule.id) return;
    try {
      await rpc.schedule.upsert({schedule: {...schedule, enabled: !schedule.enabled} as never});
      refresh();
    } catch (e) {
      toast.error(`Toggle failed: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (schedule: Schedule) => {
    if (!rpc || !schedule.id) return;
    if (!window.confirm(`Delete schedule "${schedule.name}"?`)) return;
    try {
      await rpc.schedule.delete({id: schedule.id});
      toast.success('Deleted');
      refresh();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleSaveExceptions = async (e: MowingExceptions) => {
    if (!rpc) return;
    try {
      await rpc.exceptions.set({exceptions: e as never});
      toast.success('Saved blocking days');
      setEditingExceptions(false);
      refresh();
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    }
  };

  // Manual blocking days for the calendar tint. Public holidays are computed
  // server-side and surface via skip reasons / run history, not here.
  const blockedDays = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of exceptions.blocking_days ?? []) {
      m.set(d, 'blocked');
    }
    return m;
  }, [exceptions]);

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
                  startIcon={<BlockIcon />}
                  onClick={() => setEditingExceptions(true)}
                  disabled={!rpc}
                >
                  Blocking days
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

            {loading ? (
              <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                <CircularProgress />
              </Box>
            ) : view === 'calendar' ? (
              <CalendarView
                schedules={schedules}
                runs={runs}
                blockedDays={blockedDays}
                onSelectSchedule={setEditing}
              />
            ) : schedules.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{py: 2}}>
                No schedules yet. Click <strong>New</strong> to create one.
              </Typography>
            ) : (
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
                        <IconButton color="error" onClick={() => handleDelete(s)} aria-label="Delete">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </List>
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
        <RunHistoryDrawer open={historyOpen} runs={runs} onClose={() => setHistoryOpen(false)} />
      </PageContent>
    </Page>
  );
}
