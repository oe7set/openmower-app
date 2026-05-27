'use client';

import {useQuickActionsStore, type QuickActionsState} from '@/stores/quickActionsStore';
import {useUiStore} from '@/stores/uiStore';
import {Bolt as BoltIcon, Menu as MenuIcon} from '@mui/icons-material';
import {BottomNavigation, BottomNavigationAction, Paper, useTheme} from '@mui/material';
import {usePathname, useRouter} from 'next/navigation';
import {createNavigationItems} from './navigationItems';

interface MobileBottomBarProps {
  onMenuOpen: () => void;
}

const selectOpenSheet = (s: QuickActionsState) => s.openSheet;

export default function MobileBottomBar({onMenuOpen}: MobileBottomBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const bottomBarItems = useUiStore((s) => s.bottomBarItems);
  const density = useUiStore((s) => s.density);
  const openQuickActions = useQuickActionsStore(selectOpenSheet);

  // Look up each saved path against the current navigation list. Drop any
  // misses so a path that gets renamed in code (or that this user once
  // pinned but is no longer registered) silently disappears instead of
  // breaking the bar. Order is taken from the user's saved array.
  const allItems = createNavigationItems();
  const navigationItems = bottomBarItems
    .map((path) => allItems.find((it) => it.path === path))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  const activeIndex = navigationItems.findIndex((item) => item.path === pathname);
  const value: number | 'menu' | 'quick' = activeIndex === -1 ? 'menu' : activeIndex;

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
          } else if (newValue === 'quick') {
            openQuickActions();
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
        <BottomNavigationAction
          label="Quick"
          icon={<BoltIcon />}
          value="quick"
          sx={{
            // Distinguish from the Menu entry — pulling the same secondary
            // hue would make them indistinguishable at a glance. The accent
            // ('primary') matches the dashboard Start button so users can
            // map the icon to "do something now".
            color: theme.palette.primary.main,
          }}
        />
        {navigationItems.map((item, idx) => (
          <BottomNavigationAction key={item.path} value={idx} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
