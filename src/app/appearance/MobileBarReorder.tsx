'use client';

import {createNavigationItems} from '@/components/navigation/navigationItems';
import {ArrowDownward, ArrowUpward} from '@mui/icons-material';
import {Box, Checkbox, IconButton, List, ListItem, ListItemIcon, ListItemText, Typography} from '@mui/material';

interface MobileBarReorderProps {
  value: string[]; // ordered paths currently shown in the bar
  onChange: (next: string[]) => void;
}

// Lets the user pick which nav items appear in the mobile bottom bar and
// in what order. Checked items follow the user-controlled order (with
// up/down arrows); unchecked items are listed below in their navigation
// source order so they are easy to find when re-enabling.
export function MobileBarReorder({value, onChange}: MobileBarReorderProps) {
  const allItems = createNavigationItems();

  const selectedSet = new Set(value);
  const selected = value
    .map((path) => allItems.find((it) => it.path === path))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  const unselected = allItems.filter((it) => !selectedSet.has(it.path));

  const toggle = (path: string) => {
    if (selectedSet.has(path)) {
      onChange(value.filter((p) => p !== path));
    } else {
      onChange([...value, path]);
    }
  };

  const move = (path: string, dir: -1 | 1) => {
    const idx = value.indexOf(path);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>
        Shown in bar (in this order)
      </Typography>
      <List dense disablePadding>
        {selected.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{pl: 2, py: 1, fontStyle: 'italic'}}>
            No items selected — the bar will be empty.
          </Typography>
        )}
        {selected.map((item, idx) => (
          <ListItem
            key={item.path}
            secondaryAction={
              <Box>
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={`Move ${item.label} up`}
                  disabled={idx === 0}
                  onClick={() => move(item.path, -1)}
                >
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={`Move ${item.label} down`}
                  disabled={idx === selected.length - 1}
                  onClick={() => move(item.path, 1)}
                >
                  <ArrowDownward fontSize="small" />
                </IconButton>
              </Box>
            }
          >
            <Checkbox checked edge="start" onChange={() => toggle(item.path)} />
            <ListItemIcon sx={{minWidth: 36}}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} secondary={item.path} />
          </ListItem>
        ))}
      </List>

      {unselected.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 2, mb: 0.5}}>
            Hidden
          </Typography>
          <List dense disablePadding>
            {unselected.map((item) => (
              <ListItem key={item.path}>
                <Checkbox checked={false} edge="start" onChange={() => toggle(item.path)} />
                <ListItemIcon sx={{minWidth: 36}}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} secondary={item.path} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
}
