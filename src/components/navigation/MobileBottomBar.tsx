'use client';

import {Menu as MenuIcon} from '@mui/icons-material';
import {BottomNavigation, BottomNavigationAction, Paper, useTheme} from '@mui/material';
import {usePathname, useRouter} from 'next/navigation';
import {createNavigationItems} from './navigationItems';

interface MobileBottomBarProps {
  onMenuOpen: () => void;
}

export default function MobileBottomBar({onMenuOpen}: MobileBottomBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const navigationItems = createNavigationItems().filter((item) => item.isPrimary);
  const activeIndex = navigationItems.findIndex((item) => item.path === pathname);
  const value: number | 'menu' = activeIndex === -1 ? 'menu' : activeIndex;

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleMenuClick = () => {
    onMenuOpen();
  };

  return (
    <>
      {/* Bottom Navigation for Mobile */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          // Sits at appBar level — map overlays use a dedicated higher band
          // (see src/components/map/zIndex.ts) so floating panels and the
          // joystick stay on top on mobile.
          zIndex: theme.zIndex.appBar,
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -2px 12px -2px rgba(0,0,0,0.2)',
          border: `1px solid ${theme.palette.divider}`,
          borderBottom: 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: {xs: 'block', md: 'none'},
        }}
      >
        <BottomNavigation
          value={value}
          onChange={(_, newValue) => {
            if (newValue === 'menu') {
              handleMenuClick();
            } else {
              handleNavigation(navigationItems[newValue].path);
            }
          }}
          sx={{
            bgcolor: 'transparent',
            '& .MuiBottomNavigationAction-root': {
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                color: theme.palette.primary.main,
              },
            },
          }}
        >
          <BottomNavigationAction
            label="Menu"
            icon={<MenuIcon />}
            value="menu"
            sx={{
              '&.Mui-selected': {
                color: theme.palette.secondary.main,
              },
            }}
          />
          {navigationItems.map((item, idx) => (
            <BottomNavigationAction key={item.path} value={idx} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
}
