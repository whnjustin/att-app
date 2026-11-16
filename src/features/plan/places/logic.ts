import type { ItineraryItem, Poi, PoiCategory } from '../../../contracts/types';

export type GroupKey = 'restaurant' | 'cafe' | 'bar' | 'other';

export interface PlaceGroup {
  key: GroupKey;
  title: string;
  places: Poi[];
}

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'restaurant', title: 'Restaurants' },
  { key: 'cafe', title: 'Cafes' },
  { key: 'bar', title: 'Bars' },
  { key: 'other', title: 'Other' },
];

export function groupKeyFor(category: PoiCategory): GroupKey {
  return category === 'stay' ? 'other' : category;
}

/** Four groups in fixed order, alphabetical within a group, empty groups omitted. */
export function groupPlaces(pois: Poi[]): PlaceGroup[] {
  return GROUPS.map((g) => ({
    ...g,
    places: pois
      .filter((p) => groupKeyFor(p.category) === g.key)
      .sort(
        (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id),
      ),
  })).filter((g) => g.places.length > 0);
}

/** Number of itinerary items that reference each POI. */
export function usageCounts(items: ItineraryItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (it.poiId) out.set(it.poiId, (out.get(it.poiId) ?? 0) + 1);
  }
  return out;
}

export function displayAddress(address: string | null | undefined): string | undefined {
  const a = (address ?? '').trim();
  return a === '' ? undefined : a;
}

export function normaliseName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const DUPLICATE_RADIUS_M = 100;

export interface Candidate {
  name: string;
  lat: number;
  lng: number;
  osmRef: string | null;
}

/** Same osmRef, or same normalised name within 100 m. */
export function findDuplicate(candidate: Candidate, pois: Poi[]): Poi | null {
  if (candidate.osmRef) {
    const byRef = pois.find((p) => p.osmRef === candidate.osmRef);
    if (byRef) return byRef;
  }
  const n = normaliseName(candidate.name);
  if (!n) return null;
  return (
    pois.find((p) => normaliseName(p.name) === n && haversineM(p, candidate) <= DUPLICATE_RADIUS_M) ?? null
  );
}

export const MIN_SEARCH_CHARS = 2;

/** `Not found` shows only once a search for the current query has finished with zero hits. */
export function shouldShowNotFound(s: {
  query: string;
  settledQuery: string | null;
  hitCount: number;
  failed: boolean;
}): boolean {
  const q = s.query.trim();
  return !s.failed && q.length >= MIN_SEARCH_CHARS && s.settledQuery === q && s.hitCount === 0;
}

/** `Searching` shows once the debounce has elapsed and the current query has not settled. */
export function shouldShowSearching(s: {
  query: string;
  settledQuery: string | null;
  failed: boolean;
  debounced: boolean;
}): boolean {
  const q = s.query.trim();
  return !s.failed && s.debounced && q.length >= MIN_SEARCH_CHARS && s.settledQuery !== q;
}
