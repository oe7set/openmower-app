import {type NavigationItem} from '@/components/types';
import {type Density} from '@/stores/uiStore';
import {ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, useTheme} from '@mui/material';

interface SidebarItemProps {
  item: NavigationItem;
  isActive: boolean;
  onClick: (path: string) => void;
  compact?: boolean;
  density?: Density;
}

export default function SidebarItem({
  item,
  isActive,
  onClick,
  compact = false,
  density = 'comfortable',
}: SidebarItemProps) {
  const theme = useTheme();

  const button = (
    <ListItemButton
      onClick={() => onClick(item.path)}
      sx={{
        mx: 1,
        py: density === 'compact' ? 0.5 : 1,
        borderRadius: 2,
        justifyContent: compact ? 'center' : 'flex-start',
        '&.Mui-selected': {
          backgroundColor: theme.palette.primary.main + '20',
          color: theme.palette.primary.main,
          '&:hover': {
            backgroundColor: theme.palette.primary.main + '30',
          },
        },
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
      }}
      selected={isActive}
    >
      <ListItemIcon
        sx={{
          color: isActive ? theme.palette.primary.main : 'inherit',
          minWidth: compact ? 0 : 40,
          justifyContent: 'center',
        }}
      >
        {item.icon}
      </ListItemIcon>
      {!compact && (
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              sx: {
                fontWeight: isActive ? 600 : 500,
              },
            },
          }}
        />
      )}
    </ListItemButton>
  );

  return (
    <ListItem disablePadding>
      {compact ? (
        <Tooltip title={item.label} placement="right" arrow>
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </ListItem>
  );
}
