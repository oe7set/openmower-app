'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useSelectedMower} from '@/stores/mowersStore';
import {useEffectiveDatum} from '@/utils/datum';
import bbox from '@turf/bbox';
import {featureCollection, point} from '@turf/helpers';
import type {Feature, Point} from 'geojson';
import type {Map as MlMap} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RFullscreenControl, RMap} from 'maplibre-react-components';
import {
  Refresh as RefreshIcon,
  ListAlt as ListAltIcon,
  Download as DownloadIcon,
  ShowChart as ShowChartIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FocusIcon} from 'lucide-react';
import {datumToRelative, pointToAbsolute} from '@/utils/coordinates';
import ControlButton from '@/components/map/ControlButton';
import MapStyleSelector from '@/components/map/MapStyleSelector';
import {mapStyles} from '@/components/map/mapStyles';
import PathLayer from '@/components/map/layers/PathLayer';
import {useUiStore} from '@/stores/uiStore';
import HeatmapLayer from './HeatmapLayer';
import HeatmapGridLayer, {type GridCellInfo} from './HeatmapGridLayer';
import {METRICS, type MetricId, type Sample} from './metrics';
import {rampSwatch} from './colors';
import TimeSeriesChart, {type TimeSeriesChartHandle} from './TimeSeriesChart';
import HoverMarker, {type HoverMarkerHandle} from './HoverMarker';
import HoverInfo, {type HoverInfoHandle} from './HoverInfo';
import {buildPathSegments} from './path';
import {buildSessionZip, downloadBytes, sessionFileStem, type SessionMeta} from './export';

const ALL_METRICS: MetricId[] = [
  'gps',
  'gps_accuracy',
  'state',
  'speed',
  'wifi',
  'imu',
  'vibration',
  'tilt',
  'turn_rate',
  'mow_current',
  'mow_rpm',
  'mow_temp',
  'mow_esc_temp',
  'esc_temp',
  'battery',
  // Localisation-debug metrics: only populated on record_all_states sessions,
  // otherwise render nothing. Kept last so they don't clutter normal use.
  'heading_error',
  'offset_error',
  'composite',
];

// Full-resolution loading via pagination. The single-shot payload was the old
// bottleneck (one big JSON publish over the WebSocket broker), so instead of
// decimating hard we fetch at full resolution (stride=1) in small pages and
// render each page as it arrives. Each page stays ~100-150 KB, so there is no
// timeout and the map fills in progressively even for multi-hour mows.
const SAMPLE_STRIDE = 1;
const PAGE_SIZE = 4000;
// Safety cap so a pathological/runaway session can't load unbounded points into
// the browser; well above a normal multi-hour mow at the gated sample rate.
const MAX_TOTAL_POINTS = 60_000;

// Per-page timeout: pages are small, so a moderate ceiling is plenty and keeps
// a genuinely stuck page from hanging too long.
const SESSION_FETCH_TIMEOUT_MS = 30_000;

// Grid heatmap cell size in metres. ~0.25 m ≈ the mowing track width, so cells
// merge into a continuous coverage surface while still resolving thin gaps.
const GRID_CELL_SIZE_M = 0.25;

export default function HeatmapPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const rpc = useSelectedMower((s) => s?.rpc);
  const {datum, hasReal: hasRealDatum} = useEffectiveDatum();
  const mapStyle = useUiStore((s) => s.mapStyle);
  const hasCap = useSelectedMower((s) => s?.hasCapability('telemetry.list_sessions') ?? false);

  // Independent, combinable overlay toggles (persisted). Grid is the default
  // heatmap look; points and the driven path are opt-in.
  const showGrid = useUiStore((s) => s.heatmapShowGrid);
  const showPoints = useUiStore((s) => s.heatmapShowPoints);
  const showPath = useUiStore((s) => s.heatmapShowPath);
  const setShowGrid = useUiStore((s) => s.setHeatmapShowGrid);
  const setShowPoints = useUiStore((s) => s.setHeatmapShowPoints);
  const setShowPath = useUiStore((s) => s.setHeatmapShowPath);

  const [sessions, setSessions] = useState<SessionMeta[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Sample cache so re-toggling a session doesn't refetch.
  const samplesRef = useRef<Map<string, Sample[]> | null>(null);
  if (samplesRef.current === null) samplesRef.current = new Map<string, Sample[]>();
  // In-flight loads keyed by session id, so a display toggle and an export of
  // the same session share one paginated fetch instead of racing the broker.
  const inFlightRef = useRef<Map<string, Promise<Sample[]>> | null>(null);
  if (inFlightRef.current === null) inFlightRef.current = new Map<string, Promise<Sample[]>>();
  // Bump on every successful fetchSamples so the fit-bounds effect re-runs
  // even though samplesRef itself is mutated in place.
  const [samplesVersion, setSamplesVersion] = useState(0);
  const [loadingSamples, setLoadingSamples] = useState<Set<string>>(new Set());
  // Points loaded so far per still-loading session, for the progress readout.
  const [loadedCounts, setLoadedCounts] = useState<Record<string, number>>({});
  const [sampleErrors, setSampleErrors] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<MetricId>('gps');
  // Sessions currently being exported (paginated load + zip), for the spinner.
  const [exporting, setExporting] = useState<Set<string>>(new Set());
  const [exportError, setExportError] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  // Time-series chart panel (desktop) / dialog (mobile) state.
  const [chartOpen, setChartOpen] = useState(false);
  // Session feeding the chart — independent of the heatmap overlay selection.
  const [chartSessionId, setChartSessionId] = useState<string | null>(null);
  // Signals plotted in the chart, independent of the heatmap metric.
  const [chartSignals, setChartSignals] = useState<Set<string>>(
    () => new Set(['om_mow_motor_current', 'om_mow_motor_rpm', 'om_mow_esc_temp']),
  );
  const mapRef = useRef<MlMap>(null);
  const [mapInstance, setMapInstance] = useState<MlMap | null>(null);

  // Hover plumbing is fully imperative: map↔chart hover fires at ~60 Hz, and
  // routing it through React state would re-render the heavy page and force a GL
  // repaint of the highlight on every frame. Instead we drive a DOM marker
  // (HoverMarker), the tooltip (HoverInfo) and the chart cursor (TimeSeriesChart)
  // through refs, coalesced to one update per animation frame. No page state.
  const markerRef = useRef<HoverMarkerHandle>(null);
  const infoRef = useRef<HoverInfoHandle>(null);
  const chartRef = useRef<TimeSeriesChartHandle>(null);
  // chartSessionId mirrored into a ref so the stable hover handlers can read the
  // current value without being re-created.
  const chartSessionIdRef = useRef<string | null>(null);
  chartSessionIdRef.current = chartSessionId;

  const rafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{idx: number | null; sessionId: string | null} | null>(null);

  // Apply the latest pending hover imperatively: position the marker, update the
  // tooltip, and (if it's the charted session) move the chart cursor.
  const flushHover = useCallback(() => {
    rafRef.current = null;
    const pending = pendingHoverRef.current;
    if (!pending) return;
    pendingHoverRef.current = null;
    const {idx, sessionId} = pending;
    const arr = sessionId ? samplesRef.current!.get(sessionId) : undefined;
    const s = idx != null && arr ? arr[idx] : undefined;
    if (s) {
      const utm = datumToRelative([datum.long, datum.lat]);
      markerRef.current?.setPosition(pointToAbsolute({x: s.x, y: s.y}, utm));
      infoRef.current?.showSample(s);
    } else {
      markerRef.current?.setPosition(null);
      infoRef.current?.clear();
    }
    if (sessionId === chartSessionIdRef.current) chartRef.current?.setCursorIndex(idx);
  }, [datum]);

  const scheduleHover = useCallback(
    (idx: number | null, sessionId: string | null) => {
      pendingHoverRef.current = {idx, sessionId};
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushHover);
    },
    [flushHover],
  );

  // Grid-cell hover → aggregate-stats tooltip (imperative, no page state).
  const handleCellHover = useCallback((info: GridCellInfo | null) => {
    if (info) infoRef.current?.showCell(info);
    else infoRef.current?.clear();
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!rpc) return;
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const res = (await rpc.telemetry.list_sessions()) as unknown as {sessions?: SessionMeta[]};
      const list = (res?.sessions ?? []).slice().sort((a, b) => b.start_ts - a.start_ts);
      setSessions(list);
    } catch (e) {
      setSessionsError((e as Error).message || 'Unknown error');
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [rpc]);

  // Guarded against re-entry: only auto-load until we have a result. Manual
  // refresh stays available via the sidebar button. Without this guard the
  // effect would re-fire whenever any of its deps churn (e.g. on mount under
  // React Strict Mode) and spam the broker with list_sessions calls.
  useEffect(() => {
    if (hasCap && rpc && sessions === null && !loadingSessions) refreshSessions();
  }, [hasCap, rpc, sessions, loadingSessions, refreshSessions]);

  // Load every sample of a session at full resolution, paginating in small
  // pages so no single payload is oversized and the cache fills progressively.
  // The result is cached in samplesRef and the in-flight promise is shared, so
  // toggling a session for display and exporting it never double-fetch. Throws
  // on a hard failure with no pages loaded; otherwise resolves with whatever
  // pages did land (and records the error for the retry UI).
  const loadAllSamples = useCallback(
    (id: string): Promise<Sample[]> => {
      const cached = samplesRef.current!.get(id);
      if (cached) return Promise.resolve(cached);
      const pending = inFlightRef.current!.get(id);
      if (pending) return pending;
      if (!rpc) return Promise.reject(new Error('Not connected'));

      const run = (async (): Promise<Sample[]> => {
        setLoadingSamples((prev) => new Set(prev).add(id));
        setLoadedCounts((prev) => ({...prev, [id]: 0}));
        setSampleErrors((prev) => {
          if (!(id in prev)) return prev;
          const next = {...prev};
          delete next[id];
          return next;
        });
        // Accumulate full-resolution samples one small page at a time, rendering
        // each page as it lands so the map fills in progressively. Each response
        // stays small (~PAGE_SIZE points), so there is no oversized single
        // payload and no timeout even for multi-hour sessions.
        const acc: Sample[] = [];
        try {
          for (let offset = 0; offset < MAX_TOTAL_POINTS; offset += PAGE_SIZE) {
            const res = (await rpc.telemetry.get_session(
              {id, stride: SAMPLE_STRIDE, offset, limit: PAGE_SIZE},
              SESSION_FETCH_TIMEOUT_MS,
            )) as unknown as {samples?: Sample[]; truncated?: boolean};
            const page = res?.samples ?? [];
            acc.push(...page);
            // Publish the growing array each page for incremental rendering.
            samplesRef.current!.set(id, acc.slice());
            setSamplesVersion((v) => v + 1);
            setLoadedCounts((prev) => ({...prev, [id]: acc.length}));
            // Done when the server reports no more or returned a short final page.
            if (!res?.truncated || page.length < PAGE_SIZE) break;
          }
          return acc;
        } catch (e) {
          // Keep whatever pages already loaded so the user still sees partial data.
          if (acc.length === 0) samplesRef.current!.delete(id);
          setSampleErrors((prev) => ({...prev, [id]: (e as Error).message || 'Unknown error'}));
          if (acc.length === 0) throw e;
          return acc;
        } finally {
          inFlightRef.current!.delete(id);
          setLoadingSamples((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setLoadedCounts((prev) => {
            const next = {...prev};
            delete next[id];
            return next;
          });
        }
      })();
      inFlightRef.current!.set(id, run);
      return run;
    },
    [rpc],
  );

  // Fire-and-forget load for display; swallow the rejection (the error is
  // surfaced via sampleErrors / the retry button in the list).
  const fetchSamples = useCallback(
    (id: string) => {
      void loadAllSamples(id).catch(() => {});
    },
    [loadAllSamples],
  );

  const exportSession = useCallback(
    async (meta: SessionMeta) => {
      setExportError(null);
      setExporting((prev) => new Set(prev).add(meta.id));
      try {
        const samples = await loadAllSamples(meta.id);
        if (samples.length === 0) throw new Error('No samples to export');
        const zip = buildSessionZip(meta, datum, samples, ALL_METRICS, Math.floor(Date.now() / 1000));
        downloadBytes(`${sessionFileStem(meta)}.omheat.zip`, zip, 'application/zip');
      } catch (e) {
        setExportError((e as Error).message || 'Export failed');
      } finally {
        setExporting((prev) => {
          const next = new Set(prev);
          next.delete(meta.id);
          return next;
        });
      }
    },
    [loadAllSamples, datum],
  );

  const toggleSession = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        fetchSamples(id);
      }
      return next;
    });
  };

  // Fit map to the union of selected sessions.
  const fitToBounds = useCallback(() => {
    if (!mapRef.current) return;
    const utm = datumToRelative([datum.long, datum.lat]);
    const points: Feature<Point>[] = [];
    for (const id of selected) {
      const arr = samplesRef.current!.get(id);
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += Math.max(1, Math.floor(arr.length / 200))) {
        const [lng, lat] = pointToAbsolute({x: arr[i].x, y: arr[i].y}, utm);
        points.push(point([lng, lat]));
      }
    }
    if (points.length === 0) return;
    const fc = featureCollection(points);
    const [minX, minY, maxX, maxY] = bbox(fc);
    mapRef.current.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      {padding: 60, duration: 600},
    );
  }, [selected, datum]);

  // samplesVersion is included so the effect re-runs when fetchSamples
  // populates samplesRef asynchronously (the ref mutation alone is invisible
  // to React).
  useEffect(() => {
    fitToBounds();
  }, [fitToBounds, samplesVersion]);

  // Default the chart's session to the first selected one, and clear it when its
  // session is deselected.
  useEffect(() => {
    if (chartSessionId && !selected.has(chartSessionId)) {
      setChartSessionId(selected.size > 0 ? (selected.values().next().value ?? null) : null);
    } else if (!chartSessionId && selected.size > 0) {
      setChartSessionId(selected.values().next().value ?? null);
    }
  }, [selected, chartSessionId]);

  // Stable per-session hover handlers so the memoised HeatmapLayer doesn't see a
  // new onHover identity on every page render. Map → chart cursor is routed
  // through the rAF-coalesced scheduler.
  const hoverHandlersRef = useRef<Map<string, (idx: number | null) => void>>(new Map());
  const getHoverHandler = useCallback(
    (id: string) => {
      let h = hoverHandlersRef.current.get(id);
      if (!h) {
        h = (idx: number | null) => scheduleHover(idx, id);
        hoverHandlersRef.current.set(id, h);
      }
      return h;
    },
    [scheduleHover],
  );

  const toggleChartSignal = useCallback((key: string) => {
    setChartSignals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Samples feeding the chart (the chart session, falling back to nothing).
  // samplesVersion gates the memo so it refreshes as pages stream in.
  const chartSamples = useMemo<Sample[]>(() => {
    void samplesVersion;
    if (!chartSessionId) return [];
    return samplesRef.current!.get(chartSessionId) ?? [];
  }, [chartSessionId, samplesVersion]);

  // Pre-build the overlay element lists so a hover-only re-render doesn't
  // recreate them (and thus doesn't churn the memoised layer children). They
  // only change when the data, selection, metric or datum changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedIds = useMemo(() => Array.from(selected), [selected, samplesVersion]);

  const gridLayers = useMemo(() => {
    if (!showGrid) return null;
    return selectedIds.map((id) => {
      const arr = samplesRef.current!.get(id);
      if (!arr || arr.length === 0) return null;
      return (
        <HeatmapGridLayer
          key={`grid-${id}-${metric}`}
          id={`heatmap-grid-${id}`}
          samples={arr}
          metricId={metric}
          datum={datum}
          cellSize={GRID_CELL_SIZE_M}
          onHover={handleCellHover}
        />
      );
    });
  }, [showGrid, selectedIds, metric, datum, handleCellHover]);

  const pathLayers = useMemo(() => {
    if (!showPath) return null;
    return selectedIds.map((id) => {
      const arr = samplesRef.current!.get(id);
      if (!arr || arr.length === 0) return null;
      const segments = buildPathSegments(arr);
      return segments.map((seg, i) => (
        <PathLayer
          key={`path-${id}-${i}`}
          id={`heatmap-path-${id}-${i}`}
          paths={[seg.points]}
          datum={datum}
          color={seg.kind === 'paused' ? '#f59e0b' : '#2563eb'}
          width={2}
          opacity={0.9}
        />
      ));
    });
  }, [showPath, selectedIds, datum]);

  const pointLayers = useMemo(() => {
    if (!showPoints) return null;
    return selectedIds.map((id) => {
      const arr = samplesRef.current!.get(id);
      if (!arr || arr.length === 0) return null;
      return (
        <HeatmapLayer
          key={`${id}-${metric}`}
          id={`heatmap-${id}`}
          samples={arr}
          metricId={metric}
          datum={datum}
          onHover={getHoverHandler(id)}
        />
      );
    });
  }, [showPoints, selectedIds, metric, datum, getHoverHandler]);

  if (!hasCap) {
    return (
      <Page>
        <PageHeader title="Heatmap" subtitle="Replay mowing telemetry as colour-coded layers" />
        <PageContent>
          <Alert severity="info" sx={{mt: 2}}>
            Telemetry RPCs not available — backend may be outdated. Needs an <code>xbot_monitoring</code> build with{' '}
            <code>telemetry.list_sessions</code> / <code>telemetry.get_session</code>.
          </Alert>
        </PageContent>
      </Page>
    );
  }

  const def = METRICS[metric];
  const swatch = rampSwatch(def.ramp, def.goodGreen);

  const sessionsPanel = (
    <>
      <Box sx={{display: 'flex', alignItems: 'center', mb: 1}}>
        <Typography variant="subtitle1" fontWeight={600} sx={{flex: 1}}>
          Sessions
        </Typography>
        <IconButton size="small" onClick={refreshSessions} disabled={loadingSessions}>
          {loadingSessions ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </Box>
      {sessionsError && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{mb: 1}}
          action={
            <IconButton
              size="small"
              onClick={refreshSessions}
              disabled={loadingSessions}
              aria-label="Retry loading sessions"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          }
        >
          Could not load sessions: {sessionsError}
        </Alert>
      )}
      {exportError && (
        <Alert severity="error" variant="outlined" sx={{mb: 1}} onClose={() => setExportError(null)}>
          Export failed: {exportError}
        </Alert>
      )}
      {sessions === null && loadingSessions && (
        <Box sx={{display: 'flex', justifyContent: 'center', py: 3}}>
          <CircularProgress size={20} />
        </Box>
      )}
      {sessions && sessions.length === 0 && !sessionsError && (
        <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>
          No telemetry sessions recorded yet.
        </Typography>
      )}
      <List dense disablePadding sx={{maxHeight: {xs: 'unset', md: 'calc(100vh - 320px)'}, overflow: 'auto'}}>
        {sessions?.map((s) => {
          const err = sampleErrors[s.id];
          const loaded = loadedCounts[s.id];
          const isExporting = exporting.has(s.id);
          // While exporting (which may itself be paginating samples) show the
          // export spinner; otherwise the load spinner, retry, or the download
          // button that triggers the export.
          const secondary = isExporting ? (
            <Tooltip title="Exporting…" arrow>
              <CircularProgress size={14} />
            </Tooltip>
          ) : loadingSamples.has(s.id) ? (
            <Tooltip title={loaded ? `Loading… ${loaded}/${s.sample_count} pts` : 'Loading…'} arrow>
              <CircularProgress size={14} />
            </Tooltip>
          ) : err ? (
            <Tooltip title={`Failed to load: ${err}`} arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchSamples(s.id);
                }}
                aria-label="Retry loading session samples"
              >
                <RefreshIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Export session as .omheat.zip" arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  exportSession(s);
                }}
                aria-label="Export session"
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
          return (
            <ListItem key={s.id} disablePadding secondaryAction={secondary}>
              <ListItemButton dense onClick={() => toggleSession(s.id)}>
                <Checkbox edge="start" checked={selected.has(s.id)} tabIndex={-1} disableRipple size="small" />
                <ListItemText
                  primary={new Date(s.start_ts * 1000).toLocaleString()}
                  secondary={`${formatDuration(s.duration_s ?? s.end_ts - s.start_ts)} · ${s.sample_count} pts${s.manual ? ' · manual' : ''}`}
                  primaryTypographyProps={{variant: 'body2', noWrap: true}}
                  secondaryTypographyProps={{variant: 'caption'}}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );

  // Chart body shared by the desktop panel and the mobile dialog. Includes a
  // session picker when more than one session is selected.
  const selectedList = sessions?.filter((s) => selected.has(s.id)) ?? [];
  const chartBody = (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', gap: 1}}>
      {selectedList.length > 1 && (
        <Select
          size="small"
          value={chartSessionId ?? ''}
          onChange={(e) => setChartSessionId(e.target.value || null)}
          sx={{fontSize: '0.8rem', alignSelf: 'flex-start', minWidth: 220}}
        >
          {selectedList.map((s) => (
            <MenuItem key={s.id} value={s.id} sx={{fontSize: '0.8rem'}}>
              {new Date(s.start_ts * 1000).toLocaleString()}
            </MenuItem>
          ))}
        </Select>
      )}
      <Box sx={{flex: 1, minHeight: 0}}>
        <TimeSeriesChart
          ref={chartRef}
          samples={chartSamples}
          selectedSignals={chartSignals}
          onToggleSignal={toggleChartSignal}
          onCursor={(idx) => scheduleHover(idx, chartSessionId)}
          height={isMobile ? 320 : 260}
        />
      </Box>
    </Box>
  );

  return (
    <Page sx={{height: '100%'}}>
      <PageHeader title="Heatmap" subtitle="Replay mowing telemetry as colour-coded layers" />
      <PageContent sx={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: {xs: 'column', md: 'row'},
            gap: 2,
            mt: 2,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Sidebar — desktop only */}
          {!isMobile && (
            <Card sx={{flex: '0 0 280px', minWidth: 0}}>
              <CardContent sx={{pb: '8px !important'}}>{sessionsPanel}</CardContent>
            </Card>
          )}

          {/* Sessions dialog — mobile only */}
          {isMobile && (
            <Dialog
              open={sessionsOpen}
              onClose={() => setSessionsOpen(false)}
              fullWidth
              maxWidth="sm"
              slotProps={{paper: {sx: {maxHeight: '80vh'}}}}
            >
              <DialogTitle sx={{pb: 0}}>Sessions</DialogTitle>
              <DialogContent>{sessionsPanel}</DialogContent>
            </Dialog>
          )}

          {/* Main area — map + controls */}
          <Card
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardContent sx={{pb: 1}}>
              {isMobile ? (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      <Badge badgeContent={selected.size} color="primary" overlap="circular">
                        <ListAltIcon fontSize="small" />
                      </Badge>
                    }
                    onClick={() => setSessionsOpen(true)}
                    sx={{textTransform: 'none', flexShrink: 0}}
                  >
                    Sessions
                  </Button>
                  <Select
                    size="small"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as MetricId)}
                    sx={{flex: 1, minWidth: 0, fontSize: '0.85rem'}}
                  >
                    {ALL_METRICS.map((mid) => (
                      <MenuItem key={mid} value={mid} sx={{fontSize: '0.85rem'}}>
                        {METRICS[mid].label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              ) : (
                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
                  {ALL_METRICS.map((mid) => {
                    const m = METRICS[mid];
                    const active = mid === metric;
                    return (
                      <Tooltip key={mid} title={m.description} arrow>
                        <Button
                          size="small"
                          variant={active ? 'contained' : 'outlined'}
                          onClick={() => setMetric(mid)}
                          sx={{textTransform: 'none', fontSize: '0.78rem'}}
                        >
                          {m.label}
                        </Button>
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap'}}>
                <Typography variant="caption" color="text.secondary" sx={{mr: 0.5}}>
                  Layers
                </Typography>
                <ToggleButtonGroup size="small">
                  <ToggleButton
                    value="grid"
                    selected={showGrid}
                    onClick={() => setShowGrid(!showGrid)}
                    sx={{textTransform: 'none', fontSize: '0.72rem', py: 0.25}}
                  >
                    Heatmap
                  </ToggleButton>
                  <ToggleButton
                    value="points"
                    selected={showPoints}
                    onClick={() => setShowPoints(!showPoints)}
                    sx={{textTransform: 'none', fontSize: '0.72rem', py: 0.25}}
                  >
                    Points
                  </ToggleButton>
                  <ToggleButton
                    value="path"
                    selected={showPath}
                    onClick={() => setShowPath(!showPath)}
                    sx={{textTransform: 'none', fontSize: '0.72rem', py: 0.25}}
                  >
                    Path
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button
                  size="small"
                  variant={chartOpen ? 'contained' : 'outlined'}
                  startIcon={<ShowChartIcon fontSize="small" />}
                  disabled={selected.size === 0}
                  onClick={() => setChartOpen((o) => !o)}
                  sx={{textTransform: 'none', fontSize: '0.72rem', py: 0.25, ml: 0.5}}
                >
                  Chart
                </Button>
              </Box>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap'}}>
                <Typography variant="caption" color="text.secondary">
                  Low
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    height: 12,
                    flex: {xs: '1 1 120px', md: '0 0 200px'},
                    minWidth: 0,
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  {swatch.map((c, i) => (
                    <Box key={i} sx={{flex: 1, bgcolor: c}} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  High
                </Typography>
                {!isMobile && (
                  <Typography variant="caption" color="text.secondary" sx={{ml: 1, fontStyle: 'italic'}}>
                    {def.description}
                  </Typography>
                )}
              </Box>
            </CardContent>
            <Divider />
            <Box sx={{flex: 1, position: 'relative'}}>
              <RMap
                ref={mapRef}
                style={{width: '100%', height: '100%'}}
                mapStyle={mapStyles[hasRealDatum ? mapStyle : 'plain']}
                initialAttributionControl={false}
                maxZoom={25}
                initialPitchWithRotate={false}
                dragRotate={false}
                onLoad={(e) => {
                  e.target.touchZoomRotate.disableRotation();
                  // Expose the map instance so the imperative HoverMarker can
                  // attach a DOM marker to it.
                  setMapInstance(e.target);
                  // Drop focus from MapLibre's fullscreen ctrl button when the
                  // container resizes — otherwise the focused button stays
                  // inside an aria-hidden ancestor while MUI/MapLibre swap
                  // wrapper attrs, which logs the WAI-ARIA violation seen in
                  // dev tools.
                  e.target.on('resize', () => {
                    const active = document.activeElement;
                    if (active instanceof HTMLElement && active.classList.contains('maplibregl-ctrl-shrink')) {
                      active.blur();
                    }
                  });
                }}
              >
                <RFullscreenControl />
                <ControlButton position="top-right" icon={FocusIcon} title="Fit to bounds" onClick={fitToBounds} />
                <MapStyleSelector />
                {/* Overlays stack bottom→top: grid fill, then the driven path,
                    then points (kept topmost so per-sample hover wins). Built in
                    memoised lists so hover-only re-renders don't recreate them. */}
                {gridLayers}
                {pathLayers}
                {pointLayers}
              </RMap>
              {/* Imperative DOM marker for the hover highlight — moves via a CSS
                  transform with no GL repaint. */}
              <HoverMarker ref={markerRef} map={mapInstance} />
              {/* Isolated tooltip overlay — owns its own state so a hover only
                  re-renders this small component, not the whole page. */}
              <HoverInfo
                ref={infoRef}
                isMobile={isMobile}
                metricLabel={def.label}
                cellSizeM={GRID_CELL_SIZE_M}
              />
              {selected.size === 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    px: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{bgcolor: theme.palette.background.paper, px: 2, py: 1, borderRadius: 1, textAlign: 'center'}}
                  >
                    {isMobile
                      ? 'Tap “Sessions” to pick one or more.'
                      : 'Pick one or more sessions to render their heatmap.'}
                  </Typography>
                </Box>
              )}
            </Box>
            {/* Desktop: collapsible chart panel below the map, inside the card. */}
            {!isMobile && chartOpen && selected.size > 0 && (
              <>
                <Divider />
                <Box sx={{p: 1.5, height: 320, flexShrink: 0}}>{chartBody}</Box>
              </>
            )}
          </Card>
        </Box>
      </PageContent>

      {/* Mobile: chart in a fullscreen dialog. */}
      {isMobile && (
        <Dialog open={chartOpen} onClose={() => setChartOpen(false)} fullScreen>
          <DialogTitle sx={{display: 'flex', alignItems: 'center', gap: 1, pr: 1}}>
            <Box sx={{flex: 1, minWidth: 0}}>
              <Typography variant="h6" component="div" noWrap>
                Signals
              </Typography>
            </Box>
            <IconButton onClick={() => setChartOpen(false)} aria-label="close" edge="end">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, pb: 2}}>
            {chartBody}
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
