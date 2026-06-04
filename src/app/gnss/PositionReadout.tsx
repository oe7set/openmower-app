'use client';

import type {GnssSample} from '@/stores/schemas';
import {ContentCopy} from '@mui/icons-material';
import {Box, Divider, IconButton, Tooltip, Typography} from '@mui/material';
import {useState} from 'react';

interface PositionReadoutProps {
  sample: GnssSample | undefined;
}

function radToDeg(rad: number): number {
  return ((((rad * 180) / Math.PI) % 360) + 360) % 360;
}

interface RowProps {
  label: string;
  value: string;
  unit?: string;
  copy?: string;
}

function Row({label, value, unit, copy}: RowProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    if (!copy) return;
    void navigator.clipboard?.writeText(copy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5}}>
        <Typography variant="body2" fontFamily="monospace" textAlign="right">
          {value}
          {unit && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 0.5}}>
              {unit}
            </Typography>
          )}
        </Typography>
        {copy && (
          <Tooltip title={copied ? 'Copied' : 'Copy'} arrow>
            <IconButton size="small" onClick={onCopy} sx={{p: 0.25}}>
              <ContentCopy sx={{fontSize: 14}} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </>
  );
}

export default function PositionReadout({sample}: PositionReadoutProps) {
  const has = sample !== undefined;
  const fmt = (v: number | undefined, digits: number) => (has && v !== undefined ? v.toFixed(digits) : '—');

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
        Position
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
        <Row
          label="Latitude"
          value={fmt(sample?.lat, 7)}
          unit="°"
          copy={has ? sample?.lat.toFixed(8) : undefined}
        />
        <Row
          label="Longitude"
          value={fmt(sample?.lon, 7)}
          unit="°"
          copy={has ? sample?.lon.toFixed(8) : undefined}
        />
        <Row label="Height" value={fmt(sample?.h, 2)} unit="m" />
        <Row label="H-accuracy" value={fmt(sample?.hacc, 3)} unit="m" />
        <Row label="V-accuracy" value={fmt(sample?.vacc, 3)} unit="m" />
      </Box>

      <Divider sx={{my: 1.5}} />

      <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
        Velocity (ENU)
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
        <Row label="East" value={fmt(sample?.ve, 3)} unit="m/s" />
        <Row label="North" value={fmt(sample?.vn, 3)} unit="m/s" />
        <Row label="Up" value={fmt(sample?.vu, 3)} unit="m/s" />
      </Box>

      <Divider sx={{my: 1.5}} />

      <Typography variant="subtitle1" fontWeight={600} sx={{mb: 1}}>
        Heading
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25}}>
        <Row label="Vehicle" value={has ? radToDeg(sample!.vh).toFixed(1) : '—'} unit="°" />
        <Row label="Motion" value={has ? radToDeg(sample!.mh).toFixed(1) : '—'} unit="°" />
        <Row label="Correction age" value={fmt(sample?.age, 1)} unit="s" />
      </Box>
    </Box>
  );
}
