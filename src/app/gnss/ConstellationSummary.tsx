'use client';

import type {GnssSatellite} from '@/stores/schemas';
import {CONSTELLATION_ORDER, constellation, gnssIdColor} from '@/lib/gnss';
import {Box, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import {useMemo} from 'react';

interface ConstellationSummaryProps {
  satellites: GnssSatellite[];
}

interface Row {
  gnssId: number;
  visible: number; // distinct SVs
  used: number; // distinct SVs used in fix
  avgCn0: number;
}

function summarize(sats: GnssSatellite[]): Row[] {
  const rows: Row[] = [];
  for (const gnssId of CONSTELLATION_ORDER) {
    const members = sats.filter((s) => s.g === gnssId);
    if (members.length === 0) continue;
    const distinctSvs = new Set(members.map((s) => s.s));
    const usedSvs = new Set(members.filter((s) => s.u).map((s) => s.s));
    const withSignal = members.filter((s) => s.c > 0);
    const avg = withSignal.length > 0 ? withSignal.reduce((a, s) => a + s.c, 0) / withSignal.length : 0;
    rows.push({gnssId, visible: distinctSvs.size, used: usedSvs.size, avgCn0: avg});
  }
  return rows;
}

export default function ConstellationSummary({satellites}: ConstellationSummaryProps) {
  const rows = useMemo(() => summarize(satellites), [satellites]);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" textAlign="center" sx={{py: 2}}>
        No constellation data yet
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>System</TableCell>
          <TableCell align="right">Visible</TableCell>
          <TableCell align="right">Used</TableCell>
          <TableCell align="right">Avg C/N0</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.gnssId}>
            <TableCell>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Box sx={{width: 10, height: 10, borderRadius: '50%', bgcolor: gnssIdColor(r.gnssId)}} />
                {constellation(r.gnssId).name}
              </Box>
            </TableCell>
            <TableCell align="right">{r.visible}</TableCell>
            <TableCell align="right">{r.used}</TableCell>
            <TableCell align="right">{r.avgCn0 > 0 ? `${r.avgCn0.toFixed(1)}` : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
