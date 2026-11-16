import type { DayConfig, ItineraryItem, Poi } from '../../contracts/types';

export interface Stop {
  poi: Poi;
  /** Itinerary item id. */
  itemId: string;
  /** 1 based position in the day's stop list. */
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

/** Kept so callers compile. Routing no longer uses the day start or end. */
type DayRoute = Partial<Pick<DayConfig, 'startPoiId' | 'endPoiId'>>;

/** Colour variable for stop n (1 based). The leg leaving stop n shares it. */
export function stopColorVar(n: number): string {
  return `--leg-${((n - 1) % 8) + 1}`;
}

/** Ordered stops for a day: items that have a POI, by startMin. Consecutive duplicate POIs are dropped. */
export function stopsFor(items: ItineraryItem[], pois: Poi[], _day?: DayRoute): Stop[] {
  const byId = new Map(pois.map((p) => [p.id, p]));
  const sorted = [...items].sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin);
  const stops: Stop[] = [];
  for (const it of sorted) {
    const poi = it.poiId ? byId.get(it.poiId) : undefined;
    if (!poi) continue;
    if (stops.length && stops[stops.length - 1].poi.id === poi.id) continue;
    stops.push({ poi, itemId: it.id, number: stops.length + 1 });
  }
  return stops;
}

/** Legs between consecutive stops. Leg i leaves stop i + 1 and takes its colour. */
export function buildLegs(items: ItineraryItem[], pois: Poi[], day?: DayRoute): Leg[] {
  const stops = stopsFor(items, pois, day);
  const legs: Leg[] = [];
  for (let i = 1; i < stops.length; i++) {
    const index = i - 1;
    const from = stops[i - 1].poi;
    const to = stops[i].poi;
    legs.push({ index, from, to, key: legKey(from, to), colorVar: stopColorVar(i) });
  }
  return legs;
}

/** 1 based stop number of each item. Items dropped as duplicates have no entry. */
export function legIndexByItem(items: ItineraryItem[], pois: Poi[], day?: DayRoute): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stopsFor(items, pois, day)) out[s.itemId] = s.number;
  return out;
}
