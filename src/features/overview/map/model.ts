import type { DateKey, Poi } from '../../../contracts/types';
import { TRIP_DAYS } from '../../../contracts/types';
import type { Leg, Stop } from '../../../lib/geo';

export type LngLat = [number, number];

/** Minimal shape of a resolved leg, kept structural so this module stays pure. */
export interface ResolvedLike {
  key: string;
  coords: LngLat[];
  fallback: boolean;
  distanceM?: number;
  durationS?: number;
}

export interface DisplayLeg {
  leg: Leg;
  coords: LngLat[];
  /** Still resolving or a straight line fallback. */
  dashed: boolean;
  loading: boolean;
  fallback: boolean;
  distanceM: number | null;
  durationS: number | null;
}

export interface LineFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: LngLat[] };
  properties: { index: number; color: string; dashed: 0 | 1 };
}

export interface LineCollection {
  type: 'FeatureCollection';
  features: LineFeature[];
}

export function defaultDay(today: DateKey | null): DateKey {
  return today ?? TRIP_DAYS[0];
}

/** Pair each current leg with its resolved result, matched by leg key. Unmatched legs are loading. */
export function displayLegs(legs: Leg[], resolved: ResolvedLike[]): DisplayLeg[] {
  const byKey = new Map(resolved.map((r) => [r.key, r]));
  return legs.map((leg) => {
    const r = byKey.get(leg.key);
    const straight: LngLat[] = [
      [leg.from.lng, leg.from.lat],
      [leg.to.lng, leg.to.lat],
    ];
    if (!r) {
      return {
        leg,
        coords: straight,
        dashed: true,
        loading: true,
        fallback: false,
        distanceM: null,
        durationS: null,
      };
    }
    if (r.fallback) {
      return {
        leg,
        coords: r.coords.length >= 2 ? r.coords : straight,
        dashed: true,
        loading: false,
        fallback: true,
        distanceM: null,
        durationS: null,
      };
    }
    return {
      leg,
      coords: r.coords,
      dashed: false,
      loading: false,
      fallback: false,
      distanceM: r.distanceM ?? null,
      durationS: r.durationS ?? null,
    };
  });
}

export function lineCollection(legs: DisplayLeg[], colorOf: (colorVar: string) => string): LineCollection {
  return {
    type: 'FeatureCollection',
    features: legs.map((d) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: d.coords },
      properties: { index: d.leg.index, color: colorOf(d.leg.colorVar), dashed: d.dashed ? 1 : 0 },
    })),
  };
}

export interface MarkerModel {
  key: string;
  poi: Poi;
  kind: 'house' | 'number';
  /** Stop number for numbered markers. */
  n: number;
  /** Colour of the arriving leg, for numbered markers. */
  colorVar: string | null;
}

/** One marker per stop. Start and end stays render as house markers; the same POI for both is one marker. */
export function markerModels(stops: Stop[], legs: Leg[]): MarkerModel[] {
  const out: MarkerModel[] = [];
  const houses = new Set<string>();
  for (const s of stops) {
    if (s.role === 'item') {
      const leg = legs[s.number - 1];
      out.push({
        key: `item:${s.itemId ?? s.number}`,
        poi: s.poi,
        kind: 'number',
        n: s.number,
        colorVar: leg ? leg.colorVar : null,
      });
    } else if (!houses.has(s.poi.id)) {
      houses.add(s.poi.id);
      out.push({ key: `house:${s.poi.id}`, poi: s.poi, kind: 'house', n: 0, colorVar: null });
    }
  }
  return out;
}

export function boundsOf(points: LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of points) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}
