'use client';

import type {GnssSample} from '@/stores/schemas';
import {Box, Tooltip, Typography, useTheme} from '@mui/material';

interface RfHealthPanelProps {
  sample: GnssSample | undefined;
}

// The UM982 #AGC message reports 5 RF channels per antenna (master = [0..4],
// slave = [5..9]). A value of -1 means that channel/band is not in use; a valid
// gain (typically ~30-70) means the antenna is connected and tracking on it.
const CHANNELS = ['L1', 'L2', 'L5', 'B1', 'B2'];

function AntennaRow({label, agc}: {label: string; agc: number[]}) {
  const theme = useTheme();
  const active = agc.filter((v) => v >= 0).length;
  const dead = active === 0;
  return (
    <Box sx={{mb: 1}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{color: dead ? theme.palette.error.main : theme.palette.success.main}}>
          {dead ? 'no signal — check antenna/cable' : `${active} band${active === 1 ? '' : 's'} active`}
        </Typography>
      </Box>
      <Box sx={{display: 'flex', gap: 0.5}}>
        {agc.map((v, i) => {
          const unused = v < 0;
          return (
            <Tooltip key={i} title={`${CHANNELS[i] ?? `ch${i}`}: ${unused ? 'unused' : `AGC ${v}`}`} arrow>
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  py: 0.5,
                  borderRadius: 0.5,
                  backgroundColor: unused ? theme.palette.action.hover : theme.palette.success.main,
                  color: unused ? theme.palette.text.disabled : '#fff',
                  fontSize: 11,
                }}
              >
                {unused ? '—' : v}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

export default function RfHealthPanel({sample}: RfHealthPanelProps) {
  const theme = useTheme();
  const agc = sample?.agc;
  const jam = sample?.jam;
  const hasAgc = Array.isArray(agc) && agc.length >= 10;
  const ant1 = hasAgc ? agc!.slice(0, 5) : [];
  const ant2 = hasAgc ? agc!.slice(5, 10) : [];

  const cwRatio = jam?.[0];
  const cwFlag = jam?.[1];
  const jamColor =
    cwFlag === undefined
      ? theme.palette.text.disabled
      : cwFlag >= 2
        ? theme.palette.error.main
        : cwFlag === 1
          ? theme.palette.warning.main
          : theme.palette.success.main;
  const jamLabel =
    cwFlag === undefined ? '—' : cwFlag >= 2 ? 'Strong CW jamming' : cwFlag === 1 ? 'CW interference' : 'Clear';

  if (!hasAgc && jam === undefined) {
    return (
      <Typography variant="body2" color="text.disabled" textAlign="center" sx={{py: 2}}>
        RF health (AGC / jamming) needs the Unicore-detail firmware (UM982).
      </Typography>
    );
  }

  return (
    <Box>
      {hasAgc && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 1}}>
            Automatic gain control per antenna — a dead row (all “—”) means a disconnected antenna or cable.
          </Typography>
          <AntennaRow label="ANT1 · master" agc={ant1} />
          <AntennaRow label="ANT2 · slave" agc={ant2} />
        </>
      )}
      {jam !== undefined && (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: hasAgc ? 1.5 : 0}}>
          <Box sx={{width: 12, height: 12, borderRadius: '50%', bgcolor: jamColor}} />
          <Typography variant="body2" fontWeight={600}>
            {jamLabel}
          </Typography>
          {cwRatio !== undefined && (
            <Typography variant="caption" color="text.secondary">
              CW ratio {cwRatio}/255
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
