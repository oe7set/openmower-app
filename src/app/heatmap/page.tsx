'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useSelectedMower} from '@/stores/mowersStore';
import {fallbackDatum, type MapData} from '@/stores/schemas';
import bbox from '@turf/bbox';
import {featureCollection, point} from '@turf/helpers';
import type {Feature, Point} from 'geojson';
import type {Map as MlMap} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RFullscreenControl, RMap} from 'maplibre-react-components';
import {Refresh as RefreshIcon} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';
import {datumToRelative, pointToAbsolute} from '@/utils/coordinates';
import {mapStyles} from '@/components/map/mapStyles';
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

const ALL_METRICS: MetricId[] = [
  'gps',
  'wifi',
  'imu',
  'mow_current',
  'mow_temp',
  'esc_temp',
  'battery',
  'composite',
];

const INITIAL_STRIDE = 4;

export default function HeatmapPage() {
  const theme = useTheme();
  const rpc = useSelectedMower((s) => s?.rpc);
  const datum: MapData['datum'] = useSelectedMower((s) => s?.map.datum);
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
      setSampleErrors((prev) => {
        if (!(id in prev)) return prev;
        const next = {...prev};
        delete next[id];
        return next;
      });
      try {
        const res = (await rpc.telemetry.get_session({id, stride: INITIAL_STRIDE})) as unknown as {
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

  // Fit map to the union of selected sessions. samplesVersion is included so
  // the effect re-runs when fetchSamples populates samplesRef asynchronously
  // (the ref mutation alone is invisible to React).
  useEffect(() => {
    if (!mapRef.current) return;
    const datumRef = datum ?? fallbackDatum;
    const utm = datumToRelative([datumRef.long, datumRef.lat]);
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
  }, [selected, datum, samplesVersion]);

  if (!hasCap) {
    return (
      <Page>
        <PageHeader title="Heatmap" subtitle="Replay mowing telemetry as colour-coded layers" />
        <PageContent>
          <Alert severity="info" sx={{mt: 2}}>
            Telemetry RPCs not available — backend may be outdated. Needs an{' '}
            <code>xbot_monitoring</code> build with <code>telemetry.list_sessions</code> /{' '}
            <code>telemetry.get_session</code>.
          </Alert>
        </PageContent>
      </Page>
    );
  }

  const def = METRICS[metric];
  const swatch = rampSwatch(def.ramp, def.goodGreen);

  return (
    <Page>
      <PageHeader title="Heatmap" subtitle="Replay mowing telemetry as colour-coded layers" />
      <PageContent>
        <Box sx={{display: 'flex', flexDirection: {xs: 'column', md: 'row'}, gap: 2, mt: 2}}>
          {/* Sidebar — sessions list */}
          <Card sx={{flex: '0 0 280px', minWidth: 0}}>
            <CardContent sx={{pb: '8px !important'}}>
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
              <List dense disablePadding sx={{maxHeight: 'calc(100vh - 320px)', overflow: 'auto'}}>
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
            </CardContent>
          </Card>

          {/* Main area — map + controls */}
          <Card sx={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 280px)'}}>
            <CardContent sx={{pb: 1}}>
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
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap'}}>
                <Typography variant="caption" color="text.secondary">
                  Low
                </Typography>
                <Box sx={{display: 'flex', height: 12, flex: '0 0 200px', borderRadius: 1, overflow: 'hidden'}}>
                  {swatch.map((c, i) => (
                    <Box key={i} sx={{flex: 1, bgcolor: c}} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  High
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ml: 1, fontStyle: 'italic'}}>
                  {def.description}
                </Typography>
              </Box>
            </CardContent>
            <Divider />
            <Box sx={{flex: 1, position: 'relative'}}>
              <RMap
                ref={mapRef}
                style={{width: '100%', height: '100%'}}
                mapStyle={mapStyles[datum ? 'satellite' : 'white']}
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
                      onHover={(idx) =>
                        setHoverIdxBySession((prev) => ({...prev, [id]: idx}))
                      }
                    />
                  );
                })}
              </RMap>
              {/* Tooltip — first hovered session wins. */}
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
                      top: 12,
                      right: 12,
                      bgcolor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      px: 1.5,
                      py: 1,
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-dm-mono), monospace',
                      pointerEvents: 'none',
                      zIndex: 5,
                      maxWidth: 280,
                    }}
                  >
                    <div>{new Date(s.ts * 1000).toLocaleTimeString()}</div>
                    <div style={{opacity: 0.7}}>x={s.x.toFixed(2)}, y={s.y.toFixed(2)}</div>
                    {s.gps_fix_type !== undefined && (
                      <div>GPS fix: {s.gps_fix_type} · sats {s.gps_satellite_count ?? '—'} · PDOP {s.gps_pdop?.toFixed(2) ?? '—'}</div>
                    )}
                    {(s.wifi_dbm !== undefined || s.wifi_q !== undefined) && (
                      <div>WLAN: {s.wifi_dbm ?? '—'}dBm ({((s.wifi_q ?? 0) * 100).toFixed(0)}%)</div>
                    )}
                    {s.om_mow_motor_current !== undefined && <div>Mow current: {s.om_mow_motor_current.toFixed(2)}A</div>}
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
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{bgcolor: theme.palette.background.paper, px: 2, py: 1, borderRadius: 1}}>
                    Pick one or more sessions to render their heatmap.
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
