import {strToU8, zipSync} from 'fflate';
import type {MapData} from '@/stores/schemas';
import type {MetricId, Sample} from './metrics';

// Metadata for one recorded mowing session, as returned by
// telemetry.list_sessions and rendered in the heatmap sidebar.
export interface SessionMeta {
  id: string;
  start_ts: number;
  end_ts: number;
  sample_count: number;
  file_size_bytes?: number;
  duration_s?: number;
}

type Datum = NonNullable<MapData['datum']>;

// Bumped if the on-disk layout ever changes; the standalone viewer reads this
// to stay backwards compatible with older exports.
export const HEATMAP_EXPORT_VERSION = 1;
export const HEATMAP_EXPORT_FORMAT = 'openmower-heatmap';

// Builds the self-describing archive for a single session: a small JSON
// manifest (session meta + the datum needed to project the relative metres back
// to lng/lat) plus the raw samples as JSON Lines. JSONL keeps each sample on its
// own line so the viewer can parse incrementally and a partial file still yields
// whole rows. fflate's zipSync compresses the highly repetitive JSON well, which
// matters for multi-hour mows (tens of thousands of points).
export function buildSessionZip(
  meta: SessionMeta,
  datum: Datum,
  samples: Sample[],
  metrics: readonly MetricId[],
  exportedAt: number,
): Uint8Array {
  const manifest = {
    format: HEATMAP_EXPORT_FORMAT,
    version: HEATMAP_EXPORT_VERSION,
    exported_at: exportedAt,
    session: {
      id: meta.id,
      start_ts: meta.start_ts,
      end_ts: meta.end_ts,
      sample_count: meta.sample_count,
      duration_s: meta.duration_s ?? meta.end_ts - meta.start_ts,
    },
    datum: {lat: datum.lat, long: datum.long, height: datum.height},
    metrics,
  };

  const samplesJsonl = samples.map((s) => JSON.stringify(s)).join('\n');

  return zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'samples.jsonl': strToU8(samplesJsonl),
    },
    {level: 6},
  );
}

// File-name stem derived from the session start: heatmap_2026-06-21_14-30-05.
// Colons/dots are stripped so it is a valid name on every OS.
export function sessionFileStem(meta: SessionMeta): string {
  const iso = new Date(meta.start_ts * 1000).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `heatmap_${iso}`;
}

// Triggers a browser download for raw bytes. Mirrors the Blob + <a download>
// pattern used by BatteryExportButton — no file-saver dependency needed.
export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  // Copy into a fresh ArrayBuffer-backed view so the Blob never sees a
  // SharedArrayBuffer-typed source (keeps TS's BlobPart typing happy).
  const buf = new Uint8Array(bytes);
  const blob = new Blob([buf], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
