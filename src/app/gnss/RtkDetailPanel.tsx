'use client';

import type {GnssSample} from '@/stores/schemas';
import {correctionAgeColor, solutionLabel} from '@/lib/gnss';
import {Box, Tooltip, Typography} from '@mui/material';

interface RtkDetailPanelProps {
  sample: GnssSample | undefined;
}

const PALETTE = {success: '#2e7d32', warning: '#f9a825', error: '#e53935', default: 'text.primary'} as const;

interface RowProps {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}

function Row({label, value, hint, color}: RowProps) {
  const content = (
    <>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontFamily="monospace" textAlign="right" sx={{color: color ?? 'text.primary'}}>
        {value}
      </Typography>
    </>
  );
  return hint ? (
    <Tooltip title={hint} arrow placement="left">
      <Box sx={{display: 'contents', cursor: 'help'}}>{content}</Box>
    </Tooltip>
  ) : (
    content
  );
}

export default function RtkDetailPanel({sample}: RtkDetailPanelProps) {
  const has = sample !== undefined;
  const base = sample?.base;
  const headingAcc = sample?.hacc_hdg;
  const age = sample?.age;
  const sol = sample?.sol;
  const cutoff = sample?.cutoff;

  const ageColorKey = correctionAgeColor(age);

  const fmt = (v: number | undefined, digits: number, unit = '') =>
    has && v !== undefined ? `${v.toFixed(digits)}${unit}` : '—';

  return (
    <Box>
      <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5}}>
        <Row
          label="Solution status"
          value={has && sol !== undefined ? solutionLabel(sol) : '—'}
          hint="Receiver-reported solution stage (single → DGPS → RTK float → RTK fixed)."
        />
        <Row
          label="Baseline length"
          value={fmt(base, 3, ' m')}
          hint="Distance between the two GNSS antennas (dual-antenna heading). Should match your physical antenna separation."
        />
        <Row
          label="Heading accuracy"
          value={fmt(headingAcc, 2, '°')}
          hint="Standard deviation of the dual-antenna heading. Only meaningful with a fixed heading solution."
        />
        <Row
          label="Elevation cutoff"
          value={cutoff === undefined || cutoff < 0 ? '—' : `${cutoff.toFixed(0)}°`}
          hint="The elevation mask the receiver is actually enforcing. A high value (e.g. 20°) drops low satellites and can starve the RTK/heading engine."
        />
        <Row
          label="Correction age"
          value={age === undefined || age <= 0 ? '—' : `${age.toFixed(1)} s`}
          color={PALETTE[ageColorKey] === 'text.primary' ? undefined : PALETTE[ageColorKey]}
          hint="Seconds since the last RTCM correction was applied. Under ~5 s is healthy; over 30 s means corrections are stale."
        />
      </Box>
      {has && base === undefined && headingAcc === undefined && cutoff === undefined && (
        <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 1.5}}>
          Baseline, heading accuracy and elevation cutoff require the Unicore-detail firmware (UM982). They stay “—” on
          other receivers or older firmware.
        </Typography>
      )}
    </Box>
  );
}
