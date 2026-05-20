'use client';

import {useUiStore} from '@/stores/uiStore';
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
  const bottomBarItems = useUiStore((s) => s.bottomBarItems);
  const density = useUiStore((s) => s.density);

  // Look up each saved path against the current navigation list. Drop any
  // misses so a path that gets renamed in code (or that this user once
  // pinned but is no longer registered) silently disappears instead of
  // breaking the bar. Order is taken from the user's saved array.
  const allItems = createNavigationItems();
  const navigationItems = bottomBarItems
    .map((path) => allItems.find((it) => it.path === path))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  const activeIndex = navigationItems.findIndex((item) => item.path === pathname);
  const value: number | 'menu' = activeIndex === -1 ? 'menu' : activeIndex;

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleMenuClick = () => {
    onMenuOpen();
  };

  return (
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
          minHeight: density === 'compact' ? 48 : 56,
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
  );
}
