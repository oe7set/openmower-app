'use client';

import {GNSS_BEIDOU, GNSS_GALILEO, GNSS_GLONASS, GNSS_GPS, GNSS_QZSS} from '@/lib/gnss';

// Small inline-SVG constellation flags, UPrecise-style. Emoji regional-indicator
// flags do not render as flags on Windows browsers (they show "US"/"RU" letter
// pairs), so we draw the operating agency's flag as an SVG instead — identical on
// every platform. SBAS and unknown systems are multi-national, so they get a
// neutral satellite glyph rather than a country flag.
//
// Flags are simplified to read cleanly at ~16px. viewBox is a 3:2 field with a
// subtle border so light flags (e.g. Japan) stay visible on a light card.

interface FlagProps {
  size?: number;
}

const W = 24;
const H = 16;

function Frame({children}: {children: React.ReactNode}) {
  return (
    <>
      {children}
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
    </>
  );
}

// United States (GPS) — simplified: red/white stripes + blue canton.
function UsFlag() {
  return (
    <Frame>
      <rect width={W} height={H} fill="#fff" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} y={(i * H) / 7} width={W} height={H / 7} fill="#b22234" />
      ))}
      <rect width={W * 0.42} height={(H / 7) * 4} fill="#3c3b6e" />
    </Frame>
  );
}

// Russia (GLONASS) — white/blue/red horizontal tricolour.
function RuFlag() {
  return (
    <Frame>
      <rect width={W} height={H / 3} y={0} fill="#fff" />
      <rect width={W} height={H / 3} y={H / 3} fill="#0039a6" />
      <rect width={W} height={H / 3} y={(2 * H) / 3} fill="#d52b1e" />
    </Frame>
  );
}

// European Union (Galileo) — blue field with a ring of stars (simplified to a
// circle of small dots).
function EuFlag() {
  const cx = W / 2;
  const cy = H / 2;
  const r = 4.6;
  return (
    <Frame>
      <rect width={W} height={H} fill="#003399" />
      {Array.from({length: 12}, (_, i) => {
        const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
        return <circle key={i} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={0.9} fill="#ffcc00" />;
      })}
    </Frame>
  );
}

// China (BeiDou) — red field with one large + four small yellow stars
// (simplified to dots so they read at small size).
function CnFlag() {
  return (
    <Frame>
      <rect width={W} height={H} fill="#de2910" />
      <circle cx={5} cy={4.5} r={2.2} fill="#ffde00" />
      <circle cx={9.5} cy={2} r={0.9} fill="#ffde00" />
      <circle cx={11} cy={4.5} r={0.9} fill="#ffde00" />
      <circle cx={11} cy={7.5} r={0.9} fill="#ffde00" />
      <circle cx={9.5} cy={10} r={0.9} fill="#ffde00" />
    </Frame>
  );
}

// Japan (QZSS) — white field with a central red disc.
function JpFlag() {
  return (
    <Frame>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={W / 2} cy={H / 2} r={4.4} fill="#bc002d" />
    </Frame>
  );
}

// Neutral satellite glyph for SBAS / unknown (no single operating nation).
function SatGlyph() {
  return (
    <Frame>
      <rect width={W} height={H} fill="#607d8b" />
      <circle cx={W / 2} cy={H / 2} r={2.4} fill="#fff" />
      <rect x={3} y={H / 2 - 1} width={4} height={2} fill="#fff" />
      <rect x={W - 7} y={H / 2 - 1} width={4} height={2} fill="#fff" />
    </Frame>
  );
}

const FLAG_BY_ID: Record<number, () => React.ReactElement> = {
  [GNSS_GPS]: UsFlag,
  [GNSS_GLONASS]: RuFlag,
  [GNSS_GALILEO]: EuFlag,
  [GNSS_BEIDOU]: CnFlag,
  [GNSS_QZSS]: JpFlag,
};

// Render the constellation's flag as a crisp inline SVG. Falls back to a neutral
// satellite glyph for SBAS and any unknown system.
export default function ConstellationFlag({gnssId, size = 16}: FlagProps & {gnssId: number}) {
  const Flag = FLAG_BY_ID[gnssId] ?? SatGlyph;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      style={{display: 'block', borderRadius: 2, flexShrink: 0}}
      aria-hidden
    >
      <Flag />
    </svg>
  );
}
