import {create, useStore} from 'zustand';
import {immer} from 'zustand/middleware/immer';
import {EventEntry, EventSeverity, EventsSnapshot, eventSeverityRank} from './schemas';
import {useMowersStore} from './mowersStore';

// Notification / event center store.
//
// Per mower we hold a chronological list of events (newest first) plus the
// backend-reported unread count. Events arrive in two flavours: a retained
// `events/json` snapshot the broker replays on connect (cold-start) and a
// non-retained `events/stream` topic for live updates. The MQTT handler in
// mowersStore dispatches to the matching action below; this store does not
// touch MQTT or RPC directly.
//
// RPC actions (ack, ackAll, clear) are best-effort: they call the backend and
// rely on the retained `events/json` snapshot to reconcile authoritative state
// afterwards. We keep an optimistic update so the UI reacts immediately.

const MAX_PER_MOWER = 500;

interface MowerEvents {
  events: EventEntry[];
  unread: number;
  loaded: boolean;
}

interface NotificationsStore {
  byMower: Record<string, MowerEvents>;
  // Side-effect callbacks used by the MQTT handler. Keep them on the store
  // (rather than free helpers) so they can be wrapped by tests.
  onSnapshot: (mowerId: string, snapshot: EventsSnapshot) => void;
  onStream: (mowerId: string, ev: EventEntry) => void;
  // RPC-backed mutations. These are wired to the active mower in the page
  // components; signature mirrors the openrpc.json contract.
  ack: (mowerId: string, id: string) => Promise<void>;
  ackAll: (mowerId: string) => Promise<void>;
  clear: (mowerId: string) => Promise<void>;
}

const emptyMowerEvents = (): MowerEvents => ({events: [], unread: 0, loaded: false});

function ensureMower(byMower: Record<string, MowerEvents>, mowerId: string): MowerEvents {
  if (!byMower[mowerId]) byMower[mowerId] = emptyMowerEvents();
  return byMower[mowerId];
}

export const useNotificationsStore = create<NotificationsStore>()(
  immer((set) => ({
    byMower: {},

    onSnapshot: (mowerId, snapshot) => {
      // The backend publishes the snapshot newest-first already.
      set((state) => {
        const slot = ensureMower(state.byMower, mowerId);
        slot.events = snapshot.events.slice(0, MAX_PER_MOWER);
        slot.unread = snapshot.unread;
        slot.loaded = true;
      });
    },

    onStream: (mowerId, ev) => {
      set((state) => {
        const slot = ensureMower(state.byMower, mowerId);
        // Dedup by id — the retained snapshot may overlap with the first few
        // live events when the page loads.
        if (slot.events.some((e) => e.id === ev.id)) return;
        slot.events.unshift(ev);
        if (slot.events.length > MAX_PER_MOWER) {
          slot.events.length = MAX_PER_MOWER;
        }
        if (!ev.acked) slot.unread += 1;
      });
      // Side-effects: toast + native notification for severity >= warning.
      // Imported lazily to avoid React/MUI being pulled into tests that only
      // exercise the store.
      void notifyForEvent(mowerId, ev);
    },

    ack: async (mowerId, id) => {
      // Optimistic: flip locally first, then RPC. The retained snapshot will
      // reconcile any drift.
      set((state) => {
        const slot = state.byMower[mowerId];
        if (!slot) return;
        const e = slot.events.find((x) => x.id === id);
        if (e && !e.acked) {
          e.acked = true;
          slot.unread = Math.max(0, slot.unread - 1);
        }
      });
      const rpc = rpcForMower(mowerId);
      if (rpc) await rpc.events.ack({id});
    },

    ackAll: async (mowerId) => {
      set((state) => {
        const slot = state.byMower[mowerId];
        if (!slot) return;
        for (const e of slot.events) e.acked = true;
        slot.unread = 0;
      });
      const rpc = rpcForMower(mowerId);
      if (rpc) await rpc.events.ack_all();
    },

    clear: async (mowerId) => {
      set((state) => {
        state.byMower[mowerId] = emptyMowerEvents();
        state.byMower[mowerId].loaded = true;
      });
      const rpc = rpcForMower(mowerId);
      if (rpc) await rpc.events.clear();
    },
  })),
);

// Helpers --------------------------------------------------------------------

function rpcForMower(mowerId: string) {
  const mower = useMowersStore.getState().mowers.find((m) => m.id === mowerId);
  return mower?.rpc;
}

// Toast + native notification side-effect. Lives outside the immer producer
// so it cannot accidentally mutate state. Toast triggers for severity >=
// warning; native Notification API fires only when the tab is hidden and the
// user has previously granted permission (no auto-prompt).
async function notifyForEvent(mowerId: string, ev: EventEntry): Promise<void> {
  if (typeof window === 'undefined') return;
  const rank = eventSeverityRank[ev.severity];
  if (rank < eventSeverityRank.warning) return;

  // Toast — dynamic import keeps notistack out of SSR / test bundles.
  try {
    const {enqueueSnackbar} = await import('notistack');
    enqueueSnackbar(ev.summary, {variant: severityToVariant(ev.severity)});
  } catch {
    // Toast subsystem unavailable — degrade silently.
  }

  // Native notification only if backgrounded & permission granted.
  if (
    rank >= eventSeverityRank.error &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    document.visibilityState === 'hidden'
  ) {
    try {
      const mower = useMowersStore.getState().mowers.find((m) => m.id === mowerId);
      const title = mower ? `${mower.name}: ${ev.summary}` : ev.summary;
      new Notification(title, {body: ev.type, icon: '/logo-square.svg', tag: ev.id});
    } catch {
      // Some browsers throw if permission was revoked between the check and
      // construction. Treat as best-effort.
    }
  }
}

function severityToVariant(s: EventSeverity): 'info' | 'warning' | 'error' | 'success' {
  switch (s) {
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'error':
    case 'critical':
      return 'error';
  }
}

// Selectors ------------------------------------------------------------------

const EMPTY_EVENTS: EventEntry[] = [];

function useActiveMowerId(): string | undefined {
  return useStore(useMowersStore, (s) => s.mowers[s.selected]?.id);
}

export function useEventsForActive(): EventEntry[] {
  const mowerId = useActiveMowerId();
  return useNotificationsStore((s) => (mowerId ? s.byMower[mowerId]?.events ?? EMPTY_EVENTS : EMPTY_EVENTS));
}

export function useUnreadForActive(): number {
  const mowerId = useActiveMowerId();
  return useNotificationsStore((s) => (mowerId ? s.byMower[mowerId]?.unread ?? 0 : 0));
}

export function useActiveMowerIdForNotifications(): string | undefined {
  return useActiveMowerId();
}

export function useEventsForMower(mowerId: string | undefined): MowerEvents {
  return useNotificationsStore((s) => (mowerId ? s.byMower[mowerId] ?? emptyMowerEvents() : emptyMowerEvents()));
}
