'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  EventEntry,
  EventSeverity,
  eventSeverityRank,
} from '@/stores/schemas';
import {
  useActiveMowerIdForNotifications,
  useEventsForActive,
  useNotificationsStore,
  useUnreadForActive,
} from '@/stores/notificationsStore';
import {
  CheckCircleOutline,
  ClearAll,
  DeleteSweep,
  ErrorOutline,
  ExpandLess,
  ExpandMore,
  InfoOutlined,
  NotificationsActive,
  NotificationsOff,
  ReportProblemOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  keyframes,
  useTheme,
} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';

const TIME_RANGES = [
  {value: 'hour', label: '1h', ms: 60 * 60 * 1000},
  {value: 'day', label: '24h', ms: 24 * 60 * 60 * 1000},
  {value: 'week', label: '7d', ms: 7 * 24 * 60 * 60 * 1000},
  {value: 'all', label: 'All', ms: Infinity},
] as const;

type TimeRange = (typeof TIME_RANGES)[number]['value'];

const SEVERITY_FILTERS: EventSeverity[] = ['info', 'warning', 'error', 'critical'];

const pulseRed = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.6); }
  50% { box-shadow: 0 0 0 8px rgba(244, 67, 54, 0); }
`;

export default function NotificationsPage() {
  const theme = useTheme();
  const toast = useToast();

  const events = useEventsForActive();
  const unread = useUnreadForActive();
  const mowerId = useActiveMowerIdForNotifications();
  const mowerName = useSelectedMower((s) => s?.name);
  const ack = useNotificationsStore((s) => s.ack);
  const ackAll = useNotificationsStore((s) => s.ackAll);
  const clear = useNotificationsStore((s) => s.clear);
  const loaded = useNotificationsStore((s) => (mowerId ? s.byMower[mowerId]?.loaded ?? false : false));

  const [enabledSeverities, setEnabledSeverities] = useState<EventSeverity[]>(SEVERITY_FILTERS);
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  // Detect / track Notification permission so we can offer the enable button.
  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === 'granted') toast.success('Browser notifications enabled');
    } catch {
      toast.error('Could not request notification permission');
    }
  };

  const filtered = useMemo<EventEntry[]>(() => {
    const cutoffMs = TIME_RANGES.find((r) => r.value === timeRange)?.ms ?? Infinity;
    const cutoff = cutoffMs === Infinity ? 0 : Date.now() - cutoffMs;
    const needle = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!enabledSeverities.includes(e.severity)) return false;
      if (e.ts_ms < cutoff) return false;
      if (needle && !(`${e.type} ${e.summary} ${e.source}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [events, enabledSeverities, timeRange, search]);

  const handleAck = async (id: string) => {
    try {
      await ack(mowerId!, id);
    } catch (e) {
      toast.error(`Failed to acknowledge: ${(e as Error).message}`);
    }
  };

  const handleAckAll = async () => {
    if (!mowerId) return;
    try {
      await ackAll(mowerId);
    } catch (e) {
      toast.error(`Failed to acknowledge all: ${(e as Error).message}`);
    }
  };

  const handleClear = async () => {
    if (!mowerId) return;
    setConfirmClearOpen(false);
    try {
      await clear(mowerId);
      toast.success('Notification history cleared');
    } catch (e) {
      toast.error(`Failed to clear: ${(e as Error).message}`);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Notifications"
        subtitle={
          mowerName
            ? `Recent lifecycle events from ${mowerName}.`
            : 'Recent lifecycle events from the mower.'
        }
      />
      <PageContent>
        <Stack spacing={2}>
          {permission === 'default' && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={requestPermission}>
                  Enable
                </Button>
              }
            >
              Allow browser notifications to be alerted on errors and emergencies even when the tab is in the background.
            </Alert>
          )}
          {permission === 'denied' && (
            <Alert severity="warning">
              Browser notifications are blocked. Toasts and the in-app bell still work; enable browser notifications in your
              browser settings to also receive alerts when the tab is hidden.
            </Alert>
          )}

          <Stack
            direction={{xs: 'column', md: 'row'}}
            spacing={1.5}
            alignItems={{xs: 'stretch', md: 'center'}}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                size="small"
                value={enabledSeverities}
                onChange={(_e, next: EventSeverity[]) => {
                  // Always keep at least one severity selected.
                  if (next.length > 0) setEnabledSeverities(next);
                }}
                aria-label="Filter by severity"
              >
                {SEVERITY_FILTERS.map((sev) => (
                  <ToggleButton key={sev} value={sev} sx={{textTransform: 'capitalize', px: 1.5}}>
                    {severityIcon(sev, 'small', theme)}
                    <Box component="span" sx={{ml: 0.5}}>
                      {sev}
                    </Box>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <ToggleButtonGroup
                size="small"
                exclusive
                value={timeRange}
                onChange={(_e, next: TimeRange | null) => {
                  if (next) setTimeRange(next);
                }}
                aria-label="Time range"
              >
                {TIME_RANGES.map((r) => (
                  <ToggleButton key={r.value} value={r.value} sx={{px: 1.5}}>
                    {r.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>

            <TextField
              size="small"
              placeholder="Search type, summary, source"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{minWidth: {xs: '100%', md: 280}}}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <NotificationsActive fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{flexWrap: 'wrap'}} useFlexGap>
            <Chip
              label={`${filtered.length} shown · ${unread} unread`}
              size="small"
              color={unread > 0 ? 'error' : 'default'}
              variant={unread > 0 ? 'filled' : 'outlined'}
            />
            <Box sx={{flex: 1}} />
            <Button
              size="small"
              startIcon={<ClearAll />}
              onClick={handleAckAll}
              disabled={!mowerId || unread === 0}
            >
              Acknowledge all
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteSweep />}
              onClick={() => setConfirmClearOpen(true)}
              disabled={!mowerId || events.length === 0}
            >
              Clear history
            </Button>
          </Stack>

          {!mowerId ? (
            <Alert severity="info">Select a mower to view notifications.</Alert>
          ) : !loaded ? (
            <Alert severity="info">Waiting for retained events snapshot…</Alert>
          ) : filtered.length === 0 ? (
            <Card sx={{p: 4, textAlign: 'center'}}>
              <NotificationsOff sx={{fontSize: 48, opacity: 0.4}} />
              <Typography variant="h6" sx={{mt: 1}}>
                {events.length === 0 ? 'No notifications yet' : 'No matches for current filter'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {events.length === 0
                  ? 'Events appear here as soon as the mower reports a state change, error or skipped schedule.'
                  : 'Try widening the time range or removing the search term.'}
              </Typography>
            </Card>
          ) : (
            <Stack spacing={1}>
              {filtered.map((ev) => (
                <NotificationRow
                  key={ev.id}
                  event={ev}
                  expanded={expandedId === ev.id}
                  onToggle={() => setExpandedId((cur) => (cur === ev.id ? null : ev.id))}
                  onAck={() => handleAck(ev.id)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </PageContent>

      <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)}>
        <DialogTitle>Clear notification history?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes every event from the mower&apos;s notification ring buffer and from disk. New events
            will continue to arrive as the mower runs.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleClear}>
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );

  function severityIcon(s: EventSeverity, size: 'small' | 'medium', t: typeof theme) {
    switch (s) {
      case 'info':
        return <InfoOutlined fontSize={size} sx={{color: t.palette.info.main}} />;
      case 'warning':
        return <WarningAmberOutlined fontSize={size} sx={{color: t.palette.warning.main}} />;
      case 'error':
        return <ErrorOutline fontSize={size} sx={{color: t.palette.error.main}} />;
      case 'critical':
        return <ReportProblemOutlined fontSize={size} sx={{color: t.palette.error.main}} />;
    }
  }
}

interface NotificationRowProps {
  event: EventEntry;
  expanded: boolean;
  onToggle: () => void;
  onAck: () => void;
}

function NotificationRow({event, expanded, onToggle, onAck}: NotificationRowProps) {
  const theme = useTheme();
  const isCritical = event.severity === 'critical';
  const hasDetails = event.details && Object.keys(event.details).length > 0;
  const isUnread = !event.acked;

  const colorByRank = [
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.error.main,
  ];
  const accent = colorByRank[eventSeverityRank[event.severity]];

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: `4px solid ${accent}`,
        opacity: event.acked ? 0.75 : 1,
        animation: isCritical && isUnread ? `${pulseRed} 1.4s ease-in-out infinite` : 'none',
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5}}>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32}}>
          <SeverityIcon severity={event.severity} />
        </Box>

        <Box sx={{flex: 1, minWidth: 0}}>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
            <Typography variant="body1" sx={{fontWeight: isUnread ? 600 : 400}}>
              {event.summary}
            </Typography>
            <Chip label={event.type} size="small" variant="outlined" sx={{fontFamily: 'monospace'}} />
            {isUnread && <Chip label="new" size="small" color="error" />}
          </Box>
          <Typography variant="caption" color="text.secondary">
            <Tooltip title={new Date(event.ts_ms).toLocaleString()}>
              <span>{formatRelativeTime(event.ts_ms)}</span>
            </Tooltip>
            {' · '}
            {event.source}
          </Typography>
        </Box>

        {isUnread && (
          <Tooltip title="Acknowledge">
            <IconButton size="small" onClick={onAck} aria-label={`Acknowledge ${event.type}`}>
              <CheckCircleOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {hasDetails && (
          <Tooltip title={expanded ? 'Hide details' : 'Show details'}>
            <IconButton size="small" onClick={onToggle} aria-label="Toggle details">
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {hasDetails && (
        <Collapse in={expanded} unmountOnExit>
          <Box
            component="pre"
            sx={{
              m: 0,
              px: 2,
              py: 1.5,
              fontSize: 12,
              fontFamily: 'monospace',
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(event.details, null, 2)}
          </Box>
        </Collapse>
      )}
    </Card>
  );
}

function SeverityIcon({severity}: {severity: EventSeverity}) {
  const theme = useTheme();
  switch (severity) {
    case 'info':
      return <InfoOutlined sx={{color: theme.palette.info.main}} />;
    case 'warning':
      return <WarningAmberOutlined sx={{color: theme.palette.warning.main}} />;
    case 'error':
      return <ErrorOutline sx={{color: theme.palette.error.main}} />;
    case 'critical':
      return <ReportProblemOutlined sx={{color: theme.palette.error.main}} />;
  }
}

function formatRelativeTime(ts_ms: number): string {
  const diff = Date.now() - ts_ms;
  if (diff < 60_000) return 'just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  if (diff < 7 * 24 * 60 * 60_000) return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
  return new Date(ts_ms).toLocaleDateString();
}
