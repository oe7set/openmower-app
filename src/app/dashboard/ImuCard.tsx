'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {quaternionToEuler, radToDeg} from '@/lib/quaternion';
import {useLatestImu} from '@/stores/imuStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {RotateRight} from '@mui/icons-material';
import {Box, Card, CardActionArea, CardContent, Typography, useTheme} from '@mui/material';
import {useRouter} from 'next/navigation';
import {useMemo} from 'react';

export default function ImuCard() {
  const theme = useTheme();
  const router = useRouter();
  const mowerId = useSelectedMower((s) => s?.id);
  const sample = useLatestImu(mowerId);

  const euler = useMemo(() => (sample ? quaternionToEuler(sample) : null), [sample]);
  const hasData = euler !== null;
  const rollDeg = euler ? radToDeg(euler.roll) : 0;
  const pitchDeg = euler ? radToDeg(euler.pitch) : 0;
  const yawDeg = euler ? ((radToDeg(euler.yaw) % 360) + 360) % 360 : 0;

  // Inclinometer: a 44 px circular disc that tilts with roll/pitch. We
  // visualise pitch as vertical offset of the bubble and roll as a tilt
  // of the horizon line, mirroring a wet-bubble level. Capping at 30 deg
  // makes small mounting tilts visible while preventing the dot from
  // flying off the disc on a flipped mower.
  const cap = (deg: number) => Math.max(-30, Math.min(30, deg));
  const bubbleX = (cap(rollDeg) / 30) * 16;
  const bubbleY = (cap(pitchDeg) / 30) * 16;

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 280px', minWidth: 0}}>
      <CardActionArea onClick={() => router.push('/imu')} sx={{height: '100%'}}>
        <CardContent>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
            <RotateRight color="primary" sx={{fontSize: 28}} />
            <Typography variant="h6" fontWeight="600">
              IMU
            </Typography>
          </Box>

          <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: `2px solid ${theme.palette.primary.main}`,
                position: 'relative',
                flexShrink: 0,
                opacity: hasData ? 1 : 0.4,
                background: `radial-gradient(circle at 50% 50%, ${theme.palette.background.paper}, transparent 70%)`,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: 1,
                  top: '50%',
                  left: 0,
                  background: theme.palette.divider,
                  transform: `rotate(${-rollDeg}deg)`,
                  transformOrigin: 'center',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  top: '50%',
                  left: '50%',
                  transform: `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))`,
                  background: theme.palette.primary.main,
                }}
              />
            </Box>

            <Box sx={{flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
              <Typography variant="caption" color="text.secondary">
                Roll
              </Typography>
              <Typography variant="body2" fontFamily="monospace" textAlign="right">
                {hasData ? `${rollDeg.toFixed(1)}°` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pitch
              </Typography>
              <Typography variant="body2" fontFamily="monospace" textAlign="right">
                {hasData ? `${pitchDeg.toFixed(1)}°` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Yaw
              </Typography>
              <Typography variant="body2" fontFamily="monospace" textAlign="right">
                {hasData ? `${yawDeg.toFixed(0)}°` : '—'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
