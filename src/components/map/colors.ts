// Centralised map-overlay palette.
// Colours are derived from the active MUI theme so they stay in sync with the
// brand greens / accents and adapt to dark mode without per-component overrides.

import type {Theme} from '@mui/material/styles';

export interface MapPalette {
  /** Historical mowed trail (already-cut areas). */
  trail: string;
  /** Coverage planner output — the path the planner intends to drive. */
  coverage: string;
  /** Live planned path from move_base_flex (next few metres). */
  planned: string;
  /** On-demand coverage preview — the fill passes slic3r would mow. */
  previewFill: string;
  /** On-demand coverage preview — the perimeter/outline passes. */
  previewOutline: string;
}

export function mapPalette(theme: Theme): MapPalette {
  return {
    trail: theme.palette.success.light,
    coverage: theme.palette.info.main,
    planned: theme.palette.warning.main,
    previewFill: theme.palette.secondary.main,
    previewOutline: theme.palette.secondary.dark,
  };
}
