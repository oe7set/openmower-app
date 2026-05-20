'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {useUiStore, type Density, type DrawerAnchor, type TopBarMode} from '@/stores/uiStore';
import {RestartAlt as ResetIcon} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import {MobileBarReorder} from './MobileBarReorder';

export function AppearanceForm() {
  const drawerAnchor = useUiStore((s) => s.drawerAnchor);
  const setDrawerAnchor = useUiStore((s) => s.setDrawerAnchor);
  const topBarMode = useUiStore((s) => s.topBarMode);
  const setTopBarMode = useUiStore((s) => s.setTopBarMode);
  const bottomBarEnabled = useUiStore((s) => s.bottomBarEnabled);
  const setBottomBarEnabled = useUiStore((s) => s.setBottomBarEnabled);
  const bottomBarItems = useUiStore((s) => s.bottomBarItems);
  const setBottomBarItems = useUiStore((s) => s.setBottomBarItems);
  const sidebarCompact = useUiStore((s) => s.sidebarCompact);
  const setSidebarCompact = useUiStore((s) => s.setSidebarCompact);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const resetAppearance = useUiStore((s) => s.resetAppearance);

  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Page>
      <PageHeader title="Appearance" subtitle="Tune the chrome to your taste" />
      <PageContent>
        <Alert severity="info" sx={{mb: 2}}>
          Changes apply immediately — there&apos;s no Save button. Settings persist in your
          browser only.
        </Alert>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Layout
            </Typography>

            <Stack spacing={3}>
              <FormControl>
                <FormLabel>Drawer side</FormLabel>
                <ToggleButtonGroup
                  exclusive
                  value={drawerAnchor}
                  onChange={(_, v: DrawerAnchor | null) => v && setDrawerAnchor(v)}
                  size="small"
                  sx={{mt: 1}}
                >
                  <ToggleButton value="left">Left</ToggleButton>
                  <ToggleButton value="right">Right</ToggleButton>
                </ToggleButtonGroup>
                <FormHelperText>
                  Side from which the navigation drawer opens — applies to the desktop sidebar
                  and the mobile slide-in menu.
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Density</FormLabel>
                <ToggleButtonGroup
                  exclusive
                  value={density}
                  onChange={(_, v: Density | null) => v && setDensity(v)}
                  size="small"
                  sx={{mt: 1}}
                >
                  <ToggleButton value="comfortable">Comfortable</ToggleButton>
                  <ToggleButton value="compact">Compact</ToggleButton>
                </ToggleButtonGroup>
                <FormHelperText>Tighter spacing in the sidebar list and the mobile bottom bar.</FormHelperText>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={sidebarCompact}
                    onChange={(_, v) => setSidebarCompact(v)}
                  />
                }
                label="Compact sidebar (desktop)"
              />
              <Typography variant="caption" color="text.secondary" sx={{mt: -2, ml: 6}}>
                Collapses the desktop sidebar to icons-only. Hover an item to see its label.
                Mobile is unaffected.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Top bar
            </Typography>
            <FormControl>
              <RadioGroup
                value={topBarMode}
                onChange={(_, v) => setTopBarMode(v as TopBarMode)}
              >
                <FormControlLabel
                  value="always"
                  control={<Radio />}
                  label="Always visible"
                />
                <FormControlLabel
                  value="autoHide"
                  control={<Radio />}
                  label="Auto-hide on scroll"
                />
                <FormControlLabel value="hidden" control={<Radio />} label="Hidden" />
              </RadioGroup>
              <FormHelperText>
                Auto-hide slides the bar away while scrolling down and brings it back when you
                scroll up. Hidden removes it completely — on mobile you can still reach the
                navigation through the bottom-bar Menu button.
              </FormHelperText>
            </FormControl>
          </CardContent>
        </Card>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Mobile bottom bar
            </Typography>
            <FormControlLabel
              control={
                <Switch checked={bottomBarEnabled} onChange={(_, v) => setBottomBarEnabled(v)} />
              }
              label="Show bottom bar on mobile"
            />
            <FormHelperText sx={{mt: 0, mb: 2}}>
              When off, the bottom bar disappears entirely on phones; the slide-in drawer is
              still reachable via the top-bar Menu icon.
            </FormHelperText>

            {bottomBarEnabled && (
              <Box sx={{mt: 2}}>
                <MobileBarReorder value={bottomBarItems} onChange={setBottomBarItems} />
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 1}}>
              Reset
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              Restores layout, top-bar, and bottom-bar preferences to their defaults. Theme,
              units, and map overlays are not affected.
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<ResetIcon />}
              onClick={() => setConfirmReset(true)}
            >
              Restore appearance defaults
            </Button>
          </CardContent>
        </Card>
      </PageContent>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
        <DialogTitle>Restore appearance defaults?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This resets the drawer side, density, sidebar compact mode, top-bar visibility,
            and the mobile bottom bar selection &amp; order to their defaults.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              resetAppearance();
              setConfirmReset(false);
            }}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
