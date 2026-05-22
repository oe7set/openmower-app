'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {fixTypeShort} from '@/lib/gps';
import {useSelectedMower} from '@/stores/mowersStore';
import type {SensorInfo} from '@/stores/schemas';
import {GpsFixed as GpsFixIcon, Sensors as SensorsIcon, Timeline as TimelineIcon} from '@mui/icons-material';
import {Alert, Box} from '@mui/material';
import {useMemo, useState} from 'react';
import SensorGauge from './SensorGauge';
import SensorHistoryDialog from './SensorHistoryDialog';

// Cosmetic ordering — keep the most-watched sensors at the top of the grid.
// Anything not listed falls through to the natural order from the backend.
const SENSOR_PRIORITY = [
  'om_v_battery',
  'om_v_charge',
  'om_charge_current',
  'om_mow_motor_rpm',
  'om_mow_motor_current',
  'om_mow_motor_temp',
  'om_mow_esc_temp',
  'om_left_esc_temp',
  'om_right_esc_temp',
  'om_gps_quality',
  'om_gps_accuracy',
  'om_gps_satellites',
  'om_gps_pdop',
  'om_gps_fix_type',
  'om_gps_heading_accuracy',
];

function sortInfos(a: SensorInfo, b: SensorInfo): number {
  const ai = SENSOR_PRIORITY.indexOf(a.sensor_id);
  const bi = SENSOR_PRIORITY.indexOf(b.sensor_id);
  if (ai === -1 && bi === -1) return a.sensor_id.localeCompare(b.sensor_id);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

export default function SensorsPage() {
  const mowerId = useSelectedMower((s) => s?.id);
  const sensorInfos = useSelectedMower((s) => s?.sensorInfos ?? []);
  const fixType = useSelectedMower((s) => s?.state.gps_fix_type);
  const sortedInfos = useMemo(() => [...sensorInfos].sort(sortInfos), [sensorInfos]);

  const [openSensor, setOpenSensor] = useState<SensorInfo | null>(null);

  return (
    <Page>
      <PageHeader title="Sensors" subtitle="Live readings from the mower's onboard hardware">
        <HeaderStat icon={<SensorsIcon />} value={sensorInfos.length} label="Discovered" />
        <HeaderStat icon={<TimelineIcon />} value="1 h" label="History buffer" />
        {fixType !== undefined && (
          <HeaderStat icon={<GpsFixIcon />} value={fixTypeShort(fixType)} label="GPS fix" />
        )}
      </PageHeader>

      <PageContent>
        {!mowerId ? (
          <Alert severity="info">Select a mower to see live sensor data.</Alert>
        ) : sensorInfos.length === 0 ? (
          <Alert severity="info">
            No sensors discovered yet. Make sure <code>xbot_monitoring</code> is running and
            <code> sensor_infos/json</code> has been published.
          </Alert>
        ) : (
          <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2}}>
            {sortedInfos.map((info) => (
              <SensorGauge
                key={info.sensor_id}
                mowerId={mowerId}
                info={info}
                onClick={() => setOpenSensor(info)}
              />
            ))}
          </Box>
        )}

        {openSensor && mowerId && (
          <SensorHistoryDialog
            mowerId={mowerId}
            info={openSensor}
            open={openSensor !== null}
            onClose={() => setOpenSensor(null)}
          />
        )}
      </PageContent>
    </Page>
  );
}
