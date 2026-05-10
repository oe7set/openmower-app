'use client';

import ActionBar from './dashboard/ActionBar';
import BatteryCard from './dashboard/BatteryCard';
import GpsCard from './dashboard/GpsCard';
import PoseCard from './dashboard/PoseCard';
import StateCard from './dashboard/StateCard';
import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useMowers, useSelectedMower} from '@/stores/mowersStore';
import {BatteryFull, CheckCircle, GpsFixed, Router} from '@mui/icons-material';
import {Alert, Box, Typography} from '@mui/material';

export default function Dashboard() {
  const mowers = useMowers();
  const selectedMower = useSelectedMower();
  const battery = useSelectedMower((s) => s?.state.battery_percentage ?? 0);
  const gps = useSelectedMower((s) => s?.state.gps_percentage ?? 0);
  const state = useSelectedMower((s) => s?.state.current_state ?? 'UNKNOWN');

  if (mowers.length === 0) {
    return (
      <Page>
        <PageHeader title="Dashboard" subtitle="Monitor and control your OpenMower fleet" />
        <PageContent>
          <Alert severity="info">
            No mowers configured. Set <code>MOWER_MQTT_WS_URL</code> or create a <code>config.json</code> at the repo
            root.
          </Alert>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Monitor and control your OpenMower fleet">
        <HeaderStat icon={<Router />} value={mowers.length} label="Connected mowers" />
        <HeaderStat icon={<BatteryFull />} value={`${battery}%`} label="Battery" />
        <HeaderStat icon={<GpsFixed />} value={`${gps}%`} label="GPS fix" />
        <HeaderStat icon={<CheckCircle />} value={state} label="State" />
      </PageHeader>

      <PageContent>
        {!selectedMower && (
          <Alert severity="warning" sx={{mb: 3}}>
            Waiting for mower data…
          </Alert>
        )}

        <Typography variant="h5" fontWeight="600" sx={{mt: {xs: 2, md: 3}, mb: 2}}>
          Status
        </Typography>
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4}}>
          <StateCard />
          <BatteryCard />
          <GpsCard />
          <PoseCard />
        </Box>

        <ActionBar />
      </PageContent>
    </Page>
  );
}
