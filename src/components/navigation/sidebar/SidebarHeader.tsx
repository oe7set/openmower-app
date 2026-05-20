import {Box, useTheme} from '@mui/material';
import Image from 'next/image';

interface SidebarHeaderProps {
  compact?: boolean;
}

export default function SidebarHeader({compact = false}: SidebarHeaderProps) {
  const theme = useTheme();

  if (compact) {
    // Crop the wordmark to the icon-only area on the left of the SVG so it
    // still reads as a brand mark inside the 72px rail.
    return (
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          height: 70,
          width: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image src="/logo.svg" width={230} height={70} alt="OpenMower" priority style={{objectPosition: 'left center', objectFit: 'none'}} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        textAlign: 'center',
        pr: 2,
        pointerEvents: 'none',
      }}
    >
      <Image src="/logo.svg" width={230} height={70} alt="OpenMower" priority />
    </Box>
  );
}
