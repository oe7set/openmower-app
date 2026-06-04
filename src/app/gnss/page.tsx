'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {outerCardStyles} from '@/lib/cardStyles';
import {fixTypeShort} from '@/lib/gps';
import {useLatestGnss} from '@/stores/gnssStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {
  ExpandMore,
  GpsFixed,
  SatelliteAlt,
  Speed as DopIcon,
  Tune,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  IconButton,
  Menu,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {memo, useState} from 'react';
import ConstellationSummary from './ConstellationSummary';
import DopPanel from './DopPanel';
import FixHero from './FixHero';
import GnssCharts from './GnssCharts';
import PositionReadout from './PositionReadout';
import Skyplot from './Skyplot';
import SignalBars from './SignalBars';
import {GNSS_SECTIONS, useGnssLayout, type GnssSectionId} from './useGnssLayout';

// Header chips update at the GNSS stream rate; isolate them in a memoized
// subscriber so the page shell doesn't reconcile on every sample.
const GnssHeaderStats = memo(function GnssHeaderStats({mowerId}: {mowerId: string | undefined}) {
  const sample = useLatestGnss(mowerId);
  const has = sample !== undefined;
  return (
    <>
      <HeaderStat icon={<GpsFixed />} value={fixTypeShort(has ? sample!.ft : undefined)} label="Fix" />
      <HeaderStat icon={<SatelliteAlt />} value={has ? `${sample!.used}/${sample!.vis}` : '—'} label="Sats used/visible" />
      <HeaderStat icon={<DopIcon />} value={has ? sample!.hacc.toFixed(2) : '—'} label="H-accuracy (m)" />
    </>
  );
});

// A collapsible panel wrapper used in the desktop grid layout.
function Panel({
  title,
  visible,
  children,
}: {
  title: string;
  visible: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  if (!visible) return null;
  return (
    <Card sx={{...outerCardStyles(theme), minWidth: 0}}>
      <CardContent>
        <Box
          sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'}}
          onClick={() => setOpen((v) => !v)}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          <IconButton size="small" sx={{transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s'}}>
            <ExpandMore />
          </IconButton>
        </Box>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{mt: 1.5}}>{children}</Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

// Layer-7 graceful degradation: when no detailed GNSS stream is present (old
// firmware, v1 driver without the change, or a receiver that doesn't emit the
// detail), fall back to the aggregate fields already in robot_state.
function GnssFallback() {
  const theme = useTheme();
  const fixType = useSelectedMower((s) => s?.state.gps_fix_type);
  const sats = useSelectedMower((s) => s?.state.gps_satellite_count);
  const pdopRaw = useSelectedMower((s) => s?.state.gps_pdop);
  const posAccuracy = useSelectedMower((s) => s?.state.pose.pos_accuracy);
  const pdop = pdopRaw && pdopRaw > 0 ? pdopRaw : undefined;

  return (
    <Card sx={{...outerCardStyles(theme), minWidth: 0}}>
      <CardContent>
        <Alert severity="info" sx={{mb: 2}}>
          Detailed per-satellite data isn&apos;t available from this mower. Showing the aggregate GPS status.
          The full skyplot, signal bars and DOP breakdown need the GNSS-detail firmware/driver
          (<code>gnss/stream</code>).
        </Alert>
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
          <Box>
            <Typography variant="caption" color="text.secondary">Fix</Typography>
            <Box><Chip label={fixTypeShort(fixType)} size="small" sx={{fontWeight: 600}} /></Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>Satellites</Typography>
            <Typography variant="h6" fontWeight={700}>{sats ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>PDOP</Typography>
            <Typography variant="h6" fontWeight={700}>{pdop !== undefined ? pdop.toFixed(2) : '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>Position accuracy</Typography>
            <Typography variant="h6" fontWeight={700}>
              {posAccuracy != null ? `${posAccuracy.toFixed(2)} m` : '—'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// The body renders the rich panels. Split into its own subscriber so it
// re-renders on each sample while the page shell stays static.
const GnssBody = memo(function GnssBody({
  mowerId,
  layout,
}: {
  mowerId: string | undefined;
  layout: Record<GnssSectionId, boolean>;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sample = useLatestGnss(mowerId);
  const sats = sample?.sats ?? [];

  if (sample === undefined) {
    return <GnssFallback />;
  }

  // Section content, reused by both the desktop grid and the mobile accordion.
  const sections: {id: GnssSectionId; title: string; node: React.ReactNode}[] = [
    {id: 'skyplot', title: 'Skyplot', node: <Skyplot satellites={sats} />},
    {id: 'signals', title: 'Signal strength', node: <SignalBars satellites={sats} />},
    {id: 'constellations', title: 'Constellations', node: <ConstellationSummary satellites={sats} />},
    {id: 'dop', title: 'Dilution of precision', node: <DopPanel dop={sample.dop} />},
    {id: 'charts', title: 'Trends', node: <GnssCharts />},
    {id: 'position', title: 'Position & velocity', node: <PositionReadout sample={sample} />},
  ];
  const visibleSections = sections.filter((s) => layout[s.id]);

  if (isMobile) {
    return (
      <Box sx={{mt: 2}}>
        <FixHero sample={sample} />
        <Box sx={{mt: 2}}>
          {visibleSections.map((s) => (
            <Accordion key={s.id} defaultExpanded={s.id === 'skyplot'} disableGutters>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography fontWeight={600}>{s.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>{s.node}</AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>
    );
  }

  // Desktop: responsive card grid. Skyplot + signals span two columns where it
  // helps; the rest flow in a min-320px auto-fill grid.
  return (
    <Box sx={{mt: 2}}>
      <Card sx={{...outerCardStyles(theme), minWidth: 0, mb: 2}}>
        <CardContent>
          <FixHero sample={sample} />
        </CardContent>
      </Card>
      <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 2, alignItems: 'start'}}>
        {visibleSections.map((s) => (
          <Box key={s.id} sx={{gridColumn: s.id === 'signals' ? {lg: 'span 2'} : undefined}}>
            <Panel title={s.title} visible>
              {s.node}
            </Panel>
          </Box>
        ))}
      </Box>
    </Box>
  );
});

export default function GnssPage() {
  const mowerId = useSelectedMower((s) => s?.id);
  const {layout, toggle} = useGnssLayout();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Page sx={{height: '100%'}}>
      <PageHeader title="GNSS" subtitle="Live satellite constellation, signal strength and RTK diagnostics">
        <GnssHeaderStats mowerId={mowerId} />
      </PageHeader>

      <PageContent>
        {/* Section visibility toggle */}
        <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: 1}}>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} title="Show / hide panels">
            <Tune />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
            <Box sx={{px: 2, py: 0.5}}>
              <Typography variant="caption" color="text.secondary">
                Panels
              </Typography>
            </Box>
            {GNSS_SECTIONS.map((s) => (
              <Box key={s.id} sx={{px: 2}}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={layout[s.id]} onChange={() => toggle(s.id)} />}
                  label={s.label}
                />
              </Box>
            ))}
          </Menu>
        </Box>

        <GnssBody mowerId={mowerId} layout={layout} />
      </PageContent>
    </Page>
  );
}
