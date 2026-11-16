// Frozen contract (docs/PLAN.md B7). Public skeleton only.
// Every arrival, place, stay name and coordinate below is a fake placeholder for the mock store.
// Real values live in the gitignored seed.local.json and are written by scripts/seed.mjs.

import type { DayConfig, ItineraryItem, Person, PersonId, Poi } from './types';
import { TRIP_DAYS } from './types';

export const SEED_VERSION = 1;

/** Shared stay used as the default route start and end. */
export const HOME_POI_ID = 'home';

export interface PersonSkeleton {
  id: PersonId;
  name: string;
  initials: string;
  colorToken: string;
  role: Person['role'];
}

/** Display order: visitors, then locals. */
export const PEOPLE: PersonSkeleton[] = [
  { id: 'ayyad', name: 'Ayyad', initials: 'A', colorToken: '--person-ayyad', role: 'visitor' },
  { id: 'bqck', name: 'Bqck', initials: 'B', colorToken: '--person-bqck', role: 'visitor' },
  { id: 'xavier', name: 'Xavier', initials: 'X', colorToken: '--person-xavier', role: 'visitor' },
  { id: 'nicolino', name: 'Nicolino', initials: 'N', colorToken: '--person-nicolino', role: 'visitor' },
  { id: 'justinn', name: 'Justin N', initials: 'JN', colorToken: '--person-justinn', role: 'local' },
  { id: 'justinw', name: 'Justin W', initials: 'JW', colorToken: '--person-justinw', role: 'local' },
];

export const PERSON_IDS: PersonId[] = PEOPLE.map((p) => p.id);

export function personSkeleton(id: PersonId): PersonSkeleton {
  const p = PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error(`unknown person ${id}`);
  return p;
}

/** Default meals, created by ensureSeed() in every store. */
export function defaultItems(now = 0): ItineraryItem[] {
  return TRIP_DAYS.flatMap((date) => [
    {
      id: `${date}-lunch`,
      date,
      kind: 'meal' as const,
      meal: 'lunch' as const,
      poiId: null,
      startMin: 720,
      endMin: 780,
      createdAt: now,
      updatedAt: now,
      updatedBy: null,
    },
    {
      id: `${date}-dinner`,
      date,
      kind: 'meal' as const,
      meal: 'dinner' as const,
      poiId: null,
      startMin: 1200,
      endMin: 1260,
      createdAt: now,
      updatedAt: now,
      updatedBy: null,
    },
  ]);
}

/** Default day configs, created by ensureSeed() in every store. */
export function defaultDays(): DayConfig[] {
  return TRIP_DAYS.map((date) => ({ date, startPoiId: HOME_POI_ID, endPoiId: HOME_POI_ID }));
}

// ---------- Mock only: fake placeholders ----------

function mockPoi(
  id: string,
  name: string,
  category: Poi['category'],
  lat: number,
  lng: number,
  address: string,
): Poi {
  return {
    id,
    name,
    category,
    lat,
    lng,
    address,
    source: 'seed',
    osmRef: null,
    note: '',
    createdAt: 0,
    createdBy: null,
    updatedAt: 0,
  };
}

export const MOCK_POIS: Poi[] = [
  mockPoi(HOME_POI_ID, 'Stay A', 'stay', 3.139, 101.6869, 'Area A'),
  mockPoi('stay-2', 'Stay B', 'stay', 3.1478, 101.713, 'Area B'),
  mockPoi('stay-3', 'Stay C', 'stay', 3.1015, 101.6405, 'Area C'),
  mockPoi('arrive-1', 'Airport', 'other', 2.7456, 101.7072, 'Airport'),
  mockPoi('arrive-2', 'Station', 'other', 3.1335, 101.6865, 'Area D'),
  mockPoi('arrive-3', 'Mall', 'other', 3.1422, 101.7183, 'Area E'),
  mockPoi('mock-restaurant', 'Restaurant A', 'restaurant', 3.1456, 101.7088, 'Area F'),
  mockPoi('mock-cafe', 'Cafe A', 'cafe', 3.1518, 101.7041, 'Area G'),
  mockPoi('mock-bar', 'Bar A', 'bar', 3.1583, 101.7123, 'Area H'),
];

function mockPerson(
  id: PersonId,
  stayPoiId: string | null,
  arrival: Person['arrival'],
  departure: Person['departure'],
): Person {
  return { ...personSkeleton(id), stayPoiId, arrival, departure, updatedAt: 0, updatedBy: null };
}

export const MOCK_PEOPLE: Person[] = [
  mockPerson(
    'ayyad',
    HOME_POI_ID,
    { date: '2026-11-19', time: '17:00', place: 'Station' },
    { date: '2026-11-27', time: null, place: '' },
  ),
  mockPerson(
    'bqck',
    'stay-2',
    { date: '2026-11-19', time: '14:30', place: 'Airport' },
    { date: '2026-11-22', time: '13:00', place: '' },
  ),
  mockPerson(
    'xavier',
    HOME_POI_ID,
    { date: '2026-11-19', time: '15:00', place: 'Mall' },
    { date: '2026-11-22', time: '11:00', place: '' },
  ),
  mockPerson('nicolino', HOME_POI_ID, null, null),
  mockPerson('justinn', HOME_POI_ID, null, null),
  mockPerson('justinw', 'stay-3', null, null),
];

/** Extra mock items so the Fri 20 route has legs to draw. Not part of the real seed. */
export function mockExtraItems(): ItineraryItem[] {
  return [
    {
      id: 'mock-fri-cafe',
      date: '2026-11-20',
      kind: 'poi',
      meal: null,
      poiId: 'mock-cafe',
      startMin: 900,
      endMin: 960,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: null,
    },
  ];
}

export const MOCK_LINKED_MEALS: Record<string, string> = { '2026-11-20-lunch': 'mock-restaurant' };
