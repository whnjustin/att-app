// Frozen contract (docs/PLAN.md B6). Change only through the dispatcher.

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DateKey, DayConfig, ItineraryItem, Person, PersonId, Poi, Presence, RouteLeg } from './types';

export type Unsub = () => void;

/** Heartbeat interval and online window for presence. */
export const HEARTBEAT_MS = 25_000;
export const ONLINE_MS = 60_000;

export interface Store {
  /** 'mock' or 'firestore'. The gate is skipped for mock. */
  readonly kind: 'mock' | 'firestore';

  // auth and identity
  signIn(): Promise<string>; // anonymous, returns uid
  isMember(): Promise<boolean>;
  join(code: string): Promise<'ok' | 'bad-code'>;
  setMe(personId: PersonId): Promise<void>;
  me(): PersonId | null;
  /** Fires immediately with me(), then whenever setMe changes it. */
  watchMe(cb: (id: PersonId | null) => void): Unsub;

  // live subscriptions (callback fires immediately with current data, then on every change)
  watchPeople(cb: (p: Person[]) => void): Unsub;
  watchPois(cb: (p: Poi[]) => void): Unsub;
  watchItems(date: DateKey | 'all', cb: (i: ItineraryItem[]) => void): Unsub;
  watchDays(cb: (d: DayConfig[]) => void): Unsub;
  watchPresence(cb: (p: Presence[]) => void): Unsub;

  // writes (stamp updatedAt / updatedBy inside the store)
  updatePerson(
    id: PersonId,
    patch: Partial<Pick<Person, 'arrival' | 'departure' | 'stayPoiId'>>,
  ): Promise<void>;
  addPoi(p: Omit<Poi, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string>;
  updatePoi(id: string, patch: Partial<Poi>): Promise<void>;
  deletePoi(id: string): Promise<void>; // also sets poiId=null on items that use it
  addItem(i: Omit<ItineraryItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>): Promise<string>;
  updateItem(
    id: string,
    patch: Partial<Pick<ItineraryItem, 'startMin' | 'endMin' | 'poiId' | 'date'>>,
  ): Promise<void>;
  deleteItem(id: string): Promise<void>;
  updateDay(date: DateKey, patch: Partial<DayConfig>): Promise<void>;

  // route cache
  getRoute(key: string): Promise<RouteLeg | null>;
  putRoute(leg: RouteLeg): Promise<void>;

  // presence
  heartbeat(page: Presence['page']): Promise<void>; // every HEARTBEAT_MS; online = lastSeen within ONLINE_MS

  // seed
  ensureSeed(): Promise<void>; // idempotent: creates default meals and day configs if missing
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value: store }, children);
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Subscribe helper: undefined until the first callback. */
function useWatch<T>(subscribe: (s: Store, cb: (v: T) => void) => Unsub, deps: unknown[]): T | undefined {
  const store = useStore();
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => subscribe(store, setValue), [store, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

const EMPTY: never[] = [];

export function usePeople(): Person[] {
  return useWatch<Person[]>((s, cb) => s.watchPeople(cb), []) ?? EMPTY;
}

export function usePois(): Poi[] {
  return useWatch<Poi[]>((s, cb) => s.watchPois(cb), []) ?? EMPTY;
}

export function useItems(date: DateKey | 'all'): ItineraryItem[] {
  return useWatch<ItineraryItem[]>((s, cb) => s.watchItems(date, cb), [date]) ?? EMPTY;
}

export function useDays(): DayConfig[] {
  return useWatch<DayConfig[]>((s, cb) => s.watchDays(cb), []) ?? EMPTY;
}

export function useMe(): PersonId | null {
  return useWatch<PersonId | null>((s, cb) => s.watchMe(cb), []) ?? null;
}

/** Presence filtered to entries seen within ONLINE_MS, re-evaluated every 10 s. */
export function usePresence(): Presence[] {
  const all = useWatch<Presence[]>((s, cb) => s.watchPresence(cb), []) ?? EMPTY;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);
  return all.filter((p) => now - p.lastSeen <= ONLINE_MS);
}
