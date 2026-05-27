import {type NavigationItem} from '@/components/types';
import {
  BarChart as StatsIcon,
  Bolt as BoltIcon,
  BugReport as BugReportIcon,
  Dashboard as DashboardIcon,
  Description as LogsIcon,
  Map as MapIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Sensors as SensorIcon,
  Settings as SettingsIcon,
  SportsEsports as DriveIcon,
  Assignment as TaskIcon,
  Whatshot as HeatmapIcon,
} from '@mui/icons-material';

// Pseudo-paths used by the mobile bottom bar to dispatch local triggers
// instead of routing. The double-underscore prefix is a deliberate marker
// that this is not a real route.
export const NAV_ACTION_MENU = '__menu__';
export const NAV_ACTION_QUICK = '__quick__';

export function createNavigationItems(): NavigationItem[] {
  return [
    {label: 'Menu', icon: <MenuIcon />, path: NAV_ACTION_MENU, isGlobal: false, isAction: true},
    {label: 'Quick', icon: <BoltIcon />, path: NAV_ACTION_QUICK, isGlobal: false, isAction: true},
    {label: 'Dashboard', icon: <DashboardIcon />, path: '/', isGlobal: true, isPrimary: true},
    {label: 'Map', icon: <MapIcon />, path: '/map', isGlobal: false, isPrimary: true},
    {label: 'Drive', icon: <DriveIcon />, path: '/drive', isGlobal: false, isPrimary: true},
    {label: 'Tasks', icon: <TaskIcon />, path: '/tasks', isGlobal: false, isPrimary: true},
    {label: 'Sensors', icon: <SensorIcon />, path: '/sensors', isGlobal: false},
    {label: 'Statistics', icon: <StatsIcon />, path: '/statistics', isGlobal: false},
    {label: 'Heatmap', icon: <HeatmapIcon />, path: '/heatmap', isGlobal: false},
    {label: 'Logs', icon: <LogsIcon />, path: '/logs', isGlobal: false},
    {label: 'Notifications', icon: <NotificationsIcon />, path: '/notifications', isGlobal: false},
    {label: 'Settings', icon: <SettingsIcon />, path: '/settings', isGlobal: true},
    {label: 'Appearance', icon: <PaletteIcon />, path: '/appearance', isGlobal: true},
    {label: 'Debug', icon: <BugReportIcon />, path: '/debug', isGlobal: true},
  ];
}
