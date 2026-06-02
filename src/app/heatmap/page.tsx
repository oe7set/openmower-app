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
import {useUiStore} from '@/stores/uiStore';
import HeatmapLayer from './HeatmapLayer';
import {METRICS, type MetricId, type Sample} from './metrics';
import {rampSwatch} from './colors';

interface SessionMeta {
  id: string;
  start_ts: number;
  end_ts: number;
  sample_count: number;
  file_size_bytes?: number;
  duration_s?: number;
}

const ALL_METRICS: MetricId[] = ['gps', 'wifi', 'imu', 'mow_current', 'mow_temp', 'esc_temp', 'battery', 'composite'];

// Target sample count per session after decimation. A heatmap stays visually
// faithful at a few thousand points, while the payload (~15 numeric fields per
// sample) stays well under ~0.5 MB — small enough to come back over MQTT inside
// the request timeout even for multi-hour mows. The per-session stride is
// derived from this and the recorded sample_count so a 30 min mow keeps full
// resolution while a 3 h mow is decimated rather than timing out.
const TARGET_POINTS = 4000;

// get_session for a large session can take noticeably longer than the default
// client timeout: the backend streams the whole JSONL file before decimating
// and the payload is still hundreds of KB. Give it a generous ceiling.
const SESSION_FETCH_TIMEOUT_MS = 60_000;

// Pick a decimation stride that brings sample_count down to ~TARGET_POINTS.
function strideFor(sampleCount: number | undefined): number {
  if (!sampleCount || sampleCount <= TARGET_POINTS) return 1;
  return Math.ceil(sampleCount / TARGET_POINTS);
}

export default function HeatmapPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const rpc = useSelectedMower((s) => s?.rpc);
  const {datum, hasReal: hasRealDatum} = useEffectiveDatum();
  const mapStyle = useUiStore((s) => s.mapStyle);
  const hasCap = useSelectedMower((s) => s?.hasCapability('telemetry.list_sessions') ?? false);

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
  const [sampleErrors, setSampleErrors] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<MetricId>('gps');
  const [hoverIdxBySession, setHoverIdxBySession] = useState<Record<string, number | null>>({});
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
    async (id: string, sampleCount?: number) => {
      if (!rpc) return;
      if (samplesRef.current!.has(id)) return;
      setLoadingSamples((prev) => new Set(prev).add(id));
      setSampleErrors((prev) => {
        if (!(id in prev)) return prev;
        const next = {...prev};
        delete next[id];
        return next;
      });
      try {
        // Decimate large sessions so the payload stays small and the call
        // returns within the timeout; small sessions are sent in full.
        const stride = strideFor(sampleCount);
        const res = (await rpc.telemetry.get_session({id, stride}, SESSION_FETCH_TIMEOUT_MS)) as unknown as {
          samples?: Sample[];
        };
        samplesRef.current!.set(id, res?.samples ?? []);
        setSamplesVersion((v) => v + 1);
      } catch (e) {
        setSampleErrors((prev) => ({...prev, [id]: (e as Error).message || 'Unknown error'}));
      } finally {
        setLoadingSamples((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [rpc],
  );

  const toggleSession = (id: string, sampleCount?: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        fetchSamples(id, sampleCount);
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
          const secondary = loadingSamples.has(s.id) ? (
            <CircularProgress size={14} />
          ) : err ? (
            <Tooltip title={`Failed to load: ${err}`} arrow>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchSamples(s.id, s.sample_count);
                }}
                aria-label="Retry loading session samples"
              >
                <RefreshIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          ) : null;
          return (
            <ListItem key={s.id} disablePadding secondaryAction={secondary}>
              <ListItemButton dense onClick={() => toggleSession(s.id, s.sample_count)}>
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
                {Array.from(selected).map((id) => {
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
              {/* Tooltip — first hovered session wins. On mobile it sits at the
                  bottom so it doesn't collide with the map controls (top-right). */}
              {Object.entries(hoverIdxBySession).map(([id, idx]) => {
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
                    {s.gps_fix_type !== undefined && (
                      <div>
                        GPS fix: {s.gps_fix_type} · sats {s.gps_satellite_count ?? '—'} · PDOP{' '}
                        {s.gps_pdop?.toFixed(2) ?? '—'}
                      </div>
                    )}
                    {(s.wifi_dbm !== undefined || s.wifi_q !== undefined) && (
                      <div>
                        WLAN: {s.wifi_dbm ?? '—'}dBm ({((s.wifi_q ?? 0) * 100).toFixed(0)}%)
                      </div>
                    )}
                    {s.om_mow_motor_current !== undefined && (
                      <div>Mow current: {s.om_mow_motor_current.toFixed(2)}A</div>
                    )}
                    {s.om_mow_motor_temp !== undefined && <div>Mow temp: {s.om_mow_motor_temp.toFixed(1)}°C</div>}
                    {(s.om_left_esc_temp !== undefined || s.om_right_esc_temp !== undefined) && (
                      <div>
                        ESC: L {s.om_left_esc_temp?.toFixed(1) ?? '—'}°C · R {s.om_right_esc_temp?.toFixed(1) ?? '—'}°C
                      </div>
                    )}
                    {s.om_v_battery !== undefined && <div>Battery: {s.om_v_battery.toFixed(2)}V</div>}
                  </Box>
                );
              })}
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

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
