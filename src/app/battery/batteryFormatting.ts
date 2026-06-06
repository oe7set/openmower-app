import type {BmsTelemetry} from '@/stores/schemas';

// Per-cell imbalance thresholds (in volts). A healthy multi-cell Li-ion pack
// usually balances within a few millivolts; tens of millivolts hints at a weak
// cell or an in-progress balance. Used to colour the cell bars and the delta.
export const CELL_DELTA_WARN_V = 0.05; // 50 mV
export const CELL_DELTA_ERROR_V = 0.12; // 120 mV

export type CellBalanceStatus = 'success' | 'warning' | 'error';

export function cellDeltaStatus(deltaV: number): CellBalanceStatus {
  if (deltaV >= CELL_DELTA_ERROR_V) return 'error';
  if (deltaV >= CELL_DELTA_WARN_V) return 'warning';
  return 'success';
}

export interface CellStats {
  min: number;
  max: number;
  /** Spread between the strongest and weakest cell, in volts. */
  delta: number;
  /** Index (0-based) of the lowest cell, or -1 when there are no cells. */
  minIndex: number;
  /** Index (0-based) of the highest cell, or -1 when there are no cells. */
  maxIndex: number;
  avg: number;
}

// Summary stats over an array of cell voltages. Returns null when empty so the
// caller can render an "n/a" state instead of NaN.
export function computeCellStats(cells: readonly number[] | undefined): CellStats | null {
  if (!cells || cells.length === 0) return null;
  let min = cells[0];
  let max = cells[0];
  let minIndex = 0;
  let maxIndex = 0;
  let sum = 0;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v < min) {
      min = v;
      minIndex = i;
    }
    if (v > max) {
      max = v;
      maxIndex = i;
    }
    sum += v;
  }
  return {min, max, delta: max - min, minIndex, maxIndex, avg: sum / cells.length};
}

// State of Health as a 0..1 ratio. Prefers the capacity-based definition
// (current full-charge capacity / design capacity); falls back to the BMS's
// AbsoluteStateOfCharge vs RelativeStateOfCharge ratio when capacities are
// missing. Returns null when neither source is available so the UI can hide
// the panel rather than show a misleading 100%.
export function computeSoh(t: BmsTelemetry | undefined): number | null {
  if (!t) return null;
  if (
    typeof t.full_charge_capacity === 'number' &&
    typeof t.design_capacity_ah === 'number' &&
    t.design_capacity_ah > 0 &&
    t.full_charge_capacity > 0
  ) {
    return t.full_charge_capacity / t.design_capacity_ah;
  }
  if (
    typeof t.absolute_soc === 'number' &&
    typeof t.relative_state_of_charge === 'number' &&
    t.relative_state_of_charge > 0 &&
    t.absolute_soc > 0
  ) {
    // abs SoC is charge vs design capacity, rel SoC is charge vs current full
    // capacity; their ratio approximates how much of the design capacity remains.
    return t.absolute_soc / t.relative_state_of_charge;
  }
  return null;
}

export type ChargeFlow = 'charging' | 'discharging' | 'idle';

// Classifies pack current into a charge-flow direction. Bms.current is positive
// while charging (matches the Sabo BMS firmware, sabo_bms_driver.cpp); a small
// dead-band avoids flickering around zero.
export function chargeFlow(currentA: number | undefined): ChargeFlow {
  if (typeof currentA !== 'number') return 'idle';
  const deadband = 0.05; // A
  if (currentA > deadband) return 'charging';
  if (currentA < -deadband) return 'discharging';
  return 'idle';
}

// Fixed-precision value with unit, hiding the value entirely when undefined.
export function fmtUnit(value: number | undefined, unit: string, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} ${unit}`.trim();
}
