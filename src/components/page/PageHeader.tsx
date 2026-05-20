'use client';

import {useTopBarTitleStore} from '@/stores/topBarTitleStore';
import {useUiStore, type PageHeaderStyle} from '@/stores/uiStore';
import {Box, Typography, useTheme, type SxProps} from '@mui/material';
import {PropsWithChildren, useEffect} from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  /** Override the user's global preference for this page. Rarely needed. */
  variant?: PageHeaderStyle;
  sx?: SxProps;
}

export default function PageHeader({title, subtitle, children, sx, variant}: PropsWithChildren<PageHeaderProps>) {
  const theme = useTheme();
  const userVariant = useUiStore((s) => s.pageHeaderStyle);
  const setTopBarTitle = useTopBarTitleStore((s) => s.set);
  const clearTopBarTitle = useTopBarTitleStore((s) => s.clear);
  const effective = variant ?? userVariant;

  // Minimal mode publishes the title to TopBar and renders nothing. Done in
  // an effect so route transitions reliably swap the published title even
  // when the same PageHeader instance is reused with new props.
  useEffect(() => {
    if (effective !== 'minimal') return;
    setTopBarTitle(title, subtitle);
    return () => clearTopBarTitle();
  }, [effective, title, subtitle, setTopBarTitle, clearTopBarTitle]);

  if (effective === 'minimal') {
    return null;
  }

  if (effective === 'flat') {
    return (
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          pt: {xs: 1, md: 2},
          pb: {xs: 0, md: 3},
          px: {xs: 0, md: 3},
          mt: {xs: -1, md: 0},
          position: 'relative',
          borderBottom: `1px solid ${theme.palette.divider}`,
          ...sx,
        }}
      >
        <Box sx={{px: 3}}>
          <Typography variant="h3" component="h1" gutterBottom>
            {title}
          </Typography>
          <Typography
            variant="body1"
            sx={{color: theme.palette.text.secondary, mb: 2, display: {xs: 'none', md: 'block'}}}
          >
            {subtitle}
          </Typography>
          <Box sx={{display: {xs: 'none', md: 'flex'}, flexWrap: 'wrap', gap: 3, mt: 2}}>{children}</Box>
        </Box>
      </Box>
    );
  }

  // hero (default)
  return (
    <Box
      sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
        color: 'white',
        pt: {xs: 1, md: 4},
        pb: {xs: 0, md: 6},
        px: {xs: 0, md: 3},
        mt: {xs: -1, md: 0},
        position: 'relative',
        overflow: 'hidden',
        borderRadius: {xs: '0 0 24px 24px', md: '24px'},
        boxShadow: '0 2px 12px -2px rgba(0,0,0,0.4)',
        ...sx,
      }}
    >
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <Box sx={{px: 3}}>
        <Box sx={{position: 'relative', zIndex: 1}}>
          {/* Title — relies on the brand's h2 weight (600) instead of forcing
              700 so the typography rhythm stays consistent with the rest of
              the app. */}
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{textShadow: '0 2px 4px rgba(0,0,0,0.15)'}}
          >
            {title}
          </Typography>

          {/* Subtitle */}
          <Typography variant="h5" sx={{opacity: 0.9, fontWeight: 300, mb: 3, display: {xs: 'none', md: 'block'}}}>
            {subtitle}
          </Typography>

          {/* Quick Stats */}
          <Box sx={{display: {xs: 'none', md: 'flex'}, flexWrap: 'wrap', gap: 3, mt: 4}}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}
