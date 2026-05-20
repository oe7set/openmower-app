'use client';

import {useUiStore} from '@/stores/uiStore';
import {Box, type SxProps} from '@mui/material';
import {PropsWithChildren} from 'react';

interface PageContentProps {
  sx?: SxProps;
}

export default function PageContent({children, sx}: PropsWithChildren<PageContentProps>) {
  // The hero PageHeader has a tall curved bottom; pulling content up with
  // mt:-6 lets cards tuck under that curve on desktop. The flat and minimal
  // variants have no curve (or no header at all), so the same negative
  // margin overlaps the title. Only apply the pull-up for the hero.
  const pageHeaderStyle = useUiStore((s) => s.pageHeaderStyle);
  const desktopMt = pageHeaderStyle === 'hero' ? -6 : 2;

  return (
    <Box
      sx={{
        mx: {xs: 0, md: 2},
        mt: {xs: 1, md: desktopMt},
        position: 'relative',
        zIndex: 2,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
