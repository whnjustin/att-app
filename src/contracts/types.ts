// Frozen contract (docs/PLAN.md B3). Change only through the dispatcher.

export type DateKey = '2026-11-19' | '2026-11-20' | '2026-11-21' | '2026-11-22';
export const TRIP_DAYS: DateKey[] = ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

export type PersonId = 'ayyad' | 'bqck' | 'xavier' | 'nicolino' | 'justinn' | 'justinw';

export interface Movement {
  date: string | null; // 'YYYY-MM-DD', may be outside TRIP_DAYS
  time: string | null; // 'HH:mm' 24h, null = not set
  place: string; // free text
}

export interface Person {
  id: PersonId;
  name: string;
  initials: string;
  colorToken: string; // CSS var name, e.g. '--person-ayyad'
  role: 'visitor' | 'local';
  stayPoiId: string | null; // POI with category 'stay'
  arrival: Movement | null; // null for locals
  departure: Movement | null;
  updatedAt: number;
  updatedBy: PersonId | null;
}

export type PoiCategory = 'restaurant' | 'cafe' | 'bar' | 'other' | 'stay';
export const POI_CATEGORIES: PoiCategory[] = ['restaurant', 'cafe', 'bar', 'other', 'stay'];

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  address: string; // short area name
  source: 'search' | 'gmaps-url' | 'pin' | 'seed';
  osmRef: string | null; // e.g. 'N123456' from Photon, for dedupe
  note: string;
  createdAt: number;
  createdBy: PersonId | null;
  updatedAt: number;
}

export interface ItineraryItem {
  id: string;
  date: DateKey;
  kind: 'meal' | 'poi';
  meal: 'lunch' | 'dinner' | null; // set when kind = 'meal'
  poiId: string | null; // meals may be unlinked
  startMin: number; // minutes from 00:00, multiple of 30, 0..1410
  endMin: number; // multiple of 30, startMin+30..1440
  createdAt: number;
  updatedAt: number;
  updatedBy: PersonId | null;
}

export interface DayConfig {
  date: DateKey;
  startPoiId: string; // route start, default 'home'
  endPoiId: string; // route end, default 'home'
}

export interface Member {
  uid: string;
  personId: PersonId | null;
  joinedAt: number;
  code: string;
}

export interface Presence {
  uid: string;
  personId: PersonId | null;
  page: 'overview' | 'plan';
  lastSeen: number;
}

export interface RouteLeg {
  key: string; // legKey(from, to)
  polyline: string; // Google encoded polyline, precision 5
  distanceM: number;
  durationS: number;
  fetchedAt: number;
}

/** A shared background image. dataUrl is a compressed JPEG, under 900 KB. */
export interface Background {
  id: string;
  dataUrl: string;
  createdBy: PersonId | null;
  createdAt: number;
}

/** Per person preferences. Doc id is the person id. */
export interface Prefs {
  personId: PersonId;
  backgroundId: string | null;
}

export const BACKGROUND_MAX_CHARS = 900_000;
