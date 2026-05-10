'use client';

import {outerCardStyles} from '@/lib/cardStyles';
import {useSelectedMower} from '@/stores/mowersStore';
import {Explore} from '@mui/icons-material';
import {Box, Card, CardContent, Typography, useTheme} from '@mui/material';

export default function PoseCard() {
  const theme = useTheme();
  const x = useSelectedMower((s) => s?.state.pose.x ?? 0);
  const y = useSelectedMower((s) => s?.state.pose.y ?? 0);
  const heading = useSelectedMower((s) => s?.state.pose.heading ?? 0);
  const headingValid = useSelectedMower((s) => s?.state.pose.heading_valid ?? false);

  // Heading arrives in radians; display in degrees (0° = North).
  const headingDeg = (((heading * 180) / Math.PI) % 360 + 360) % 360;

  return (
    <Card sx={{...outerCardStyles(theme), flex: '1 1 280px', minWidth: 0}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, mb: 2}}>
          <Explore color="primary" sx={{fontSize: 28}} />
          <Typography variant="h6" fontWeight="600">
            Pose
          </Typography>
        </Box>

        <Box sx={{display: 'flex', gap: 3, mb: 2}}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              X
            </Typography>
            <Typography variant="h6" fontFamily="monospace">
              {x.toFixed(2)} m
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Y
            </Typography>
            <Typography variant="h6" fontFamily="monospace">
              {y.toFixed(2)} m
            </Typography>
          </Box>
        </Box>

        <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `2px solid ${theme.palette.primary.main}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              opacity: headingValid ? 1 : 0.4,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                width: 3,
                height: '45%',
                top: 4,
                left: '50%',
                transform: `translateX(-50%) rotate(${headingDeg}deg)`,
                transformOrigin: '50% 100%',
                backgroundColor: theme.palette.primary.main,
                borderRadius: 2,
              }}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Heading
            </Typography>
            <Typography variant="body1" fontWeight="600" color={headingValid ? 'text.primary' : 'text.secondary'}>
              {headingValid ? `${headingDeg.toFixed(0)}°` : 'invalid'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
