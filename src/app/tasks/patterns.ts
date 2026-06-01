// Coverage fill patterns selectable per appointment. The string values mirror
// the `overrides.pattern` enum in openrpc.json and the scheduler's
// VALID_PATTERNS; the integer values map onto the slic3r_coverage_planner
// PlanPath fill enum consumed by MowingBehavior:
//   linear            -> FILL_LINEAR (0)
//   concentric_lines  -> FILL_CONCENTRIC (1)        follows the area outline
//   concentric_circle -> FILL_CONCENTRIC_CIRCLE (2) Archimedean spiral
//   hilbert           -> FILL_HILBERT (3)
import type {MowPattern} from './ScheduleEditor';

export interface PatternOption {
  value: MowPattern;
  label: string;
  description: string;
}

export const MOW_PATTERNS: ReadonlyArray<PatternOption> = [
  {value: 'linear', label: 'Linear', description: 'Parallel stripes at the mowing angle.'},
  {
    value: 'concentric_lines',
    label: 'Concentric',
    description: 'Nested loops following the area outline.',
  },
  {
    value: 'concentric_circle',
    label: 'Concentric circle',
    description: 'Archimedean spiral, independent of the area shape.',
  },
  {value: 'hilbert', label: 'Hilbert', description: 'Space-filling Hilbert curve.'},
];

const LABEL_BY_VALUE = new Map<MowPattern, string>(MOW_PATTERNS.map((p) => [p.value, p.label]));

export function patternLabel(pattern: MowPattern | undefined | null): string {
  if (!pattern) return 'Default';
  return LABEL_BY_VALUE.get(pattern) ?? pattern;
}
