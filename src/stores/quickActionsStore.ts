import {create} from 'zustand';

export interface QuickActionsState {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  toggleSheet: () => void;
}

// Plain in-memory store — visibility is ephemeral so it intentionally does not
// use persist(). Triggers (TopBar icon, MobileBottomBar entry, swipe gesture)
// all flip the same flag, and the global QuickActionsSheet mounted in
// AppShell reads it to decide whether to render.
export const useQuickActionsStore = create<QuickActionsState>((set) => ({
  open: false,
  openSheet: () => set({open: true}),
  closeSheet: () => set({open: false}),
  toggleSheet: () => set((s) => ({open: !s.open})),
}));
