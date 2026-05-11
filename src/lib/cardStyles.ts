import type {Theme} from '@mui/material/styles';

// Translucent card used for floating overlays (map AreasList, popup, etc.).
// Reads colours from the active palette so light/dark stays consistent and
// the brand surface tokens flow through.
export const outerCardStyles = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: 2,
    boxShadow: isDark ? '0 0 12px -2px rgba(0,0,0,0.8)' : '0 0 12px -2px rgba(0,0,0,0.25)',
    border: `1px solid ${theme.palette.divider}`,
    background: isDark
      ? // alpha-applied paper to keep map visible behind overlays
        `color-mix(in srgb, ${theme.palette.background.paper} 85%, transparent)`
      : `color-mix(in srgb, ${theme.palette.background.paper} 88%, transparent)`,
    backdropFilter: 'blur(10px)',
  };
};

export const innerCardStyles = {
  borderRadius: 1,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  boxShadow: '0 4px 16px -2px rgba(0,0,0,0.3)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
};
