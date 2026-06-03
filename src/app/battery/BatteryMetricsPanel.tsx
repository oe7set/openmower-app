'use client';

import {useLatestBms} from '@/stores/bmsStore';
import {Box, Chip, Divider, Typography} from '@mui/material';
import {memo} from 'react';
import {chargeFlow, computeSoh, fmtUnit} from './batteryFormatting';

interface ValueRowProps {
  label: string;
  value: string;
  unit?: string;
}

function ValueRow({label, value, unit}: ValueRowProps) {
  return (
    <>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontFamily="monospace" textAlign="right">
        {value}
        {unit && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 0.5}}>
            {unit}
          </Typography>
        )}
      </Typography>
    </>
  );
}

const GRID_SX = {display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25} as const;

// Live battery metrics. Memoized so only this subtree re-renders on each ~1 Hz
// BMS update. Every block hides itself when its source data is absent, so the
// panel degrades gracefully from a full smart-BMS pack down to a bare
// charger-only platform.
const BatteryMetricsPanel = memo(function BatteryMetricsPanel({mowerId}: {mowerId: string | undefined}) {
  const t = useLatestBms(mowerId);

  const soc =
    typeof t?.relative_state_of_charge === 'number'
      ? t.relative_state_of_charge * 100
      : typeof t?.battery_pct === 'number'
        ? t.battery_pct * 100
        : undefined;
  const soh = computeSoh(t);
  const flow = chargeFlow(t?.current);

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap'}}>
        <Typography variant="subtitle1" fontWeight={600}>
          Pack
        </Typography>
        <Box sx={{flex: 1}} />
        {flow === 'charging' && <Chip size="small" color="info" label="Charging" />}
        {flow === 'discharging' && <Chip size="small" color="warning" label="Discharging" />}
        {flow === 'idle' && <Chip size="small" variant="outlined" label="Idle" />}
      </Box>

      <Box sx={GRID_SX}>
        <ValueRow label="State of charge" value={fmtUnit(soc, '%', 1)} />
        {soh !== null && <ValueRow label="State of health" value={fmtUnit(soh * 100, '%', 1)} />}
        <ValueRow label="Voltage" value={fmtUnit(t?.voltage ?? t?.battery_voltage, 'V', 2)} />
        <ValueRow label="Current" value={fmtUnit(t?.current, 'A', 2)} />
        {typeof t?.temperature === 'number' && (
          <ValueRow label="Temperature" value={fmtUnit(t.temperature, '°C', 1)} />
        )}
      </Box>

      {(typeof t?.remaining_capacity === 'number' ||
        typeof t?.full_charge_capacity === 'number' ||
        typeof t?.cycle_count === 'number') && (
        <>
          <Divider sx={{my: 1.5}} />
          <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
            Capacity & wear
          </Typography>
          <Box sx={GRID_SX}>
            {typeof t?.remaining_capacity === 'number' && (
              <ValueRow label="Remaining" value={fmtUnit(t.remaining_capacity, 'Ah', 2)} />
            )}
            {typeof t?.full_charge_capacity === 'number' && (
              <ValueRow label="Full charge" value={fmtUnit(t.full_charge_capacity, 'Ah', 2)} />
            )}
            {typeof t?.design_capacity_ah === 'number' && (
              <ValueRow label="Design" value={fmtUnit(t.design_capacity_ah, 'Ah', 2)} />
            )}
            {typeof t?.cycle_count === 'number' && (
              <ValueRow label="Charge cycles" value={String(t.cycle_count)} />
            )}
          </Box>
        </>
      )}

      {t?.battery_status && (
        <>
          <Divider sx={{my: 1.5}} />
          <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
            Status flags
          </Typography>
          <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
            {t.battery_status
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((flag) => {
                const isAlarm = flag.startsWith('ALARM');
                return (
                  <Chip
                    key={flag}
                    size="small"
                    color={isAlarm ? 'error' : 'default'}
                    variant={isAlarm ? 'filled' : 'outlined'}
                    label={flag}
                  />
                );
              })}
          </Box>
        </>
      )}

      {(t?.mfr_name || t?.serial_number || t?.dev_name || t?.dev_chemistry || t?.mfr_date) && (
        <>
          <Divider sx={{my: 1.5}} />
          <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
            Battery info
          </Typography>
          <Box sx={GRID_SX}>
            {t?.mfr_name && <ValueRow label="Manufacturer" value={t.mfr_name} />}
            {t?.dev_name && <ValueRow label="Model" value={t.dev_name} />}
            {t?.dev_chemistry && <ValueRow label="Chemistry" value={t.dev_chemistry} />}
            {typeof t?.serial_number === 'number' && (
              <ValueRow label="Serial" value={String(t.serial_number)} />
            )}
            {t?.mfr_date && <ValueRow label="Mfr. date" value={t.mfr_date} />}
            {typeof t?.design_voltage_v === 'number' && (
              <ValueRow label="Design voltage" value={fmtUnit(t.design_voltage_v, 'V', 1)} />
            )}
          </Box>
        </>
      )}
    </Box>
  );
});

export default BatteryMetricsPanel;
