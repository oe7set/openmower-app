import {type NavigationItem} from '@/components/types';
import {
  BarChart as StatsIcon,
  BugReport as BugReportIcon,
  Dashboard as DashboardIcon,
  Description as LogsIcon,
  Map as MapIcon,
  Sensors as SensorIcon,
  Settings as SettingsIcon,
  SportsEsports as DriveIcon,
  Assignment as TaskIcon,
  Whatshot as HeatmapIcon,
} from '@mui/icons-material';

export function createNavigationItems(): NavigationItem[] {
  return [
    {label: 'Dashboard', icon: <DashboardIcon />, path: '/', isGlobal: true},
    {label: 'Map', icon: <MapIcon />, path: '/map', isGlobal: false},
    {label: 'Drive', icon: <DriveIcon />, path: '/drive', isGlobal: false},
    {label: 'Tasks', icon: <TaskIcon />, path: '/tasks', isGlobal: false},
    {label: 'Sensors', icon: <SensorIcon />, path: '/sensors', isGlobal: false},
    {label: 'Statistics', icon: <StatsIcon />, path: '/statistics', isGlobal: false},
    {label: 'Heatmap', icon: <HeatmapIcon />, path: '/heatmap', isGlobal: false},
    {label: 'Logs', icon: <LogsIcon />, path: '/logs', isGlobal: false},
    {label: 'Settings', icon: <SettingsIcon />, path: '/settings', isGlobal: true},
    {label: 'Debug', icon: <BugReportIcon />, path: '/debug', isGlobal: true},
  ];
}
