'use client';

import {useToast} from '@/hooks/useToast';
import {useSelectedMower} from '@/stores/mowersStore';
import {ContentCopy as CopyIcon, Refresh as RefreshIcon} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

interface LogEntry {
  ts: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  source: string;
}

const SOURCES = ['all', 'mower_logic', 'xbot_monitoring', 'mower_scheduler', 'move_base_flex'] as const;
type Source = (typeof SOURCES)[number];

const LINE_PRESETS = [50, 200, 1000];
const AUTO_REFRESH_MS = 5000;

// Live-ish journal viewer for the mower host. Pulls via the `logs.tail` RPC
// and rerenders on each fetch. Capability-gated so the page renders a clean
// "not available" message on older backends instead of an opaque RPC error.
export default function LogsView() {
  const theme = useTheme();
  const toast = useToast();
  const rpc = useSelectedMower((s) => s?.rpc);
  const hasCap = useSelectedMower((s) => s?.hasCapability('logs.tail') ?? false);

  const [source, setSource] = useState<Source>('all');
  const [lines, setLines] = useState(200);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [search, setSearch] = useState('');

  // Avoid stale-closure bugs in the auto-refresh interval. The latest
  // arguments are stored in refs so the effect can subscribe just once.
  const argsRef = useRef({source, lines});
  argsRef.current = {source, lines};

  const fetchLogs = useCallback(async () => {
    if (!rpc) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rpc.logs.tail({source: argsRef.current.source, lines: argsRef.current.lines});
      // Result shape: { entries: LogEntry[] }. The generated rpc client types
      // are noisy — narrow with a runtime cast.
      const arr = (res as unknown as {entries?: LogEntry[]})?.entries ?? [];
      setEntries(arr);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  // Initial fetch + on every config change while the page is open.
  useEffect(() => {
    if (hasCap && rpc) fetchLogs();
  }, [hasCap, rpc, fetchLogs, source, lines]);

  // Auto-refresh interval. Cleans up reliably so leaving the page kills the poll.
  useEffect(() => {
    if (!autoRefresh || !hasCap || !rpc) return;
    const t = setInterval(fetchLogs, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, hasCap, rpc, fetchLogs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const needle = search.toLowerCase();
    return entries.filter((e) => e.msg.toLowerCase().includes(needle) || e.source.toLowerCase().includes(needle));
  }, [entries, search]);

  const copyAll = async () => {
    const text = filtered
      .map((e) => `${new Date(e.ts * 1000).toISOString()} ${e.level.toUpperCase()} ${e.source}: ${e.msg}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${filtered.length} lines copied`);
    } catch (e) {
      toast.error(`Copy failed: ${(e as Error).message}`);
    }
  };

  if (!hasCap) {
    return (
      <Alert severity="info" sx={{mt: 2}}>
        Logs RPC not available — backend may be outdated. The frontend needs an{' '}
        <code>xbot_monitoring</code> build that registers <code>logs.tail</code> and reports the{' '}
        <code>logs.tail</code> capability.
      </Alert>
    );
  }

  return (
    <Card sx={{mt: 2}}>
      <CardContent>
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2}}>
          <TextField
            select
            size="small"
            label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            sx={{minWidth: 180}}
          >
            {SOURCES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Lines"
            value={lines}
            onChange={(e) => setLines(parseInt(e.target.value, 10))}
            sx={{minWidth: 100}}
          >
            {LINE_PRESETS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{minWidth: 200, flex: 1}}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
            disabled={loading}
            onClick={fetchLogs}
          >
            Refresh
          </Button>
          <FormControlLabel
            control={
              <Switch size="small" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            }
            label="Auto"
          />
          <Tooltip title="Copy filtered lines as plaintext">
            <span>
              <IconButton size="small" onClick={copyAll} disabled={filtered.length === 0}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="error" sx={{mb: 2}}>
            {error}
          </Alert>
        )}

        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
          <Chip size="small" label={`${filtered.length} entries`} />
          {search && filtered.length !== entries.length && (
            <Typography variant="caption" color="text.secondary">
              filtered from {entries.length}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            maxHeight: 'calc(100vh - 360px)',
            minHeight: 300,
            overflow: 'auto',
            fontFamily: 'var(--font-dm-mono), monospace',
            fontSize: {xs: '0.65rem', md: '0.78rem'},
            lineHeight: 1.55,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
            // content-visibility lets the browser skip rendering off-screen
            // rows — keeps thousands of lines smooth without react-window.
            '& > div': {contentVisibility: 'auto', containIntrinsicSize: '24px'},
          }}
        >
          {filtered.length === 0 && !loading && (
            <Box sx={{p: 2}}>
              <Typography variant="body2" color="text.disabled">
                No entries.
              </Typography>
            </Box>
          )}
          {filtered.map((e, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'grid',
                // On mobile we drop the dedicated source column; the source name
                // is inlined in front of the message instead. Long messages
                // scroll horizontally inside the outer auto-overflow container.
                gridTemplateColumns: {xs: '92px 44px 1fr', md: '180px 64px 140px 1fr'},
                gap: 1,
                px: 1.5,
                py: 0.25,
                color: levelColor(e.level, theme.palette.mode === 'dark'),
                '&:hover': {bgcolor: theme.palette.action.hover},
              }}
            >
              <Box sx={{color: theme.palette.text.disabled}}>{fmtTs(e.ts)}</Box>
              <Box sx={{textTransform: 'uppercase', fontWeight: 600}}>{e.level}</Box>
              <Box sx={{color: theme.palette.text.secondary, display: {xs: 'none', md: 'block'}}}>{e.source}</Box>
              <Box sx={{whiteSpace: 'pre', wordBreak: 'normal'}}>
                <Box
                  component="span"
                  sx={{display: {xs: 'inline', md: 'none'}, mr: 0.5, opacity: 0.6, color: theme.palette.text.secondary}}
                >
                  {e.source}:
                </Box>
                {highlight(e.msg, search)}
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function fmtTs(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

function levelColor(level: LogEntry['level'], dark: boolean): string {
  switch (level) {
    case 'error':
      return dark ? '#FF6B5C' : '#C93020';
    case 'warn':
      return dark ? '#F8B752' : '#B47208';
    case 'debug':
      return dark ? '#7AB8FF' : '#1565C0';
    case 'info':
    default:
      return 'inherit';
  }
}

// Tiny string highlighter — wraps the matched substring in a <mark>. Keeps it
// readable but doesn't clobber line layout.
function highlight(text: string, needle: string): React.ReactNode {
  if (!needle.trim()) return text;
  const lc = text.toLowerCase();
  const lcNeedle = needle.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const next = lc.indexOf(lcNeedle, i);
    if (next === -1) {
      out.push(text.slice(i));
      break;
    }
    if (next > i) out.push(text.slice(i, next));
    out.push(
      <mark key={next} style={{backgroundColor: '#F5A52344', color: 'inherit'}}>
        {text.slice(next, next + needle.length)}
      </mark>,
    );
    i = next + needle.length;
  }
  return out;
}
