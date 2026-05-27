'use client';

import {useMowerConfigs} from '@/stores/configStore';
import {useSelectedMower} from '@/stores/mowersStore';
import {useUiStore} from '@/stores/uiStore';
import {Box, Drawer, List, SxProps, Theme, useTheme} from '@mui/material';
import {usePathname, useRouter} from 'next/navigation';
import {useState} from 'react';
import MowerSelector from '../mower-selector/MowerSelector';
import {createNavigationItems} from '../navigationItems';
import SelectedMower from './SelectedMower';
import SidebarHeader from './SidebarHeader';
import SidebarItem from './SidebarItem';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({open, onClose}: SidebarProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const drawerAnchor = useUiStore((s) => s.drawerAnchor);
  const sidebarCompact = useUiStore((s) => s.sidebarCompact);
  const density = useUiStore((s) => s.density);
  const [mowerMenuAnchor, setMowerMenuAnchor] = useState<null | HTMLElement>(null);
  const mowerConfigs = useMowerConfigs();
  const selectedMowerId = useSelectedMower((s) => s?.id);
  const selectedMower = mowerConfigs.find((mower) => mower.id === selectedMowerId);
  // Action items (Menu, Quick) are local triggers that only make sense in the
  // mobile bottom bar — the sidebar is itself the menu, and the Quick trigger
  // lives in the TopBar on desktop.
  const navigationItems = createNavigationItems().filter((it) => !it.isAction);

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  // The mobile (temporary) drawer always shows the full-width labelled list
  // so the menu is usable on small screens; only the permanent desktop
  // drawer collapses when sidebarCompact is on.
  const fullWidth = 280;
  const compactWidth = 72;
  const desktopWidth = sidebarCompact ? compactWidth : fullWidth;
  // Mirror the rounded outer corner so it sits flush against the viewport
  // edge on whichever side the drawer is anchored.
  const outerRadius = drawerAnchor === 'right' ? '24px 0 0 24px' : '0 24px 24px 0';

  const baseDrawerStyle: SxProps<Theme> = {
    boxShadow: '0 0 8px 4px rgba(0, 0, 0, 0.25)',
    border: 'none',
    borderRadius: outerRadius,
  };

  return (
    <>
      <Drawer
        variant="temporary"
        anchor={drawerAnchor}
        open={open}
        onClose={onClose}
        ModalProps={{keepMounted: true}}
        sx={{
          display: {xs: 'block', md: 'none'},
          '& .MuiDrawer-paper': {...baseDrawerStyle, width: fullWidth},
        }}
      >
        <SidebarContent compact={false} />
      </Drawer>

      <Drawer
        variant="permanent"
        anchor={drawerAnchor}
        sx={{
          display: {xs: 'none', md: 'block'},
          '& .MuiDrawer-paper': {
            ...baseDrawerStyle,
            width: desktopWidth,
            position: 'fixed',
            height: 'calc(100vh - 16px)',
            zIndex: theme.zIndex.drawer,
            my: 1,
          },
        }}
        open
      >
        <SidebarContent compact={sidebarCompact} />
      </Drawer>

      <Box sx={{display: {xs: 'none', md: 'block'}, width: desktopWidth, flexShrink: 0}} />

      <MowerSelector anchorEl={mowerMenuAnchor} onClose={() => setMowerMenuAnchor(null)} />
    </>
  );

  function SidebarContent({compact}: {compact: boolean}) {
    return (
      <Box sx={{height: '100%', display: 'flex', flexDirection: 'column', userSelect: 'none'}}>
        <SidebarHeader compact={compact} />
        <Box sx={{flex: 1, overflow: 'auto'}}>
          <List sx={{py: 1}} dense={density === 'compact'}>
            {navigationItems.map((item) => (
              <SidebarItem
                key={item.path}
                item={item}
                isActive={pathname === item.path}
                onClick={handleNavigation}
                compact={compact}
                density={density}
              />
            ))}
          </List>
        </Box>
        {selectedMower && !compact && (
          <SelectedMower
            selectedMower={selectedMower}
            showSwitcher={mowerConfigs.length > 1}
            onMowerMenuOpen={(e) => setMowerMenuAnchor(e.currentTarget)}
          />
        )}
      </Box>
    );
  }
}
