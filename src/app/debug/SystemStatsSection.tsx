'use client';

import type {OpenMowerRpc} from '@/lib/rpc';
import type {Capabilities} from '@/stores/schemas';
import {
  Memory as CpuIcon,
  Storage as DiskIcon,
  Equalizer as MetricsIcon,
  DeveloperBoard as RamIcon,
  Thermostat as TempIcon,
} from '@mui/icons-material';
import {Box, Chip, LinearProgress, Tooltip, Typography} from '@mui/material';
import {useEffect, useRef, useState} from 'react';

// Server-side schema for system.stats. Every field is optional because the
// backend omits values it cannot read (e.g. disk usage when running outside
// pid: host). We narrow at the property access site rather than re-defining
// the type to match the auto-generated rpc.ts shape.
interface SystemStats {
  cpu_percent?: number;
  ram_total_bytes?: number;
  ram_used_bytes?: number;
  ram_available_bytes?: number;
  cpu_temp_c?: number;
  disk_total_bytes?: number;
  disk_used_bytes?: number;
  disk_free_bytes?: number;
  uptime_seconds?: number;
}

const POLL_INTERVAL_MS = 2000;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function tempColor(temp: number): 'success' | 'warning' | 'error' {
  if (temp >= 80) return 'error';
  if (temp >= 70) return 'warning';
  return 'success';
}

function StatTile({
  icon,
  label,
  primary,
  secondary,
  progress,
  progressColor = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  progress?: number;
  progressColor?: 'primary' | 'success' | 'warning' | 'error';
}) {
  return (
    <Box
      sx={{
        flex: '1 1 200px',
        minWidth: 0,
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color: 'text.secondary'}}>
        {icon}
        <Typography variant="caption" fontWeight={600} sx={{textTransform: 'uppercase', letterSpacing: 0.5}}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h6" sx={{fontFamily: 'var(--font-dm-mono), monospace', lineHeight: 1.2}}>
        {primary}
      </Typography>
      {secondary && (
        <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.25}}>
          {secondary}
        </Typography>
      )}
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, progress))}
          color={progressColor}
          sx={{mt: 1, height: 6, borderRadius: 3}}
        />
      )}
    </Box>
  );
}

export default function SystemStatsSection({rpc, capabilities}: {rpc: OpenMowerRpc; capabilities: Capabilities}) {
  const hasCap = (capabilities['system.stats'] ?? 0) >= 1;
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [stale, setStale] = useState(false);
  // Track unmount/visibility/in-flight so the poll loop never resolves into a
  // dead component or piles up overlapping requests.
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!hasCap) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!mountedRef.current) return;
      // Pause when the tab isn't visible to avoid burning bandwidth on a
      // hidden page; the next visibility change re-arms the loop.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      if (inFlightRef.current) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      inFlightRef.current = true;
      try {
        const result = (await rpc.system.stats()) as SystemStats;
        if (mountedRef.current) {
          setStats(result);
          setStale(false);
        }
      } catch {
        if (mountedRef.current) setStale(true);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    const onVisibility = () => {
      // When the tab comes back, fire immediately instead of waiting up to
      // POLL_INTERVAL_MS for the next scheduled call.
      if (document.visibilityState === 'visible' && mountedRef.current && !inFlightRef.current) {
        if (timer) clearTimeout(timer);
        tick();
      }
    };

    tick();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rpc, hasCap]);

  if (!hasCap) return null;

  const cpu = stats?.cpu_percent;
  const ramUsed = stats?.ram_used_bytes;
  const ramTotal = stats?.ram_total_bytes;
  const ramPct = ramUsed !== undefined && ramTotal && ramTotal > 0 ? (ramUsed / ramTotal) * 100 : undefined;
  const temp = stats?.cpu_temp_c;
  const diskUsed = stats?.disk_used_bytes;
  const diskTotal = stats?.disk_total_bytes;
  const diskFree = stats?.disk_free_bytes;
  const diskPct = diskUsed !== undefined && diskTotal && diskTotal > 0 ? (diskUsed / diskTotal) * 100 : undefined;

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
        <MetricsIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>
          System
        </Typography>
        {stats?.uptime_seconds !== undefined && (
          <Tooltip title="Host uptime">
            <Chip label={`up ${formatUptime(stats.uptime_seconds)}`} size="small" variant="outlined" />
          </Tooltip>
        )}
        {stale && <Chip label="stale" size="small" color="warning" />}
        {!stats && !stale && (
          <Typography variant="caption" color="text.disabled">
            loading…
          </Typography>
        )}
      </Box>
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5}}>
        <StatTile
          icon={<CpuIcon fontSize="small" />}
          label="CPU"
          primary={cpu !== undefined ? `${cpu.toFixed(1)} %` : '—'}
          progress={cpu}
          progressColor={cpu !== undefined && cpu >= 90 ? 'error' : cpu !== undefined && cpu >= 70 ? 'warning' : 'primary'}
        />
        <StatTile
          icon={<RamIcon fontSize="small" />}
          label="RAM"
          primary={
            ramUsed !== undefined && ramTotal !== undefined ? `${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}` : '—'
          }
          secondary={ramPct !== undefined ? `${ramPct.toFixed(0)} % used` : undefined}
          progress={ramPct}
          progressColor={ramPct !== undefined && ramPct >= 90 ? 'error' : ramPct !== undefined && ramPct >= 75 ? 'warning' : 'primary'}
        />
        <StatTile
          icon={<TempIcon fontSize="small" />}
          label="CPU temperature"
          primary={temp !== undefined ? `${temp.toFixed(1)} °C` : '—'}
          progress={temp !== undefined ? Math.min(100, (temp / 90) * 100) : undefined}
          progressColor={temp !== undefined ? tempColor(temp) : 'primary'}
        />
        <StatTile
          icon={<DiskIcon fontSize="small" />}
          label="Disk (SD / eMMC)"
          primary={
            diskUsed !== undefined && diskTotal !== undefined ? `${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}` : '—'
          }
          secondary={
            diskFree !== undefined
              ? `${formatBytes(diskFree)} free${diskPct !== undefined ? ` · ${diskPct.toFixed(0)} % used` : ''}`
              : undefined
          }
          progress={diskPct}
          progressColor={diskPct !== undefined && diskPct >= 90 ? 'error' : diskPct !== undefined && diskPct >= 75 ? 'warning' : 'primary'}
        />
      </Box>
    </Box>
  );
}
