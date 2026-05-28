'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {quaternionToEuler, radToDeg} from '@/lib/quaternion';
import {useLatestImu} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {ThreeSixty as YawIcon, RotateLeft as RollIcon, SwapVert as PitchIcon} from '@mui/icons-material';
import {Box, Card, CardContent, Divider, Typography, useMediaQuery, useTheme} from '@mui/material';
import dynamic from 'next/dynamic';
import {useMemo} from 'react';
import CalibrateButton from './CalibrateButton';
import ImuCharts from './ImuCharts';

// The 3D viewer is client-only and pulls in three.js + @react-three/* — keep
// it out of the initial route bundle.
const ImuVisualizer = dynamic(() => import('./ImuVisualizer'), {ssr: false});

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
        {unit && <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 0.5}}>{unit}</Typography>}
      </Typography>
    </>
  );
}

export default function ImuPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const mowerId = useSelectedMower((s) => s?.id);
  const sample = useLatestImu(mowerId);

  const euler = useMemo(() => (sample ? quaternionToEuler(sample) : null), [sample]);
  const hasData = sample !== undefined && euler !== null;

  const rollDeg = euler ? radToDeg(euler.roll) : 0;
  const pitchDeg = euler ? radToDeg(euler.pitch) : 0;
  const yawDeg = euler ? ((radToDeg(euler.yaw) % 360) + 360) % 360 : 0;

  const fmt = (v: number, digits = 2) => (hasData ? v.toFixed(digits) : '—');
  const fmtAngle = (deg: number, digits = 1) => (hasData ? `${deg.toFixed(digits)}°` : '—');

  return (
    <Page sx={{height: '100%'}}>
      <PageHeader title="IMU" subtitle="Live orientation, acceleration and angular velocity">
        <HeaderStat icon={<RollIcon />} value={fmtAngle(rollDeg)} label="Roll" />
        <HeaderStat icon={<PitchIcon />} value={fmtAngle(pitchDeg)} label="Pitch" />
        <HeaderStat icon={<YawIcon />} value={fmtAngle(yawDeg, 0)} label="Yaw" />
      </PageHeader>

      <PageContent sx={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: {xs: 'column', md: 'row'},
            gap: 2,
            mt: 2,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* 3D viewer — main area */}
          <Card
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: {xs: 320, md: 0},
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                flex: 1,
                minHeight: 320,
                position: 'relative',
                background:
                  theme.palette.mode === 'dark'
                    ? 'radial-gradient(circle at 50% 30%, #1a2630 0%, #0c1218 100%)'
                    : 'radial-gradient(circle at 50% 30%, #e8f0e8 0%, #c8d6c8 100%)',
              }}
            >
              <ImuVisualizer />
            </Box>
          </Card>

          {/* Sidebar — values + charts */}
          <Card sx={{flex: {xs: '0 0 auto', md: '0 0 320px'}, minWidth: 0, overflow: 'auto'}}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
                Orientation
              </Typography>
              <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
                <ValueRow label="Roll" value={fmtAngle(rollDeg, 2)} />
                <ValueRow label="Pitch" value={fmtAngle(pitchDeg, 2)} />
                <ValueRow label="Yaw" value={fmtAngle(yawDeg, 1)} />
              </Box>

              <Divider sx={{my: 1.5}} />

              <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
                Quaternion
              </Typography>
              <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
                <ValueRow label="qw" value={fmt(sample?.qw ?? 0, 4)} />
                <ValueRow label="qx" value={fmt(sample?.qx ?? 0, 4)} />
                <ValueRow label="qy" value={fmt(sample?.qy ?? 0, 4)} />
                <ValueRow label="qz" value={fmt(sample?.qz ?? 0, 4)} />
              </Box>

              <Divider sx={{my: 1.5}} />

              <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
                Acceleration
              </Typography>
              <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
                <ValueRow label="ax" value={fmt(sample?.ax ?? 0)} unit="m/s²" />
                <ValueRow label="ay" value={fmt(sample?.ay ?? 0)} unit="m/s²" />
                <ValueRow label="az" value={fmt(sample?.az ?? 0)} unit="m/s²" />
              </Box>

              <Divider sx={{my: 1.5}} />

              <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
                Angular velocity
              </Typography>
              <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
                <ValueRow label="gx" value={fmt(sample?.gx ?? 0, 3)} unit="rad/s" />
                <ValueRow label="gy" value={fmt(sample?.gy ?? 0, 3)} unit="rad/s" />
                <ValueRow label="gz" value={fmt(sample?.gz ?? 0, 3)} unit="rad/s" />
              </Box>

              <Divider sx={{my: 1.5}} />

              <Box sx={{mb: 1.5}}>
                <CalibrateButton />
              </Box>

              <ImuCharts />

              {!isMobile && (
                <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 2}}>
                  Drag to rotate the view · scroll to zoom · X = forward, Y = left, Z = up (REP-103)
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </PageContent>
    </Page>
  );
}
