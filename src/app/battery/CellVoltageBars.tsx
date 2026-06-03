'use client';

import {useLatestBms} from '@/stores/bmsStore';
import {Box, Chip, Typography, useTheme} from '@mui/material';
import {memo, useMemo} from 'react';
import {cellDeltaStatus, computeCellStats} from './batteryFormatting';

// Per-cell voltage bars. Memoized so it re-renders only when this mower's BMS
// telemetry changes (~1 Hz), never on unrelated store updates. Renders nothing
// useful (an "n/a" hint) when the pack reports no per-cell data — e.g. a
// platform without a smart BMS.
const CellVoltageBars = memo(function CellVoltageBars({mowerId}: {mowerId: string | undefined}) {
  const theme = useTheme();
  const telemetry = useLatestBms(mowerId);
  const cells = telemetry?.cell_voltage_v;
  const stats = useMemo(() => computeCellStats(cells), [cells]);

  if (!cells || cells.length === 0 || !stats) {
    return (
      <Typography variant="body2" color="text.disabled">
        No per-cell data available
      </Typography>
    );
  }

  const deltaMv = Math.round(stats.delta * 1000);
  const balanceStatus = cellDeltaStatus(stats.delta);

  // Bar scale: pad the [min, max] window so a tightly-balanced pack still shows
  // visible bar-length differences instead of all bars looking identical.
  const lo = Math.max(0, stats.min - 0.05);
  const hi = stats.max + 0.05;
  const span = hi - lo > 0 ? hi - lo : 1;

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, flexWrap: 'wrap'}}>
        <Typography variant="subtitle1" fontWeight={600}>
          Cells
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {cells.length} × {stats.avg.toFixed(3)} V avg
        </Typography>
        <Box sx={{flex: 1}} />
        <Chip
          size="small"
          color={balanceStatus}
          variant={balanceStatus === 'success' ? 'outlined' : 'filled'}
          label={`Δ ${deltaMv} mV`}
        />
      </Box>

      <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75}}>
        {cells.map((v, i) => {
          const frac = Math.max(0, Math.min(1, (v - lo) / span));
          const isMin = i === stats.minIndex;
          const isMax = i === stats.maxIndex;
          // Highlight the weakest cell when the pack is meaningfully imbalanced.
          const barColor =
            isMin && balanceStatus !== 'success'
              ? theme.palette[balanceStatus].main
              : theme.palette.primary.main;
          return (
            <Box key={i} sx={{display: 'flex', alignItems: 'center', gap: 1}}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{width: 36, flexShrink: 0, fontFamily: 'monospace'}}
              >
                #{i + 1}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  height: 14,
                  borderRadius: 1,
                  background: theme.palette.action.hover,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${frac * 100}%`,
                    background: barColor,
                    borderRadius: 1,
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  width: 64,
                  flexShrink: 0,
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontWeight: isMin || isMax ? 700 : 400,
                  color: isMin && balanceStatus !== 'success' ? `${balanceStatus}.main` : 'text.primary',
                }}
              >
                {v.toFixed(3)} V
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});

export default CellVoltageBars;
