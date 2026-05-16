// WLAN signal helpers shared by the dashboard WifiCard and the drive
// telemetry strip. Keeping the dBm-to-quality math here avoids the two
// surfaces drifting apart over time.

// Maps a WLAN signal in dBm to a 0..100 quality. -50dBm = great, -90dBm = bad.
// dbm === 0 is the firmware's "N/A" sentinel (Ethernet-only host or the
// /proc/net/wireless entry was missing) — callers must filter that out before
// invoking this function, otherwise 0 dBm would naively map to 100 %.
export function dbmToQuality(dbm: number): number {
  if (dbm >= -50) return 100;
  if (dbm <= -90) return 0;
  return Math.round(((dbm + 90) / 40) * 100);
}

export type WifiQualityColor = 'success' | 'warning' | 'error';

export function qualityColor(q: number): WifiQualityColor {
  if (q >= 75) return 'success';
  if (q >= 40) return 'warning';
  return 'error';
}

// Resolves a 0..100 link quality from the optional dbm + link fields published
// by xbot_monitoring. Returns null if the firmware reports the "no WLAN
// interface" sentinel (both fields absent or zeroed) so callers can decide to
// hide the indicator entirely.
export function resolveWifiQuality(
  dbm: number | undefined,
  link: number | undefined,
): {quality: number; signalDbm: number | null; linkRatio: number | null} | null {
  const dbmNa = dbm === undefined || dbm === 0;
  const linkNa = link === undefined || link === 0;
  if (dbmNa && linkNa) return null;

  const quality = !linkNa
    ? Math.round((link as number) * 100)
    : !dbmNa
      ? dbmToQuality(dbm as number)
      : 0;

  return {
    quality,
    signalDbm: !dbmNa ? (dbm as number) : null,
    linkRatio: !linkNa ? (link as number) : null,
  };
}
