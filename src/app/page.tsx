'use client';

import ActionBar from './dashboard/ActionBar';
import BatteryCard from './dashboard/BatteryCard';
import GpsCard from './dashboard/GpsCard';
import PoseCard from './dashboard/PoseCard';
import StateCard from './dashboard/StateCard';
import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {useMowers, useSelectedMower} from '@/stores/mowersStore';
import {BatteryFull, CheckCircle, GpsFixed, Router} from '@mui/icons-material';
import {Box, Typography} from '@mui/material';

export default function Dashboard() {
  // The OnboardingDialog mounted in AppShell handles the no-mower case
  // globally — we render the normal page even with mowers.length === 0 so the
  // dashboard structure stays consistent under the modal.
  const mowers = useMowers();
  const battery = useSelectedMower((s) => s?.state.battery_percentage ?? 0);
  const gps = useSelectedMower((s) => s?.state.gps_percentage ?? 0);
  const state = useSelectedMower((s) => s?.state.current_state ?? 'UNKNOWN');

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Monitor and control your OpenMower fleet">
        <HeaderStat icon={<Router />} value={mowers.length} label="Connected mowers" />
        <HeaderStat icon={<BatteryFull />} value={`${battery}%`} label="Battery" />
        <HeaderStat icon={<GpsFixed />} value={`${gps}%`} label="GPS fix" />
        <HeaderStat icon={<CheckCircle />} value={state} label="State" />
      </PageHeader>

      <PageContent>
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
