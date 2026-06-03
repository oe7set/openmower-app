'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import {Download as DownloadIcon} from '@mui/icons-material';
import {Button} from '@mui/material';
import {useState} from 'react';

// Sensors exported as CSV columns. Keys are om_* sensor ids; the header label
// is what lands in the CSV. Only sensors with data are emitted as columns.
const EXPORT_SENSORS: Array<{id: string; label: string}> = [
  {id: 'om_v_battery', label: 'battery_voltage_V'},
  {id: 'om_bms_current', label: 'current_A'},
  {id: 'om_bms_soc', label: 'soc_pct'},
  {id: 'om_bms_temp', label: 'temperature_C'},
  {id: 'om_bms_full_charge_capacity', label: 'full_charge_capacity_Ah'},
  {id: 'om_bms_remaining_capacity', label: 'remaining_capacity_Ah'},
  {id: 'om_bms_cycle_count', label: 'cycle_count'},
  {id: 'om_v_charge', label: 'charge_voltage_V'},
  {id: 'om_charge_current', label: 'charge_current_A'},
];

type SensorHistoryMap = {sensors?: Record<string, Array<{ts_ms: number; value: number}>>};

// Builds a CSV by merging each sensor's trailing-hour history on the timestamp
// axis. Sparse cells (a sensor with no sample at that ts) are left blank.
function buildCsv(sensors: Record<string, Array<{ts_ms: number; value: number}>>): string {
  const columns = EXPORT_SENSORS.filter(({id}) => (sensors[id]?.length ?? 0) > 0);
  if (columns.length === 0) return '';

  // Collect the union of timestamps across all exported sensors.
  const byTs = new Map<number, Record<string, number>>();
  for (const {id} of columns) {
    for (const {ts_ms, value} of sensors[id]) {
      const row = byTs.get(ts_ms) ?? {};
      row[id] = value;
      byTs.set(ts_ms, row);
    }
  }

  const timestamps = Array.from(byTs.keys()).sort((a, b) => a - b);
  const header = ['timestamp_iso', 'ts_ms', ...columns.map((c) => c.label)].join(',');
  const lines = timestamps.map((ts) => {
    const row = byTs.get(ts)!;
    const cells = columns.map(({id}) => (typeof row[id] === 'number' ? String(row[id]) : ''));
    return [new Date(ts).toISOString(), String(ts), ...cells].join(',');
  });
  return [header, ...lines].join('\n');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function BatteryExportButton() {
  const rpc = useSelectedMower((s) => s?.rpc);
  const mowerName = useSelectedMower((s) => s?.name);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    if (!rpc || busy) return;
    setBusy(true);
    try {
      const res = (await rpc.sensors.history_bulk({})) as SensorHistoryMap;
      const sensors = res.sensors ?? {};
      const csv = buildCsv(sensors);
      if (!csv) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = (mowerName ?? 'mower').replace(/[^a-z0-9_-]+/gi, '_');
      downloadCsv(`battery-${safeName}-${stamp}.csv`, csv);
    } catch {
      // Older xbot_monitoring without sensors.history_bulk — nothing to export.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={onExport} disabled={busy || !rpc}>
      {busy ? 'Exporting…' : 'Export history (CSV)'}
    </Button>
  );
}
