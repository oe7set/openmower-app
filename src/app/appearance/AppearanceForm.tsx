'use client';

import {Page, PageContent, PageHeader} from '@/components/page';
import {autoPickMowerColor} from '@/lib/mowerColors';
import {useMowerConfigs} from '@/stores/configStore';
import {
  useUiStore,
  type Density,
  type DrawerAnchor,
  type MotionMode,
  type PageHeaderStyle,
  type RadiusMode,
  type TopBarMode,
} from '@/stores/uiStore';
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
  Link,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import {useState} from 'react';
import {AccentPicker} from './AccentPicker';
import {MobileBarReorder} from './MobileBarReorder';

export function AppearanceForm() {
  const theme = useTheme();
  const mowerConfigs = useMowerConfigs();
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
  const accentColor = useUiStore((s) => s.accentColor);
  const setAccentColor = useUiStore((s) => s.setAccentColor);
  const fontScale = useUiStore((s) => s.fontScale);
  const setFontScale = useUiStore((s) => s.setFontScale);
  const radiusMode = useUiStore((s) => s.radiusMode);
  const setRadiusMode = useUiStore((s) => s.setRadiusMode);
  const motionMode = useUiStore((s) => s.motionMode);
  const setMotionMode = useUiStore((s) => s.setMotionMode);
  const pageHeaderStyle = useUiStore((s) => s.pageHeaderStyle);
  const setPageHeaderStyle = useUiStore((s) => s.setPageHeaderStyle);
  const mowerColors = useUiStore((s) => s.mowerColors);
  const setMowerColor = useUiStore((s) => s.setMowerColor);
  const clearMowerColor = useUiStore((s) => s.clearMowerColor);
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

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Theme &amp; accent
            </Typography>
            <FormHelperText sx={{mt: 0, mb: 2}}>
              Replaces the brand green throughout the app — primary buttons, switches,
              progress bars, and the page-header gradient all follow the chosen colour.
            </FormHelperText>
            <AccentPicker value={accentColor} onChange={setAccentColor} />
            <Box sx={{display: 'flex', gap: 1, alignItems: 'center', mt: 3, flexWrap: 'wrap'}}>
              <Button variant="contained" size="small">
                Primary
              </Button>
              <Switch defaultChecked />
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: `${accentColor}22`,
                  color: accentColor,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Live preview
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Text size
            </Typography>
            <FormHelperText sx={{mt: 0, mb: 2}}>
              Scales the whole UI by changing the root font size. Useful on huge monitors or
              for users who find the default a touch small.
            </FormHelperText>
            <Box sx={{px: 1}}>
              <Slider
                value={fontScale}
                onChange={(_, v) => typeof v === 'number' && setFontScale(v)}
                min={0.8}
                max={1.4}
                step={0.05}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                marks={[
                  {value: 0.8, label: '80%'},
                  {value: 1, label: '100%'},
                  {value: 1.4, label: '140%'},
                ]}
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Roundness
            </Typography>
            <FormControl>
              <ToggleButtonGroup
                exclusive
                value={radiusMode}
                onChange={(_, v: RadiusMode | null) => v && setRadiusMode(v)}
                size="small"
              >
                <ToggleButton value="sharp">Sharp</ToggleButton>
                <ToggleButton value="standard">Standard</ToggleButton>
                <ToggleButton value="soft">Soft</ToggleButton>
              </ToggleButtonGroup>
              <FormHelperText>
                Applies to buttons, cards, alerts, menus, and the page-header corners.
              </FormHelperText>
            </FormControl>
            <Box sx={{display: 'flex', gap: 2, mt: 2}}>
              {(
                [
                  {label: 'Sharp', radius: 0},
                  {label: 'Standard', radius: 12},
                  {label: 'Soft', radius: 18},
                ] as const
              ).map((p) => (
                <Box
                  key={p.label}
                  sx={{
                    flex: 1,
                    height: 48,
                    borderRadius: `${p.radius}px`,
                    border: `1px dashed ${theme.palette.divider}`,
                    bgcolor: theme.palette.action.hover,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  {p.label}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Motion
            </Typography>
            <FormControl>
              <RadioGroup
                value={motionMode}
                onChange={(_, v) => setMotionMode(v as MotionMode)}
              >
                <FormControlLabel
                  value="system"
                  control={<Radio />}
                  label="System (follow prefers-reduced-motion)"
                />
                <FormControlLabel value="full" control={<Radio />} label="Full animations" />
                <FormControlLabel value="off" control={<Radio />} label="Off" />
              </RadioGroup>
              <FormHelperText>
                Off disables MUI transitions, the kill-button blink, and snackbar slide-ins.
                Helpful for motion-sensitive users and low-power devices.
              </FormHelperText>
            </FormControl>
          </CardContent>
        </Card>

        <Card sx={{mb: 2}}>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
              Page header
            </Typography>
            <FormControl>
              <RadioGroup
                value={pageHeaderStyle}
                onChange={(_, v) => setPageHeaderStyle(v as PageHeaderStyle)}
              >
                <FormControlLabel value="hero" control={<Radio />} label="Hero (gradient)" />
                <FormControlLabel value="flat" control={<Radio />} label="Flat (solid surface)" />
                <FormControlLabel
                  value="minimal"
                  control={<Radio />}
                  label="Minimal (title in top bar)"
                />
              </RadioGroup>
              <FormHelperText>
                Hero is the tall green block; Flat trades it for a slim divider; Minimal hides
                it entirely and routes the page title into the top bar.
              </FormHelperText>
            </FormControl>
          </CardContent>
        </Card>

        {mowerConfigs.length > 1 && (
          <Card sx={{mb: 2}}>
            <CardContent>
              <Typography variant="h6" fontWeight="600" sx={{mb: 2}}>
                Mower colours
              </Typography>
              <FormHelperText sx={{mt: 0, mb: 2}}>
                Each mower gets a tag colour shown on the active-mower card, the connection
                pill ring, and the switcher menu. Defaults are auto-picked per id; click a
                swatch to override.
              </FormHelperText>
              <Stack spacing={2}>
                {mowerConfigs.map((m) => {
                  const override = mowerColors[m.id];
                  const effective = override ?? autoPickMowerColor(m.id);
                  return (
                    <Box
                      key={m.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography variant="body2" sx={{minWidth: 120, fontWeight: 500}} noWrap>
                        {m.name}
                      </Typography>
                      <AccentPicker
                        value={effective}
                        onChange={(hex) => setMowerColor(m.id, hex)}
                      />
                      {override && (
                        <Link
                          component="button"
                          variant="caption"
                          onClick={() => clearMowerColor(m.id)}
                          sx={{ml: 0.5}}
                        >
                          Reset to auto
                        </Link>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="600" sx={{mb: 1}}>
              Reset
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              Restores layout, top-bar, bottom-bar, theming, motion, and mower-colour
              preferences to their defaults. Light/dark theme, units, and map overlays are
              not affected.
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
            mobile bottom-bar selection &amp; order, accent colour, font scale, roundness,
            motion, page-header style, and mower colours to their defaults.
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
