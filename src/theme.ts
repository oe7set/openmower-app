'use client';

// OpenMower brand theme.
// Source of truth for the design tokens lives in
// `D:\Projekte\OpenMower\design-openmower-branding\` — kept in sync manually
// because we don't ship it as an npm package.
//
// The brand kit only defines a light palette. Dark mode is derived here so
// brand greens stay identical (good contrast on both surfaces) while
// surfaces, borders and text invert.

import {createTheme, type Components, type PaletteOptions, type Theme} from '@mui/material/styles';

// ── Tokens ────────────────────────────────────────────────────────────────

const tokens = {
  // Brand greens — used identically in light and dark mode.
  primaryMain: '#1B9D52',
  primaryLight: '#2CC76B',
  primaryDark: '#14853F',
  accentGreen: '#2CC76B',
  accentGreenDeep: '#1EA856',
  accentGreenLight: '#3DD97E',
  accentAmber: '#F5A523',

  // Semantic
  error: '#C93020',
  warning: '#F5A523',
  info: '#1565C0',
  success: '#1B9D52',

  // Light-mode surfaces / text / borders
  light: {
    bgDefault: '#FFFFFF',
    bgPaper: '#FFFFFF',
    surface2: '#EFEFEF',
    surface3: '#E5E5E5',
    textPrimary: '#1A1A1A',
    textSecondary: '#555555',
    textDisabled: '#9E9E9E',
    borderSubtle: '#E0E0E0',
    borderDefault: '#CACACA',
  },
  // Dark-mode surfaces / text / borders — derived to match brand
  dark: {
    bgDefault: '#0E0F10',
    bgPaper: '#161819',
    surface2: '#1F2123',
    surface3: '#25282A',
    textPrimary: '#ECECEC',
    textSecondary: '#B8B8B8',
    textDisabled: '#6B6B6B',
    borderSubtle: 'rgba(255,255,255,0.08)',
    borderDefault: 'rgba(255,255,255,0.14)',
    // Slightly lighter info on dark surfaces for AA contrast
    info: '#7AB8FF',
  },
} as const;

// Public access to the raw brand colors so non-MUI components (SVG, etc.)
// can stay theme-agnostic when needed.
export const brandColors = {
  green: tokens.accentGreen,
  greenDeep: tokens.accentGreenDeep,
  greenLight: tokens.accentGreenLight,
  amber: tokens.accentAmber,
} as const;

// Background colors used by the pre-hydration script in layout.tsx.
// Exporting them so the script and the runtime stay in sync.
export const PRE_HYDRATION_BG = {
  light: tokens.light.bgDefault,
  dark: tokens.dark.bgDefault,
} as const;

// ── Palette builder ───────────────────────────────────────────────────────

function buildPalette(mode: 'light' | 'dark'): PaletteOptions {
  const surfaces = mode === 'light' ? tokens.light : tokens.dark;
  const infoMain = mode === 'light' ? tokens.info : tokens.dark.info;
  return {
    mode,
    primary: {
      main: tokens.primaryMain,
      light: tokens.primaryLight,
      dark: tokens.primaryDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: tokens.accentAmber,
      contrastText: '#1A1A1A',
    },
    error: {main: tokens.error, contrastText: '#FFFFFF'},
    warning: {main: tokens.warning, contrastText: '#1A1A1A'},
    info: {main: infoMain, contrastText: '#FFFFFF'},
    success: {
      main: tokens.success,
      light: tokens.accentGreenLight,
      dark: tokens.accentGreenDeep,
      contrastText: '#FFFFFF',
    },
    background: {
      default: surfaces.bgDefault,
      paper: surfaces.bgPaper,
    },
    text: {
      primary: surfaces.textPrimary,
      secondary: surfaces.textSecondary,
      disabled: surfaces.textDisabled,
    },
    divider: surfaces.borderSubtle,
  };
}

// ── Typography (brand) ────────────────────────────────────────────────────

const typography = {
  // The DM Sans next/font/google instance exposes its CSS variable as
  // --font-dm-sans (set in src/app/layout.tsx).
  fontFamily: '"DM Sans", "DM Sans Variable", system-ui, sans-serif',
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  h1: {fontSize: '2.625rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1},
  h2: {fontSize: '1.875rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2},
  h3: {fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.3},
  h4: {fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4},
  h5: {fontSize: '1rem', fontWeight: 600, lineHeight: 1.5},
  h6: {fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5},
  subtitle1: {fontSize: '1rem', fontWeight: 500, lineHeight: 1.6},
  subtitle2: {fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.6},
  body1: {fontSize: '1rem', fontWeight: 400, lineHeight: 1.7},
  body2: {fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.6},
  caption: {fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.08em', lineHeight: 1.5},
  overline: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    lineHeight: 2,
  },
  button: {
    fontSize: '0.9375rem',
    fontWeight: 500,
    letterSpacing: '0.01em',
    textTransform: 'none' as const,
  },
} as const;

// ── Component overrides (theme-aware) ─────────────────────────────────────
// The branding kit's components.ts reads its colors from a closure over
// `brand`. We can't do that here cleanly across two modes, so we use MUI's
// callback style overrides ({theme}) => ({...}) to read the active palette.
// This keeps the override logic identical for both modes.

const components: Components<Theme> = {
  MuiCssBaseline: {
    styleOverrides: ({palette}) => ({
      body: {
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        scrollBehavior: 'smooth',
      },
      ':root': {
        colorScheme: palette.mode,
      },
      '.font-mono': {
        fontFamily: '"DM Mono", monospace',
      },
    }),
  },

  MuiButton: {
    defaultProps: {disableElevation: true},
    styleOverrides: {
      root: {borderRadius: 8, fontWeight: 500, lineHeight: 1, transition: 'all 0.15s ease'},
      sizeSmall: {padding: '7px 15px', fontSize: '0.8125rem', borderRadius: 6},
      sizeMedium: {padding: '10px 22px'},
      sizeLarge: {padding: '14px 30px', fontSize: '1.0625rem', borderRadius: 10},
      containedPrimary: ({theme}) => ({
        color: '#FFFFFF',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        '&:hover': {
          background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
        },
      }),
      outlinedPrimary: {
        borderWidth: 1.5,
        '&:hover': {borderWidth: 1.5, backgroundColor: 'rgba(44,199,107,0.08)'},
      },
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        transition: 'all 0.15s ease',
        '&:hover': {backgroundColor: 'rgba(44,199,107,0.08)'},
      },
    },
  },

  MuiChip: {
    styleOverrides: {
      root: {borderRadius: 20, fontWeight: 500, fontSize: '0.75rem'},
      colorPrimary: ({theme}) => ({
        backgroundColor: 'rgba(44,199,107,0.14)',
        color: theme.palette.primary.main,
      }),
    },
  },

  MuiCard: {
    styleOverrides: {
      root: ({theme}) => ({
        backgroundImage: 'none',
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 12,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)'
            : '0 2px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
      }),
    },
  },

  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: '20px 22px',
        '&:last-child': {paddingBottom: 20},
      },
    },
  },

  MuiPaper: {
    styleOverrides: {
      root: ({theme}) => ({
        backgroundImage: 'none',
        backgroundColor: theme.palette.background.paper,
      }),
      elevation0: {boxShadow: 'none'},
    },
  },

  MuiAppBar: {
    defaultProps: {elevation: 0},
    styleOverrides: {
      root: ({theme}) => ({
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundImage: 'none',
      }),
    },
  },

  MuiDrawer: {
    styleOverrides: {
      paper: ({theme}) => ({
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        border: 'none',
        borderRight: `1px solid ${theme.palette.divider}`,
      }),
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({theme}) => ({
        backgroundImage: 'none',
        backgroundColor: theme.palette.mode === 'dark' ? tokens.dark.surface2 : theme.palette.background.paper,
      }),
    },
  },

  MuiPopover: {
    styleOverrides: {
      paper: ({theme}) => ({
        backgroundImage: 'none',
        backgroundColor: theme.palette.mode === 'dark' ? tokens.dark.surface2 : theme.palette.background.paper,
      }),
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: ({theme}) => ({
        backgroundImage: 'none',
        backgroundColor: theme.palette.mode === 'dark' ? tokens.dark.surface2 : theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 10,
      }),
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        margin: '2px 6px',
        fontSize: '0.9375rem',
        '&:hover': {backgroundColor: 'rgba(44,199,107,0.08)'},
        '&.Mui-selected': {
          backgroundColor: 'rgba(44,199,107,0.12)',
          '&:hover': {backgroundColor: 'rgba(44,199,107,0.16)'},
        },
      },
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: ({theme}) => ({
        borderRadius: 8,
        backgroundColor: theme.palette.mode === 'dark' ? tokens.dark.surface2 : tokens.light.surface2,
        '& .MuiOutlinedInput-notchedOutline': {borderColor: theme.palette.divider},
        '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: tokens.accentGreen},
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: tokens.accentGreen,
          borderWidth: 1.5,
        },
      }),
    },
  },

  MuiSwitch: {
    styleOverrides: {
      root: {
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: tokens.accentGreen,
          '& + .MuiSwitch-track': {backgroundColor: tokens.accentGreenDeep, opacity: 0.8},
        },
      },
    },
  },

  MuiTooltip: {
    styleOverrides: {
      tooltip: ({theme}) => ({
        backgroundColor: theme.palette.mode === 'dark' ? tokens.dark.surface3 : tokens.light.surface3,
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        fontSize: '0.8125rem',
        borderRadius: 8,
        padding: '6px 12px',
      }),
      arrow: ({theme}) => ({
        color: theme.palette.mode === 'dark' ? tokens.dark.surface3 : tokens.light.surface3,
      }),
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: {borderRadius: 10, border: '1px solid'},
      standardSuccess: ({theme}) => ({
        backgroundColor: 'rgba(44,199,107,0.10)',
        borderColor: 'rgba(44,199,107,0.25)',
        color: theme.palette.text.primary,
        '& .MuiAlert-icon': {color: theme.palette.success.main},
      }),
      standardError: ({theme}) => ({
        backgroundColor: 'rgba(201,48,32,0.10)',
        borderColor: 'rgba(201,48,32,0.25)',
        color: theme.palette.text.primary,
        '& .MuiAlert-icon': {color: theme.palette.error.main},
      }),
      standardWarning: ({theme}) => ({
        backgroundColor: 'rgba(245,165,35,0.10)',
        borderColor: 'rgba(245,165,35,0.25)',
        color: theme.palette.text.primary,
        '& .MuiAlert-icon': {color: theme.palette.warning.main},
      }),
      standardInfo: ({theme}) => ({
        backgroundColor: 'rgba(122,184,255,0.10)',
        borderColor: 'rgba(122,184,255,0.25)',
        color: theme.palette.text.primary,
        '& .MuiAlert-icon': {color: theme.palette.info.main},
      }),
    },
  },

  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        '&:hover': {backgroundColor: 'rgba(44,199,107,0.06)'},
        '&.Mui-selected': {
          backgroundColor: 'rgba(44,199,107,0.12)',
          '&:hover': {backgroundColor: 'rgba(44,199,107,0.16)'},
        },
      },
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: ({theme}) => ({borderBottom: `1px solid ${theme.palette.divider}`}),
      indicator: {backgroundColor: tokens.accentGreen, height: 2},
    },
  },

  MuiTab: {
    styleOverrides: {
      root: ({theme}) => ({
        color: theme.palette.text.secondary,
        fontWeight: 500,
        textTransform: 'none',
        fontSize: '0.9375rem',
        '&.Mui-selected': {color: theme.palette.text.primary},
      }),
    },
  },

  MuiSlider: {
    styleOverrides: {
      root: ({theme}) => ({
        color: tokens.accentGreen,
        '& .MuiSlider-rail': {backgroundColor: theme.palette.divider, opacity: 1},
        '& .MuiSlider-thumb': {
          backgroundColor: theme.palette.primary.main,
          '&:hover, &.Mui-focusVisible': {boxShadow: '0 0 0 8px rgba(44,199,107,0.16)'},
        },
      }),
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: ({theme}) => ({
        borderRadius: 2,
        backgroundColor: theme.palette.divider,
        height: 4,
      }),
      barColorPrimary: {backgroundColor: tokens.accentGreen, borderRadius: 2},
    },
  },

  MuiTableHead: {
    styleOverrides: {
      root: ({theme}) => ({
        '& .MuiTableCell-root': {
          backgroundColor: theme.palette.mode === 'dark' ? tokens.dark.surface2 : tokens.light.surface2,
          color: theme.palette.text.secondary,
          fontWeight: 600,
          fontSize: '0.6875rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderColor: theme.palette.divider,
        },
      }),
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: ({theme}) => ({borderColor: theme.palette.divider}),
    },
  },
};

// ── Theme builder ─────────────────────────────────────────────────────────

function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: buildPalette(mode),
    typography,
    shape: {borderRadius: 12},
    components,
  });
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');

export default lightTheme;
