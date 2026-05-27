'use client';

import {useQuickActionsStore, type QuickActionsState} from '@/stores/quickActionsStore';
import {useUiStore} from '@/stores/uiStore';
import {BottomNavigation, BottomNavigationAction, Paper, useTheme} from '@mui/material';
import {usePathname, useRouter} from 'next/navigation';
import {NAV_ACTION_MENU, NAV_ACTION_QUICK, createNavigationItems} from './navigationItems';

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
  const value: number | false = activeIndex === -1 ? false : activeIndex;

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
          const item = navigationItems[newValue as number];
          if (!item) return;
          if (item.path === NAV_ACTION_MENU) {
            onMenuOpen();
          } else if (item.path === NAV_ACTION_QUICK) {
            openQuickActions();
          } else {
            router.push(item.path);
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
        {navigationItems.map((item, idx) => {
          // Action triggers get a distinct hue so they read as "do something
          // now" rather than "you are here". Menu mirrors the secondary
          // palette (matches the burger style elsewhere); Quick uses the
          // primary accent so it lines up visually with the dashboard's
          // Start button.
          const sx =
            item.path === NAV_ACTION_MENU
              ? {color: theme.palette.secondary.main, '&.Mui-selected': {color: theme.palette.secondary.main}}
              : item.path === NAV_ACTION_QUICK
              ? {color: theme.palette.primary.main}
              : undefined;
          return (
            <BottomNavigationAction key={item.path} value={idx} label={item.label} icon={item.icon} sx={sx} />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
