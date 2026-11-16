import type { DayConfig, ItineraryItem, Poi } from '../../contracts/types';

export interface Stop {
  poi: Poi;
  /** Itinerary item id, or null for the day start or end. */
  itemId: string | null;
  role: 'start' | 'item' | 'end';
  /** Position in the stop list, 0 for the start. */
  number: number;
}

export interface Leg {
  index: number;
  from: Poi;
  to: Poi;
  key: string;
  colorVar: string;
}

const round5 = (n: number) => (Math.round(n * 1e5) / 1e5).toString().replace(/\./g, 'p').replace(/-/g, 'm');

export function legKey(a: Pick<Poi, 'lat' | 'lng'>, b: Pick<Poi, 'lat' | 'lng'>): string {
  return `${round5(a.lat)},${round5(a.lng)}_${round5(b.lat)},${round5(b.lng)}`;
}

type DayRoute = Pick<DayConfig, 'startPoiId' | 'endPoiId'>;

/** Ordered stops for a day: start, linked items by startMin, end. Consecutive duplicate POIs are dropped. */
export function stopsFor(items: ItineraryItem[], pois: Poi[], day: DayRoute): Stop[] {
  const byId = new Map(pois.map((p) => [p.id, p]));
  const raw: Omit<Stop, 'number'>[] = [];
  const start = byId.get(day.startPoiId);
  if (start) raw.push({ poi: start, itemId: null, role: 'start' });
  const sorted = [...items].sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin);
  for (const it of sorted) {
    const poi = it.poiId ? byId.get(it.poiId) : undefined;
    if (poi) raw.push({ poi, itemId: it.id, role: 'item' });
  }
  const end = byId.get(day.endPoiId);
  if (end) raw.push({ poi: end, itemId: null, role: 'end' });
  const stops: Stop[] = [];
  for (const s of raw) {
    if (stops.length && stops[stops.length - 1].poi.id === s.poi.id) continue;
    stops.push({ ...s, number: stops.length });
  }
  return stops;
}

export function buildLegs(items: ItineraryItem[], pois: Poi[], day: DayRoute): Leg[] {
  const stops = stopsFor(items, pois, day);
  const legs: Leg[] = [];
  for (let i = 1; i < stops.length; i++) {
    const index = i - 1;
    const from = stops[i - 1].poi;
    const to = stops[i].poi;
    legs.push({ index, from, to, key: legKey(from, to), colorVar: `--leg-${(index % 8) + 1}` });
  }
  return legs;
}

/** 1 based number of the leg that arrives at each item. Items dropped as duplicates have no entry. */
export function legIndexByItem(items: ItineraryItem[], pois: Poi[], day: DayRoute): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stopsFor(items, pois, day)) {
    if (s.itemId && s.number > 0) out[s.itemId] = s.number;
  }
  return out;
}
