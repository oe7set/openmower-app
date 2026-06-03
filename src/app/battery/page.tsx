'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useLatestBms} from '@/stores/bmsStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {useSensorValue} from '@/stores/sensorsStore';
import {BatteryChargingFull, BatteryFull, Bolt, DeviceThermostat, Percent} from '@mui/icons-material';
import {Alert, Box, Card, CardContent, Divider, Typography} from '@mui/material';
import {memo} from 'react';
import BatteryCharts from './BatteryCharts';
import BatteryExportButton from './BatteryExportButton';
import BatteryMetricsPanel from './BatteryMetricsPanel';
import {chargeFlow, fmtUnit} from './batteryFormatting';
import CellVoltageBars from './CellVoltageBars';
import ChargerPanel from './ChargerPanel';

// Live header stats. Memoized so the hero shell does not reconcile on every
// ~1 Hz BMS update — only this small subtree does.
const BatteryHeaderStats = memo(function BatteryHeaderStats({mowerId}: {mowerId: string | undefined}) {
  const t = useLatestBms(mowerId);
  const soc =
    typeof t?.relative_state_of_charge === 'number'
      ? t.relative_state_of_charge * 100
      : typeof t?.battery_pct === 'number'
        ? t.battery_pct * 100
        : undefined;
  const flow = chargeFlow(t?.current);
  const SocIcon = flow === 'charging' ? BatteryChargingFull : BatteryFull;
  return (
    <>
      <HeaderStat icon={<SocIcon />} value={fmtUnit(soc, '%', 0)} label="Charge" />
      <HeaderStat icon={<Bolt />} value={fmtUnit(t?.voltage ?? t?.battery_voltage, 'V', 1)} label="Voltage" />
      <HeaderStat icon={<Percent />} value={fmtUnit(t?.current, 'A', 1)} label="Current" />
      {typeof t?.temperature === 'number' && (
        <HeaderStat icon={<DeviceThermostat />} value={fmtUnit(t.temperature, '°C', 0)} label="Temp" />
      )}
    </>
  );
});

// Fallback shown on platforms without a smart BMS: the basic charger-IC voltage
// and charge state are still available via the always-present sensors.
const BasicFallback = memo(function BasicFallback({mowerId}: {mowerId: string | undefined}) {
  const vBattery = useSensorValue(mowerId, 'om_v_battery');
  const chargeState = useSensorValue(mowerId, 'om_charge_state');
  const vBatteryNum = typeof vBattery?.value === 'number' ? vBattery.value : undefined;
  return (
    <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5}}>
      <Typography variant="caption" color="text.secondary">
        Battery voltage
      </Typography>
      <Typography variant="body2" fontFamily="monospace" textAlign="right">
        {fmtUnit(vBatteryNum, 'V', 2)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Charge state
      </Typography>
      <Typography variant="body2" fontFamily="monospace" textAlign="right">
        {typeof chargeState?.value === 'string' ? chargeState.value : '—'}
      </Typography>
    </Box>
  );
});

export default function BatteryPage() {
  const mowerId = useSelectedMower((s) => s?.id);
  const hasBms = useLatestBms(mowerId)?.present === true;

  return (
    <Page sx={{height: '100%'}}>
      <PageHeader title="Battery" subtitle="Cells, charge/discharge, health and charger">
        <BatteryHeaderStats mowerId={mowerId} />
      </PageHeader>

      <PageContent sx={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
        {!hasBms && (
          <Alert severity="info" sx={{mt: 2}}>
            No smart BMS detected on this mower — showing basic power telemetry. Per-cell voltages, charge cycles and
            health require a battery with a smart BMS (e.g. the Sabo / Tango E5 pack).
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: {xs: 'column', lg: 'row'},
            gap: 2,
            mt: 2,
            flex: 1,
            minHeight: 0,
            alignItems: 'flex-start',
          }}
        >
          {/* Left column: pack metrics + cells (or the basic fallback). */}
          <Card sx={{flex: {xs: '1 1 auto', lg: '1 1 0'}, minWidth: 0, width: '100%', overflow: 'auto'}}>
            <CardContent>
              {hasBms ? (
                <>
                  <BatteryMetricsPanel mowerId={mowerId} />
                  <Divider sx={{my: 2}} />
                  <CellVoltageBars mowerId={mowerId} />
                </>
              ) : (
                <>
                  <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1.5}}>
                    Power
                  </Typography>
                  <BasicFallback mowerId={mowerId} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Right column: charger + charts + export. */}
          <Card sx={{flex: {xs: '1 1 auto', lg: '1 1 0'}, minWidth: 0, width: '100%', overflow: 'auto'}}>
            <CardContent>
              <ChargerPanel mowerId={mowerId} />
              <Divider sx={{my: 2}} />
              <Box sx={{display: 'flex', alignItems: 'center', mb: 1.5}}>
                <Typography variant="subtitle1" fontWeight={600} sx={{flex: 1}}>
                  History
                </Typography>
                <BatteryExportButton />
              </Box>
              <BatteryCharts mowerId={mowerId} hasBms={hasBms} />
            </CardContent>
          </Card>
        </Box>
      </PageContent>
    </Page>
  );
}
