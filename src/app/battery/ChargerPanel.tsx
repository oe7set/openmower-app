'use client';

import {useLatestBms} from '@/stores/bmsStore';
import {Settings as SettingsIcon} from '@mui/icons-material';
import {Box, Button, Chip, Typography} from '@mui/material';
import {useRouter} from 'next/navigation';
import {memo} from 'react';
import {fmtUnit} from './batteryFormatting';

interface ValueRowProps {
  label: string;
  value: string;
}

function ValueRow({label, value}: ValueRowProps) {
  return (
    <>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontFamily="monospace" textAlign="right">
        {value}
      </Typography>
    </>
  );
}

const GRID_SX = {display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25} as const;

// Charger status + a shortcut to the (schema-driven) charger settings. The
// charger fields come from /ll/power and exist on every V2 platform, so this
// panel renders even when there is no smart BMS. Memoized for the ~1 Hz stream.
const ChargerPanel = memo(function ChargerPanel({mowerId}: {mowerId: string | undefined}) {
  const router = useRouter();
  const t = useLatestBms(mowerId);

  return (
    <Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap'}}>
        <Typography variant="subtitle1" fontWeight={600}>
          Charger
        </Typography>
        <Box sx={{flex: 1}} />
        {typeof t?.charger_enabled === 'boolean' && (
          <Chip
            size="small"
            color={t.charger_enabled ? 'success' : 'default'}
            variant={t.charger_enabled ? 'filled' : 'outlined'}
            label={t.charger_enabled ? 'Enabled' : 'Disabled'}
          />
        )}
      </Box>

      <Box sx={GRID_SX}>
        {t?.charger_status && <ValueRow label="Status" value={t.charger_status} />}
        <ValueRow label="Charge voltage" value={fmtUnit(t?.charge_voltage, 'V', 2)} />
        <ValueRow label="Charge current" value={fmtUnit(t?.charge_current, 'A', 2)} />
        {typeof t?.charger_input_current === 'number' && (
          <ValueRow label="Input current" value={fmtUnit(t.charger_input_current, 'A', 2)} />
        )}
        {typeof t?.dcdc_input_current === 'number' && (
          <ValueRow label="DC-DC input" value={fmtUnit(t.dcdc_input_current, 'A', 2)} />
        )}
      </Box>

      <Button
        size="small"
        variant="outlined"
        startIcon={<SettingsIcon />}
        onClick={() => router.push('/settings')}
        sx={{mt: 2}}
      >
        Charger settings
      </Button>
    </Box>
  );
});

export default ChargerPanel;
