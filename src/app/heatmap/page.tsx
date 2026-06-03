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
import {Refresh as RefreshIcon, ListAlt as ListAltIcon} from '@mui/icons-material';
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
import {useCallback, useEffect, useRef, useState} from 'react';
import {FocusIcon} from 'lucide-react';
import {datumToRelative, pointToAbsolute} from '@/utils/coordinates';
import ControlButton from '@/components/map/ControlButton';
import MapStyleSelector from '@/components/map/MapStyleSelector';
import {mapStyles} from '@/components/map/mapStyles';
import PathLayer from '@/components/map/layers/PathLayer';
import {useUiStore} from '@/stores/uiStore';
import HeatmapLayer from './HeatmapLayer';
import HeatmapGridLayer, {type GridCellInfo} from './HeatmapGridLayer';
import {METRICS, sampleState, type MetricId, type Sample} from './metrics';
import {rampSwatch} from './colors';
import {buildPathSegments} from './path';

interface SessionMeta {
  id: string;
  start_ts: number;
  end_ts: number;
  sample_count: number;
  file_size_bytes?: number;
  duration_s?: number;
}

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
  'mow_temp',
  'esc_temp',
  'battery',
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
  // Bump on every successful fetchSamples so the fit-bounds effect re-runs
  // even though samplesRef itself is mutated in place.
  const [samplesVersion, setSamplesVersion] = useState(0);
  const [loadingSamples, setLoadingSamples] = useState<Set<string>>(new Set());
  // Points loaded so far per still-loading session, for the progress readout.
  const [loadedCounts, setLoadedCounts] = useState<Record<string, number>>({});
  const [sampleErrors, setSampleErrors] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<MetricId>('gps');
  const [hoverIdxBySession, setHoverIdxBySession] = useState<Record<string, number | null>>({});
  // Hovered grid cell (grid overlay only); shows aggregate stats instead of a
  // single sample.
  const [hoverCell, setHoverCell] = useState<GridCellInfo | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const mapRef = useRef<MlMap>(null);

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

  const fetchSamples = useCallback(
    async (id: string) => {
      if (!rpc) return;
      if (samplesRef.current!.has(id)) return;
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
      } catch (e) {
        // Keep whatever pages already loaded so the user still sees partial data.
        if (acc.length === 0) samplesRef.current!.delete(id);
        setSampleErrors((prev) => ({...prev, [id]: (e as Error).message || 'Unknown error'}));
      } finally {
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
    },
    [rpc],
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
          const secondary = loadingSamples.has(s.id) ? (
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
          ) : null;
          return (
            <ListItem key={s.id} disablePadding secondaryAction={secondary}>
              <ListItemButton dense onClick={() => toggleSession(s.id)}>
                <Checkbox edge="start" checked={selected.has(s.id)} tabIndex={-1} disableRipple size="small" />
                <ListItemText
                  primary={new Date(s.start_ts * 1000).toLocaleString()}
                  secondary={`${formatDuration(s.duration_s ?? s.end_ts - s.start_ts)} · ${s.sample_count} pts`}
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
                    then points (kept topmost so per-sample hover wins). */}
                {showGrid &&
                  Array.from(selected).map((id) => {
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
                        onHover={setHoverCell}
                      />
                    );
                  })}
                {showPath &&
                  Array.from(selected).map((id) => {
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
                  })}
                {showPoints &&
                  Array.from(selected).map((id) => {
                    const arr = samplesRef.current!.get(id);
                    if (!arr || arr.length === 0) return null;
                    return (
                      <HeatmapLayer
                        key={`${id}-${metric}`}
                        id={`heatmap-${id}`}
                        samples={arr}
                        metricId={metric}
                        datum={datum}
                        onHover={(idx) => setHoverIdxBySession((prev) => ({...prev, [id]: idx}))}
                      />
                    );
                  })}
              </RMap>
              {/* Per-sample tooltip (points overlay) — first hovered session
                  wins. On mobile it sits at the bottom so it doesn't collide
                  with the map controls (top-right). */}
              {showPoints &&
                Object.entries(hoverIdxBySession).map(([id, idx]) => {
                  if (idx === null || idx === undefined) return null;
                  const arr = samplesRef.current!.get(id);
                  const s = arr?.[idx];
                  if (!s) return null;
                  return (
                    <Box
                      key={id}
                      sx={{
                        position: 'absolute',
                        ...(isMobile
                          ? {bottom: 12, left: 12, right: 12, maxWidth: 'unset'}
                          : {top: 12, right: 12, maxWidth: 280}),
                        bgcolor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        px: 1.5,
                        py: 1,
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-dm-mono), monospace',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }}
                    >
                      <div>{new Date(s.ts * 1000).toLocaleTimeString()}</div>
                      <div style={{opacity: 0.7}}>
                        x={s.x.toFixed(2)}, y={s.y.toFixed(2)}
                      </div>
                      {sampleState(s) !== undefined && <div>State: {sampleState(s)}</div>}
                      {s.gps_fix_type !== undefined && (
                        <div>
                          GPS fix: {s.gps_fix_type} · sats {s.gps_satellite_count ?? '—'} · PDOP{' '}
                          {s.gps_pdop?.toFixed(2) ?? '—'}
                        </div>
                      )}
                      {s.gps_accuracy !== undefined && <div>GPS acc: ±{s.gps_accuracy.toFixed(2)}m</div>}
                      {(s.wifi_dbm !== undefined || s.wifi_q !== undefined) && (
                        <div>
                          WLAN: {s.wifi_dbm ?? '—'}dBm ({((s.wifi_q ?? 0) * 100).toFixed(0)}%)
                        </div>
                      )}
                      {(s.qw !== undefined || s.pitch !== undefined) && (
                        <div>
                          Orient: roll {radToDeg(s.roll)}° · pitch {radToDeg(s.pitch)}° · yaw {radToDeg(s.yaw)}°
                        </div>
                      )}
                      {s.om_mow_motor_current !== undefined && (
                        <div>Mow current: {s.om_mow_motor_current.toFixed(2)}A</div>
                      )}
                      {s.om_mow_motor_temp !== undefined && <div>Mow temp: {s.om_mow_motor_temp.toFixed(1)}°C</div>}
                      {(s.om_left_esc_temp !== undefined || s.om_right_esc_temp !== undefined) && (
                        <div>
                          ESC: L {s.om_left_esc_temp?.toFixed(1) ?? '—'}°C · R {s.om_right_esc_temp?.toFixed(1) ?? '—'}
                          °C
                        </div>
                      )}
                      {s.om_v_battery !== undefined && <div>Battery: {s.om_v_battery.toFixed(2)}V</div>}
                    </Box>
                  );
                })}
              {/* Grid-cell tooltip (grid overlay): aggregate stats for the
                  hovered cell rather than a single sample. */}
              {showGrid && hoverCell && (
                <Box
                  sx={{
                    position: 'absolute',
                    ...(isMobile
                      ? {bottom: 12, left: 12, right: 12, maxWidth: 'unset'}
                      : {top: 12, right: 12, maxWidth: 280}),
                    bgcolor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                >
                  <div>{def.label}</div>
                  <div style={{opacity: 0.7}}>
                    Ø {hoverCell.mean.toFixed(2)} · {hoverCell.count} pts / {GRID_CELL_SIZE_M}m cell
                  </div>
                </Box>
              )}
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
          </Card>
        </Box>
      </PageContent>
    </Page>
  );
}

// Radians → whole degrees for the orientation tooltip; em-dash when absent.
function radToDeg(rad: number | undefined): string {
  if (rad === undefined || !Number.isFinite(rad)) return '—';
  return Math.round((rad * 180) / Math.PI).toString();
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
