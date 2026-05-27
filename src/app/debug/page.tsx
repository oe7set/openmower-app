'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {outerCardStyles} from '@/lib/cardStyles';
import type {OpenMowerRpc} from '@/lib/rpc';
import type {ExpectedTopic, MqttStatus} from '@/stores/mowersStore';
import {EXPECTED_TOPICS, useMowers, useMowersStore} from '@/stores/mowersStore';
import type {Action, Capabilities, MapData, MapOverlay, VersionInfo} from '@/stores/schemas';
import {
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Link as LinkIcon,
  Layers as LayersIcon,
  PlayArrow as PlayArrowIcon,
  Map as MapIcon,
  NetworkCheck as NetworkCheckIcon,
  Refresh as RefreshIcon,
  Sensors as TopicsIcon,
  TouchApp as TouchAppIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  WifiOff as WifiOffIcon,
} from '@mui/icons-material';
import {Box, Card, CardContent, Chip, CircularProgress, Divider, IconButton, Tooltip, Typography, useTheme} from '@mui/material';
import React, {useEffect, useRef, useState} from 'react';
import SystemActionsSection from './SystemActionsSection';
import SystemStatsSection from './SystemStatsSection';

type PingState = {latency: number | null; error: string | null; loading: boolean};

function SplitBadge({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        fontSize: '0.75rem',
      }}
    >
      <Box sx={{px: 1, py: 0.25, bgcolor: 'action.hover', fontFamily: 'monospace'}}>{label}</Box>
      <Box
        sx={{
          px: 1,
          py: 0.25,
          bgcolor: 'text.primary',
          color: 'background.default',
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

function mqttStatusChip(status: MqttStatus) {
  switch (status) {
    case 'connected':
      return <Chip icon={<CheckCircleIcon />} label="Connected" color="success" size="small" />;
    case 'reconnecting':
      return <Chip icon={<RefreshIcon />} label="Reconnecting" color="warning" size="small" />;
    case 'connecting':
      return <Chip icon={<RefreshIcon />} label="Connecting" color="info" size="small" />;
    case 'offline':
      return <Chip icon={<WifiOffIcon />} label="Offline" color="error" size="small" />;
    case 'disconnected':
      return <Chip icon={<ErrorIcon />} label="Disconnected" color="error" size="small" />;
  }
}

function maskPassword(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.password) {
      const decoded = decodeURIComponent(u.password);
      return rawUrl.replace(`:${decoded}@`, `:${'*'.repeat(decoded.length)}@`);
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function MqttSection({mqttUrl, mqttPrefix, mqttStatus}: {mqttUrl: string; mqttPrefix: string; mqttStatus: MqttStatus}) {
  const [showPassword, setShowPassword] = useState(false);
  const displayUrl = showPassword ? mqttUrl : maskPassword(mqttUrl);
  const hasPassword = (() => {
    try {
      return !!new URL(mqttUrl).password;
    } catch {
      return false;
    }
  })();

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <LinkIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          MQTT
        </Typography>
        {mqttStatusChip(mqttStatus)}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 2,
          rowGap: 0.5,
          alignItems: 'baseline',
        }}
      >
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          URL
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all'}}>
          {displayUrl}
          {hasPassword && (
            <Tooltip title={showPassword ? 'Hide password' : 'Show password'}>
              <IconButton size="small" onClick={() => setShowPassword((v) => !v)} sx={{ml: 0.5}}>
                {showPassword ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}
              </IconButton>
            </Tooltip>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Prefix
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'monospace', fontSize: '0.8rem'}}>
          {mqttPrefix || (
            <Typography component="span" color="text.disabled" fontSize="inherit">
              (none)
            </Typography>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

// Frontend version is read at build time via the standard Next.js env var
// (set automatically from package.json by Next; falls back to 'dev' locally).
const FRONTEND_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';

function MissingValue({tooltip, label}: {tooltip: string; label: string}) {
  return (
    <Tooltip title={tooltip} arrow>
      <Typography
        component="span"
        color="text.disabled"
        fontSize="inherit"
        sx={{textDecoration: 'underline dotted', cursor: 'help'}}
      >
        {label}
      </Typography>
    </Tooltip>
  );
}

function VersionSection({backend}: {backend: VersionInfo | null}) {
  const firmware = backend?.firmware;
  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <InfoIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          Versions
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 2,
          rowGap: 0.5,
          alignItems: 'baseline',
        }}
      >
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Backend
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.8rem'}}>
          {backend ? (
            backend.version
          ) : (
            <MissingValue
              tooltip="The mower's xbot_monitoring should publish version/json with retain=true. If you only see this after a backend restart, the publish is likely not retained."
              label="not received yet"
            />
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Frontend
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.8rem'}}>
          {FRONTEND_VERSION}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Firmware Git
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.8rem'}}>
          {firmware ? (
            firmware.git_hash
          ) : (
            <MissingValue
              tooltip="The mainboard firmware (HighLevelService) reports its build identifiers once it is claimed by mower_comms_v2. Empty here means: V1 hardware, mainboard offline, or firmware older than the version that started reporting this."
              label="not available"
            />
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Firmware Built
        </Typography>
        <Typography variant="body2" sx={{fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.8rem'}}>
          {firmware ? (
            firmware.build_date
          ) : (
            <MissingValue
              tooltip="The mainboard firmware (HighLevelService) reports its build identifiers once it is claimed by mower_comms_v2. Empty here means: V1 hardware, mainboard offline, or firmware older than the version that started reporting this."
              label="not available"
            />
          )}
        </Typography>
      </Box>
    </Box>
  );
}

function PingRow({label, onPing}: {label: string; onPing: () => Promise<unknown>}) {
  const [ping, setPing] = useState<PingState>({latency: null, error: null, loading: true});
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortedRef = useRef(false);

  const runPing = async () => {
    abortedRef.current = false;
    const timer = setTimeout(() => {
      if (!abortedRef.current) setPing({latency: null, error: null, loading: true});
    }, 200);
    loadingTimerRef.current = timer;
    const start = performance.now();
    try {
      await onPing();
      clearTimeout(timer);
      if (!abortedRef.current) {
        const latency = Math.round(performance.now() - start);
        setPing({latency, error: null, loading: false});
      }
    } catch (e) {
      clearTimeout(timer);
      if (!abortedRef.current) {
        setPing({latency: null, error: e instanceof Error ? e.message : 'Timeout', loading: false});
      }
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => runPing(), 1000);
    return () => {
      abortedRef.current = true;
      clearTimeout(delay);
      clearTimeout(loadingTimerRef.current!);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
      <Chip
        label={label}
        onClick={runPing}
        disabled={ping.loading}
        icon={ping.loading ? <CircularProgress size={14} /> : <NetworkCheckIcon />}
        variant="outlined"
        size="small"
        sx={{cursor: 'pointer'}}
      />
      {ping.loading && (
        <Typography variant="body2" color="text.secondary">
          Waiting…
        </Typography>
      )}

      {!ping.loading && ping.latency !== null && <Chip label={`${ping.latency} ms`} color="success" size="small" />}
      {!ping.loading && ping.error !== null && <Chip label={ping.error} color="error" size="small" />}
    </Box>
  );
}

function RpcSection({rpc}: {rpc: OpenMowerRpc}) {
  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <PlayArrowIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          RPC
        </Typography>
      </Box>
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
        <PingRow label="Ping" onPing={() => rpc.rpc.ping()} />
        {process.env.NEXT_PUBLIC_IS_DEV && <PingRow label="Meta Ping" onPing={() => rpc.meta.rpc.ping()} />}
      </Box>
    </Box>
  );
}

function CapabilitiesSection({capabilities}: {capabilities: Capabilities}) {
  const entries = Object.entries(capabilities);
  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <CheckCircleIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          Capabilities
        </Typography>
      </Box>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No capabilities received yet
        </Typography>
      ) : (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
          {entries.map(([key, level]) => (
            <SplitBadge key={key} label={key} value={level} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function ActionsSection({actions}: {actions: Action[]}) {
  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <TouchAppIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          Actions
        </Typography>
        <Chip label={actions.length} size="small" />
      </Box>
      {actions.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No actions registered
        </Typography>
      ) : (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
          {actions.map((a) => (
            <Chip
              key={a.action_id}
              label={a.action_name || a.action_id}
              size="small"
              color={a.enabled ? 'success' : 'default'}
              variant={a.enabled ? 'filled' : 'outlined'}
              sx={{fontFamily: 'monospace', fontSize: '0.75rem'}}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function OverlaySection({overlay}: {overlay: MapOverlay}) {
  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <LayersIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          Map overlay
        </Typography>
        <Chip label={`${overlay.polygons.length} polygon${overlay.polygons.length === 1 ? '' : 's'}`} size="small" />
      </Box>
      {overlay.polygons.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No transient overlays published
        </Typography>
      ) : (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
          {overlay.polygons.map((p, i) => (
            <SplitBadge
              key={i}
              label={`#${i}`}
              value={`${p.poly.length}pt ${p.is_closed ? 'closed' : 'open'} c${p.color}`}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function MapSection({map}: {map: MapData}) {
  const hasMap = map.areas.length > 0 || map.docking_stations.length > 0;
  const countsByType = map.areas.reduce<Record<string, number>>((acc, a) => {
    const t = a.properties.type;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <MapIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          Map
        </Typography>
        {hasMap ? (
          <Chip label="Loaded" color="success" size="small" />
        ) : (
          <Chip label="Not loaded" color="default" size="small" />
        )}
      </Box>
      <Box
        sx={{display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 2, rowGap: 0.5, alignItems: 'center'}}
      >
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Datum
        </Typography>
        <Typography variant="body2">
          {map.datum ? (
            <a
              href={`https://www.google.com/maps?q=${map.datum.lat},${map.datum.long}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{fontFamily: 'monospace', fontSize: '0.8rem'}}
            >
              {map.datum.lat.toFixed(6)}, {map.datum.long.toFixed(6)}
            </a>
          ) : (
            <Typography component="span" variant="body2" color="text.disabled">
              Not set
            </Typography>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Areas
        </Typography>
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75}}>
          {Object.keys(countsByType).length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              None
            </Typography>
          ) : (
            Object.entries(countsByType).map(([type, count]) => <SplitBadge key={type} label={type} value={count} />)
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Docking stations
        </Typography>
        <Typography variant="body2">{map.docking_stations.length}</Typography>
      </Box>
    </Box>
  );
}

// Per-mower topic liveness table. Reads `lastSeen` directly so we don't need a
// new selector — re-renders whenever the store ticks (every 2s) or a topic
// arrives. Crucial for the "is the mower silent?" question that drives users
// to /debug in the first place.
function TopicsSection({mowerId, lastSeen}: {mowerId: string; lastSeen: Record<string, number>}) {
  // Force the row's "age" cell to refresh on every store tick even when a
  // topic hasn't arrived since the last render — otherwise stale ages would
  // freeze. Cheap because we only read a number.
  useMowersStore((s) => s.lastSeenTick);
  const theme = useTheme();
  // Heartbeat clock: refreshing `now` from a 1 s interval keeps the displayed
  // ages monotonic without calling Date.now() during render (which the React
  // 19 purity rule rightly flags as unstable).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);
  const rows: {topic: ExpectedTopic; live: boolean; lastMs?: number}[] = EXPECTED_TOPICS.map((spec) => ({
    topic: spec.topic,
    live: spec.live,
    lastMs: lastSeen[spec.topic],
  }));

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <TopicsIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          Topics
        </Typography>
        <Chip
          label={`${rows.filter((r) => r.lastMs !== undefined).length}/${rows.length}`}
          size="small"
          color={rows.every((r) => r.lastMs !== undefined) ? 'success' : 'warning'}
        />
      </Box>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          '& th, & td': {
            textAlign: 'left',
            py: 0.75,
            pr: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            fontSize: '0.85rem',
          },
          '& th': {color: 'text.secondary', fontSize: '0.7rem', textTransform: 'uppercase'},
          '& td.topic': {fontFamily: 'var(--font-dm-mono), monospace'},
        }}
      >
        <thead>
          <tr>
            <th>Topic</th>
            <th style={{width: 100}}>Status</th>
            <th style={{width: 120}}>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({topic, live, lastMs}) => {
            const ageMs = lastMs !== undefined ? now - lastMs : undefined;
            // Retained topics never go "stale" — once received they count as
            // live indefinitely until the next publish.
            const status =
              ageMs === undefined ? 'never' : live && ageMs > 10_000 ? 'stale' : 'live';
            const color: 'default' | 'success' | 'warning' | 'error' =
              status === 'live' ? 'success' : status === 'stale' ? 'warning' : 'error';
            return (
              <tr key={`${mowerId}-${topic}`}>
                <td className="topic">{topic}{!live && <span style={{opacity: 0.5, marginLeft: 6, fontSize: '0.7rem'}}>(retained)</span>}</td>
                <td>
                  <Chip label={status} size="small" color={color} sx={{fontWeight: 600}} />
                </td>
                <td>{ageMs === undefined ? '—' : ageMs < 1000 ? 'just now' : `${Math.round(ageMs / 1000)}s ago`}</td>
              </tr>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
}

export default function DebugPage() {
  const theme = useTheme();
  const mowers = useMowers();
  const mqttStatuses = useMowersStore((s) => s.mqttStatuses);
  // Subscribe to the global tick so the TopicsSection rows refresh ages.
  useMowersStore((s) => s.lastSeenTick);
  const connectedCount = mowers.filter((m) => mqttStatuses[m.id] === 'connected').length;

  return (
    <Page>
      <PageHeader title="Diagnostics" subtitle="Connection health and per-topic liveness for all configured mowers">
        <HeaderStat icon={<BugReportIcon />} value={mowers.length} label="Mowers configured" />
        <HeaderStat icon={<CheckCircleIcon />} value={connectedCount} label="MQTT connected" />
      </PageHeader>

      <PageContent>
        {mowers.length === 0 ? (
          <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200}}>
            <Typography variant="h6" color="text.secondary">
              No mowers configured.
            </Typography>
          </Box>
        ) : (
          <Box sx={{display: 'flex', flexDirection: 'column', gap: 3}}>
            {mowers.map((mower) => (
              <Card key={mower.id} sx={outerCardStyles(theme)}>
                <CardContent>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    {mower.name}
                  </Typography>
                  {mower.description && (
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                      {mower.description}
                    </Typography>
                  )}

                  <Box sx={{display: 'flex', flexDirection: 'column', gap: 2.5}}>
                    <MqttSection
                      mqttUrl={mower.mqttUrl}
                      mqttPrefix={mower.mqttPrefix}
                      mqttStatus={mqttStatuses[mower.id] ?? 'connecting'}
                    />

                    <Divider />

                    <VersionSection backend={mower.versionInfo} />

                    <Divider />

                    <RpcSection rpc={mower.rpc} />

                    {mower.hasCapability('system.stats') && (
                      <>
                        <Divider />
                        <SystemStatsSection rpc={mower.rpc} capabilities={mower.capabilities} />
                      </>
                    )}

                    {(mower.hasCapability('system.reboot') || mower.hasCapability('system.docker_prune')) && (
                      <>
                        <Divider />
                        <SystemActionsSection rpc={mower.rpc} capabilities={mower.capabilities} />
                      </>
                    )}

                    <Divider />

                    <TopicsSection mowerId={mower.id} lastSeen={mower.lastSeen} />

                    <Divider />

                    <CapabilitiesSection capabilities={mower.capabilities} />

                    <Divider />

                    <MapSection map={mower.map} />

                    <Divider />

                    <ActionsSection actions={mower.actions} />

                    <Divider />

                    <OverlaySection overlay={mower.mapOverlay} />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </PageContent>
    </Page>
  );
}
