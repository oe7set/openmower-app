'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useToast} from '@/hooks/useToast';
import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  Add as AddIcon,
  CheckCircle as CheckIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
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
  Typography,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useState} from 'react';
import ScheduleEditor, {type Schedule} from './ScheduleEditor';
import {DEFAULT_RRULE_PARTS, partsToRrule} from './rrule';

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

export default function TasksPage() {
  const theme = useTheme();
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const refresh = useCallback(async () => {
    if (!rpc) return;
    setLoading(true);
    setError(null);
    try {
      // The schedule.list method is added by the mower_scheduler ROS node;
      // backends without it will return ERROR_METHOD_NOT_FOUND, which we
      // surface as an empty list with an informative banner.
      const result = (await rpc.schedule.list()) as unknown as Schedule[];
      setSchedules(result ?? []);
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

  const enabledCount = schedules.filter((s) => s.enabled).length;

  return (
    <Page>
      <PageHeader title="Tasks" subtitle="Schedule recurring mowing jobs">
        <HeaderStat icon={<ScheduleIcon />} value={schedules.length} label="Total schedules" />
        <HeaderStat icon={<CheckIcon />} value={enabledCount} label="Enabled" />
      </PageHeader>

      <PageContent>
        {error && (
          <Alert severity="warning" sx={{mb: 2}}>
            Could not load schedules: {error}. Make sure the <code>mower_scheduler</code> node is running on the mower.
          </Alert>
        )}

        <Card sx={outerCardStyles(theme)}>
          <CardContent>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5}}>
              <Typography variant="h6" fontWeight="600">
                Schedules
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setEditing(emptySchedule())}
                disabled={!rpc}
              >
                New
              </Button>
            </Box>

            {loading ? (
              <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                <CircularProgress />
              </Box>
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
                    }}
                    secondaryAction={
                      <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Switch checked={s.enabled} onChange={() => handleToggle(s)} />
                        <Button size="small" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        <IconButton color="error" onClick={() => handleDelete(s)} aria-label="Delete">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                          <Typography variant="body1" fontWeight="600">
                            {s.name || '(unnamed)'}
                          </Typography>
                          {s.areas.length > 0 && (
                            <Chip size="small" label={`${s.areas.length} area${s.areas.length === 1 ? '' : 's'}`} />
                          )}
                          {s.last_skip_reason && (
                            <Chip
                              size="small"
                              color="warning"
                              label={SKIP_LABELS[s.last_skip_reason]}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{display: 'block'}}>
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{fontFamily: 'monospace', display: 'block'}}
                          >
                            {s.rrule} · {s.duration_minutes} min · {s.timezone}
                          </Typography>
                          <Typography component="span" variant="caption" color="text.secondary">
                            Next run: {formatNextRun(s.next_run)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {editing !== null && (
          <ScheduleEditor
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={handleSave}
          />
        )}
      </PageContent>
    </Page>
  );
}

