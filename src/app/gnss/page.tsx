'use client';

import {HeaderStat, Page, PageContent, PageHeader} from '@/components/page';
import {outerCardStyles} from '@/lib/cardStyles';
import {fixTypeShort} from '@/lib/gps';
import {useGnssDop, useGnssSats, useHasGnss, useLatestGnss} from '@/stores/gnssStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {ExpandMore, GpsFixed, SatelliteAlt, Speed as DopIcon, Tune} from '@mui/icons-material';
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
import {memo, useState, type ComponentType} from 'react';
import AccuracyMiniMap from './AccuracyMiniMap';
import Cn0ElevationScatter from './Cn0ElevationScatter';
import ConstellationSummary from './ConstellationSummary';
import DopPanel from './DopPanel';
import GnssCharts from './GnssCharts';
import HeadingCompass from './HeadingCompass';
import PositionReadout from './PositionReadout';
import RfHealthPanel from './RfHealthPanel';
import RtkDetailPanel from './RtkDetailPanel';
import RtkStatusHero from './RtkStatusHero';
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
      <HeaderStat
        icon={<SatelliteAlt />}
        value={has ? `${sample!.used}/${sample!.vis}` : '—'}
        label="Sats used/visible"
      />
      <HeaderStat icon={<DopIcon />} value={has ? sample!.hacc.toFixed(2) : '—'} label="H-accuracy (m)" />
    </>
  );
});

// ---------------------------------------------------------------------------
// Per-panel memoized subscribers. Each subscribes only the narrow slice it
// needs, so a GNSS sample at ~2.5 Hz re-renders only the panels whose data
// actually changed — the page shell, grid and Panel cards never re-render at
// stream rate. Mirrors the IMU page's memoized-subscriber pattern.
// ---------------------------------------------------------------------------

const SkyplotPanel = memo(function SkyplotPanel({mowerId}: {mowerId: string | undefined}) {
  return <Skyplot satellites={useGnssSats(mowerId)} />;
});
const SignalBarsPanel = memo(function SignalBarsPanel({mowerId}: {mowerId: string | undefined}) {
  return <SignalBars satellites={useGnssSats(mowerId)} />;
});
const ScatterPanel = memo(function ScatterPanel({mowerId}: {mowerId: string | undefined}) {
  return <Cn0ElevationScatter satellites={useGnssSats(mowerId)} />;
});
const ConstellationPanel = memo(function ConstellationPanel({mowerId}: {mowerId: string | undefined}) {
  return <ConstellationSummary satellites={useGnssSats(mowerId)} />;
});
const DopSubscriber = memo(function DopSubscriber({mowerId}: {mowerId: string | undefined}) {
  const dop = useGnssDop(mowerId);
  return dop ? <DopPanel dop={dop} /> : null;
});
const RtkDetailSubscriber = memo(function RtkDetailSubscriber({mowerId}: {mowerId: string | undefined}) {
  return <RtkDetailPanel sample={useLatestGnss(mowerId)} />;
});
const HeadingSubscriber = memo(function HeadingSubscriber({mowerId}: {mowerId: string | undefined}) {
  return <HeadingCompass sample={useLatestGnss(mowerId)} />;
});
const RfHealthSubscriber = memo(function RfHealthSubscriber({mowerId}: {mowerId: string | undefined}) {
  return <RfHealthPanel sample={useLatestGnss(mowerId)} />;
});
const PositionSubscriber = memo(function PositionSubscriber({mowerId}: {mowerId: string | undefined}) {
  return <PositionReadout sample={useLatestGnss(mowerId)} />;
});
const HeroSubscriber = memo(function HeroSubscriber({mowerId}: {mowerId: string | undefined}) {
  return <RtkStatusHero sample={useLatestGnss(mowerId)} />;
});
const MapSubscriber = memo(function MapSubscriber({mowerId}: {mowerId: string | undefined}) {
  return <AccuracyMiniMap mowerId={mowerId} />;
});
// GnssCharts polls getGnssHistory on its own interval — no subscription needed.
const ChartsPanel = memo(function ChartsPanel() {
  return <GnssCharts />;
});

// Module-scope registry so the panel element identities are stable across page
// renders — only the leaf subscribers re-render on new samples. `span2` widens
// the wide-aspect panels on large screens.
const SECTION_COMPONENTS: Record<
  GnssSectionId,
  {title: string; Comp: ComponentType<{mowerId: string | undefined}>; span2?: boolean}
> = {
  skyplot: {title: 'Skyplot', Comp: SkyplotPanel},
  signals: {title: 'Signal strength', Comp: SignalBarsPanel, span2: true},
  scatter: {title: 'C/N0 vs elevation', Comp: ScatterPanel, span2: true},
  constellations: {title: 'Constellations', Comp: ConstellationPanel},
  rtk: {title: 'RTK detail', Comp: RtkDetailSubscriber},
  heading: {title: 'Heading (dual antenna)', Comp: HeadingSubscriber},
  rf: {title: 'RF health & jamming', Comp: RfHealthSubscriber},
  map: {title: 'Position map', Comp: MapSubscriber},
  dop: {title: 'Dilution of precision', Comp: DopSubscriber},
  charts: {title: 'Trends', Comp: ChartsPanel as ComponentType<{mowerId: string | undefined}>},
  position: {title: 'Position & velocity', Comp: PositionSubscriber},
};

// A collapsible panel wrapper used in the desktop grid layout. State-only; does
// not subscribe to the stream, so it never re-renders on a sample.
function Panel({title, children}: {title: string; children: React.ReactNode}) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
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
          Detailed per-satellite data isn&apos;t available from this mower. Showing the aggregate GPS status. The full
          skyplot, signal bars and DOP breakdown need the GNSS-detail firmware/driver (<code>gnss/stream</code>).
        </Alert>
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Fix
            </Typography>
            <Box>
              <Chip label={fixTypeShort(fixType)} size="small" sx={{fontWeight: 600}} />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
              Satellites
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {sats ?? '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
              PDOP
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {pdop !== undefined ? pdop.toFixed(2) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
              Position accuracy
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {posAccuracy != null ? `${posAccuracy.toFixed(2)} m` : '—'}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// The body owns layout only. It subscribes to a single boolean (has-data) so it
// re-renders at most when the stream starts/stops, never per sample — the leaf
// panel subscribers handle live updates.
const GnssBody = memo(function GnssBody({
  mowerId,
  layout,
}: {
  mowerId: string | undefined;
  layout: Record<GnssSectionId, boolean>;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const hasGnss = useHasGnss(mowerId);

  if (!hasGnss) {
    return <GnssFallback />;
  }

  const visible = GNSS_SECTIONS.filter((s) => layout[s.id]);

  if (isMobile) {
    return (
      <Box sx={{mt: 2}}>
        <Card sx={{...outerCardStyles(theme), minWidth: 0}}>
          <CardContent>
            <HeroSubscriber mowerId={mowerId} />
          </CardContent>
        </Card>
        <Box sx={{mt: 2}}>
          {visible.map((s) => {
            const {title, Comp} = SECTION_COMPONENTS[s.id];
            return (
              <Accordion key={s.id} defaultExpanded={s.id === 'skyplot'} disableGutters>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography fontWeight={600}>{title}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Comp mowerId={mowerId} />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      </Box>
    );
  }

  // Desktop: responsive card grid. Wide-aspect panels span two columns on lg+.
  return (
    <Box sx={{mt: 2}}>
      <Card sx={{...outerCardStyles(theme), minWidth: 0, mb: 2}}>
        <CardContent>
          <HeroSubscriber mowerId={mowerId} />
        </CardContent>
      </Card>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 2,
          alignItems: 'start',
        }}
      >
        {visible.map((s) => {
          const {title, Comp, span2} = SECTION_COMPONENTS[s.id];
          return (
            <Box key={s.id} sx={{gridColumn: span2 ? {lg: 'span 2'} : undefined}}>
              <Panel title={title}>
                <Comp mowerId={mowerId} />
              </Panel>
            </Box>
          );
        })}
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
