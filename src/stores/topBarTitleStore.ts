import {create} from 'zustand';

// Bridge for the "minimal" PageHeader variant. When a page renders
// PageHeader in minimal mode the component publishes its title/subtitle
// here on mount and clears on unmount, and TopBar renders it in its
// centre slot. Keeping this as a tiny standalone store (rather than
// React context) avoids forcing a top-level provider just for one prop.
interface TopBarTitleState {
  title: string;
  subtitle: string;
  set: (title: string, subtitle: string) => void;
  clear: () => void;
}

export const useTopBarTitleStore = create<TopBarTitleState>()((set) => ({
  title: '',
  subtitle: '',
  set: (title, subtitle) => set({title, subtitle}),
  clear: () => set({title: '', subtitle: ''}),
}));
