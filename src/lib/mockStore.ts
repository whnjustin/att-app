// In memory Store for development and tests (?mock=1).
// State is mirrored to localStorage so a second tab sees edits live (storage event), like Firestore.

import type { Store, Unsub } from '../contracts/store';
import type {
  Background,
  DateKey,
  DayConfig,
  ItineraryItem,
  Person,
  PersonId,
  Poi,
  Prefs,
  Presence,
  RouteLeg,
} from '../contracts/types';
import {
  MOCK_LINKED_MEALS,
  MOCK_PEOPLE,
  MOCK_POIS,
  defaultDays,
  defaultItems,
  mockExtraItems,
} from '../contracts/seed';

interface State {
  people: Person[];
  pois: Poi[];
  items: ItineraryItem[];
  days: DayConfig[];
  presence: Presence[];
  routes: Record<string, RouteLeg>;
  backgrounds: Background[];
  prefs: Prefs[];
}

const STATE_KEY = 'att.mock.v1';
const ME_KEY = 'att.me';
const PEER_UID = 'mock-peer';

function initialState(): State {
  const items = [...defaultItems(), ...mockExtraItems()].map((i) =>
    MOCK_LINKED_MEALS[i.id] ? { ...i, poiId: MOCK_LINKED_MEALS[i.id] } : i,
  );
  return {
    people: structuredClone(MOCK_PEOPLE),
    pois: structuredClone(MOCK_POIS),
    items,
    days: defaultDays(),
    presence: [],
    routes: {},
    backgrounds: [],
    prefs: [],
  };
}

function safeGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface MockStoreOptions {
  /** Keep state in memory only (tests). Default false. */
  ephemeral?: boolean;
  /** Start from the seed, discarding saved mock state. */
  reset?: boolean;
}

export function createMockStore(opts: MockStoreOptions = {}): Store {
  const persist = !opts.ephemeral;
  let state: State = initialState();
  if (persist && !opts.reset) {
    const saved = safeGet(STATE_KEY);
    if (saved) {
      try {
        state = { ...state, ...(JSON.parse(saved) as State) };
      } catch {
        /* ignore bad state */
      }
    }
  }
  if (persist && opts.reset) safeSet(STATE_KEY, null);

  let me: PersonId | null = persist ? (safeGet(ME_KEY) as PersonId | null) : null;
  const uid = `mock-${Math.random().toString(36).slice(2, 10)}`;

  type Listener = () => void;
  const listeners = new Set<Listener>();
  const meListeners = new Set<(id: PersonId | null) => void>();

  let scheduled = false;
  function notify(): void {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      listeners.forEach((l) => l());
    }, 0);
  }

  function commit(mut: (s: State) => void): void {
    const next = structuredClone(state);
    mut(next);
    state = next;
    if (persist) safeSet(STATE_KEY, JSON.stringify(state));
    notify();
  }

  if (persist && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STATE_KEY && e.newValue) {
        try {
          state = JSON.parse(e.newValue) as State;
          notify();
        } catch {
          /* ignore */
        }
      }
    });
  }

  function watch<T>(select: (s: State) => T, cb: (v: T) => void): Unsub {
    const run = () => cb(structuredClone(select(state)));
    run();
    listeners.add(run);
    return () => listeners.delete(run);
  }

  const now = () => Date.now();

  return {
    kind: 'mock',

    async signIn() {
      return uid;
    },
    async isMember() {
      return true;
    },
    async join(code) {
      return code.trim().length > 0 ? 'ok' : 'bad-code';
    },
    async setMe(personId) {
      me = personId;
      if (persist) safeSet(ME_KEY, personId);
      meListeners.forEach((l) => l(me));
    },
    me() {
      return me;
    },
    watchMe(cb) {
      cb(me);
      meListeners.add(cb);
      return () => meListeners.delete(cb);
    },

    watchPeople: (cb) => watch((s) => s.people, cb),
    watchPois: (cb) => watch((s) => s.pois, cb),
    watchItems: (date: DateKey | 'all', cb) =>
      watch((s) => (date === 'all' ? s.items : s.items.filter((i) => i.date === date)), cb),
    watchDays: (cb) => watch((s) => s.days, cb),
    watchPresence: (cb) => watch((s) => s.presence, cb),

    async updatePerson(id, patch) {
      commit((s) => {
        const p = s.people.find((x) => x.id === id);
        if (p) Object.assign(p, patch, { updatedAt: now(), updatedBy: me });
      });
    },
    async addPoi(p) {
      const id = newId('poi');
      commit((s) => {
        s.pois.push({ ...p, id, createdAt: now(), updatedAt: now(), createdBy: me });
      });
      return id;
    },
    async updatePoi(id, patch) {
      commit((s) => {
        const p = s.pois.find((x) => x.id === id);
        if (p) Object.assign(p, patch, { id, updatedAt: now() });
      });
    },
    async deletePoi(id) {
      commit((s) => {
        s.pois = s.pois.filter((x) => x.id !== id);
        for (const i of s.items) {
          if (i.poiId === id) Object.assign(i, { poiId: null, updatedAt: now(), updatedBy: me });
        }
      });
    },
    async addItem(i) {
      const id = newId('item');
      commit((s) => {
        s.items.push({ ...i, id, createdAt: now(), updatedAt: now(), updatedBy: me });
      });
      return id;
    },
    async updateItem(id, patch) {
      commit((s) => {
        const i = s.items.find((x) => x.id === id);
        if (i) Object.assign(i, patch, { updatedAt: now(), updatedBy: me });
      });
    },
    async deleteItem(id) {
      commit((s) => {
        s.items = s.items.filter((x) => x.id !== id);
      });
    },
    async updateDay(date, patch) {
      commit((s) => {
        const d = s.days.find((x) => x.date === date);
        if (d) Object.assign(d, patch, { date });
      });
    },

    async getRoute(key) {
      return state.routes[key] ?? null;
    },
    async putRoute(leg) {
      commit((s) => {
        s.routes[leg.key] = leg;
      });
    },

    async heartbeat(page) {
      const t = now();
      commit((s) => {
        s.presence = s.presence.filter((p) => p.uid !== uid && p.uid !== PEER_UID);
        s.presence.push({ uid, personId: me, page, lastSeen: t });
        // A fake second person online, so presence UI has something to show.
        s.presence.push({
          uid: PEER_UID,
          personId: me === 'bqck' ? 'xavier' : 'bqck',
          page: 'overview',
          lastSeen: t,
        });
      });
    },

    watchBackgrounds: (cb) => watch((s) => s.backgrounds, cb),
    async addBackground(dataUrl) {
      const id = newId('bg');
      commit((s) => {
        s.backgrounds.push({ id, dataUrl, createdBy: me, createdAt: now() });
      });
      return id;
    },
    async deleteBackground(id) {
      commit((s) => {
        s.backgrounds = s.backgrounds.filter((b) => b.id !== id);
        for (const p of s.prefs) if (p.backgroundId === id) p.backgroundId = null;
      });
    },
    watchPrefs: (cb) => watch((s) => s.prefs, cb),
    async setMyBackground(backgroundId) {
      const personId = me;
      if (!personId) return;
      commit((s) => {
        s.prefs = s.prefs.filter((p) => p.personId !== personId);
        s.prefs.push({ personId, backgroundId });
      });
    },

    async ensureSeed() {
      commit((s) => {
        for (const item of defaultItems(now())) {
          if (!s.items.some((x) => x.id === item.id)) s.items.push(item);
        }
        for (const day of defaultDays()) {
          if (!s.days.some((x) => x.date === day.date)) s.days.push(day);
        }
      });
    },
  };
}
