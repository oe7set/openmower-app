import {Box, useTheme} from '@mui/material';
import Image from 'next/image';

interface SidebarHeaderProps {
  compact?: boolean;
}

export default function SidebarHeader({compact = false}: SidebarHeaderProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        textAlign: 'center',
        pr: compact ? 0 : 2,
        pointerEvents: 'none',
        // Compact mode crops the logo to the icon-only area on the left of
        // the SVG so it still reads as a brand mark inside the 72px rail.
        overflow: 'hidden',
        height: 70,
      }}
    >
      <Image
        src="/logo.svg"
        width={compact ? 70 : 230}
        height={70}
        alt="OpenMower"
        priority
        style={{
          objectFit: 'cover',
          objectPosition: 'left center',
          height: 70,
          width: compact ? 70 : 230,
        }}
      />
    </Box>
  );
}
