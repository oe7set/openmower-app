'use client';

import type {GnssSatellite} from '@/stores/schemas';
import {bandColor, bandLabel, CONSTELLATION_ORDER, constellation, gnssIdColor, svLabel} from '@/lib/gnss';
import {Box, Tooltip, Typography, useTheme} from '@mui/material';
import {useMemo} from 'react';

interface SignalBarsProps {
  satellites: GnssSatellite[];
}

// C/N0 axis: 0..55 dB-Hz covers the realistic range with headroom.
const MAX_CN0 = 55;

interface Group {
  gnssId: number;
  sats: GnssSatellite[];
}

function groupByConstellation(sats: GnssSatellite[]): Group[] {
  const groups: Group[] = [];
  for (const gnssId of CONSTELLATION_ORDER) {
    const members = sats
      .filter((s) => s.g === gnssId)
      // Sort by SV then band so a satellite's bands sit next to each other.
      .sort((a, b) => a.s - b.s || a.b - b.b);
    if (members.length > 0) groups.push({gnssId, sats: members});
  }
  // Any unknown-constellation rows fall into a trailing bucket.
  const known = new Set(CONSTELLATION_ORDER);
  const others = sats.filter((s) => !known.has(s.g));
  if (others.length > 0) groups.push({gnssId: 255, sats: others});
  return groups;
}

export default function SignalBars({satellites}: SignalBarsProps) {
  const theme = useTheme();
  const groups = useMemo(() => groupByConstellation(satellites), [satellites]);
  const tracked = satellites.filter((s) => s.c > 0).length;

  if (satellites.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" textAlign="center" sx={{py: 4}}>
        Waiting for satellite signals…
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
        {tracked} signals tracked
      </Typography>

      <Box sx={{display: 'flex', alignItems: 'flex-end', gap: 2, overflowX: 'auto', pb: 1}}>
        {groups.map((group) => (
          <Box key={group.gnssId} sx={{flex: '0 0 auto'}}>
            {/* Bars for this constellation */}
            <Box sx={{display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 140}}>
              {group.sats.map((s, i) => {
                const h = Math.max(2, (Math.min(s.c, MAX_CN0) / MAX_CN0) * 140);
                const fill = s.c > 0 ? bandColor(s.g, s.b) : theme.palette.action.disabledBackground;
                return (
                  <Tooltip
                    key={`${s.g}-${s.s}-${s.b}-${i}`}
                    title={`${svLabel(s.g, s.s)} · ${bandLabel(s.g, s.b)} · ${s.c} dB-Hz${s.u ? ' · used' : ''}${s.hl ? '' : ' · unhealthy'}`}
                    arrow
                  >
                    <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16}}>
                      <Typography variant="caption" sx={{fontSize: 9, color: 'text.secondary', mb: 0.25}}>
                        {s.c > 0 ? s.c : ''}
                      </Typography>
                      <Box
                        sx={{
                          width: '100%',
                          height: h,
                          backgroundColor: fill,
                          borderRadius: '2px 2px 0 0',
                          opacity: s.hl ? 1 : 0.4,
                          // Used-in-fix satellites get a solid outline.
                          outline: s.u ? `1.5px solid ${theme.palette.text.primary}` : 'none',
                          outlineOffset: -1.5,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{fontSize: 9, color: 'text.secondary', mt: 0.25, whiteSpace: 'nowrap'}}
                      >
                        {s.s}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
            {/* Constellation label */}
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center', mt: 0.5}}>
              <Box sx={{width: 8, height: 8, borderRadius: '50%', bgcolor: gnssIdColor(group.gnssId)}} />
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {constellation(group.gnssId).short}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
