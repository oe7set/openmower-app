// Centralised z-index scale for floating overlays inside the map container.
//
// MUI's defaults relevant here:
//   appBar:       1100  (also used by MobileBottomBar in this app)
//   drawer:       1200
//   modal:        1300
//
// We slot map overlays between drawer (1200) and modal (1300) so they always
// sit above the bottom navigation on mobile, but never above modal dialogs.
// Without this, the previous values (z=8,9,10) put RecordingPanel and the
// joystick BEHIND MobileBottomBar on phones.

export const MAP_OVERLAY_FLOATING = 1199; // AreaPopup, lightweight callouts
export const MAP_OVERLAY_PANEL = 1200; // RecordingPanel, AreasList overlay
export const MAP_OVERLAY_TELEOP = 1201; // joystick — always above other panels
