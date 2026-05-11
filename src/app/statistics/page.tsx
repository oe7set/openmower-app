'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useSelectedMower} from '@/stores/mowersStore';
import {Box, Card, CardContent, Chip, Typography, useTheme} from '@mui/material';
import {BarChart3Icon, ClockIcon, MapIcon, RouteIcon} from 'lucide-react';

// Forward-looking page. Backend doesn't publish mowing_sessions/json yet, so
// we render a clean empty state plus muted previews of what each future card
// will show. This keeps the navigation surface honest — the user sees what's
// coming without seeing fake numbers.

interface SoonCardSpec {
  label: string;
  Icon: typeof RouteIcon;
  body: string;
}

const SOON_CARDS: SoonCardSpec[] = [
  {label: 'Distance mowed', Icon: RouteIcon, body: 'Total path length the mower has driven.'},
  {label: 'Hours active', Icon: ClockIcon, body: 'Cumulative active duration across all sessions.'},
  {label: 'Coverage', Icon: MapIcon, body: 'Area covered per session, with completion rate.'},
];

export default function StatisticsPage() {
  const theme = useTheme();
  const sessions = useSelectedMower((s) => s?.mowingSessions ?? []);
  const hasData = sessions.length > 0;

  return (
    <Page>
      <PageHeader
        title="Statistics"
        subtitle="Mowing sessions, coverage and runtime — once your mower starts logging them"
      />
      <PageContent>
        {!hasData && (
          <Card sx={{mt: 2, textAlign: 'center', py: 6, px: 3}}>
            <CardContent>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}22 0%, ${theme.palette.primary.main}11 100%)`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  color: theme.palette.primary.main,
                }}
              >
                <BarChart3Icon size={36} />
              </Box>
              <Typography variant="h4" sx={{mb: 1}}>
                No sessions yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{maxWidth: 480, mx: 'auto', mb: 3}}>
                Once the mower completes its first mow, this page will fill with distance, runtime and coverage data.
                Backend session logging is on the roadmap.
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {xs: '1fr', md: 'repeat(3, minmax(0, 1fr))'},
                  gap: 2,
                  mt: 4,
                  opacity: 0.45,
                }}
              >
                {SOON_CARDS.map(({label, Icon, body}) => (
                  <Box
                    key={label}
                    sx={{
                      border: `1px dashed ${theme.palette.divider}`,
                      borderRadius: 2,
                      p: 2.5,
                      textAlign: 'left',
                    }}
                  >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                      <Icon size={18} />
                      <Typography variant="subtitle2" fontWeight="600">
                        {label}
                      </Typography>
                      <Chip label="soon" size="small" sx={{ml: 'auto'}} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {body}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}
        {hasData && (
          // Real session list — minimal table for now. When the backend lands
          // we'll grow this into proper charts. Listed newest-first.
          <Card sx={{mt: 2}}>
            <CardContent>
              <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
                Recent sessions
              </Typography>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  '& th, & td': {
                    textAlign: 'left',
                    py: 1,
                    px: 1.5,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  },
                  '& th': {color: 'text.secondary', fontSize: '0.7rem', textTransform: 'uppercase'},
                  '& td': {fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.85rem'},
                }}
              >
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Distance</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sessions]
                    .sort((a, b) => b.start_ts - a.start_ts)
                    .slice(0, 50)
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.start_ts * 1000).toLocaleString()}</td>
                        <td>{s.duration_s !== undefined ? `${Math.round(s.duration_s / 60)} min` : '—'}</td>
                        <td>{s.distance_m !== undefined ? `${Math.round(s.distance_m)} m` : '—'}</td>
                        <td>{s.coverage_m2 !== undefined ? `${Math.round(s.coverage_m2)} m²` : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </Box>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </Page>
  );
}
