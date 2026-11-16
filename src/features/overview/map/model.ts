import { DAY_END_MIN } from '../../../contracts/types';
import type { DateKey, Poi } from '../../../contracts/types';
import { TRIP_DAYS } from '../../../contracts/types';
import type { Leg, Stop } from '../../../lib/geo';
import { stopColorVar } from '../../../lib/geo/legs';
import { snap30 } from '../../../lib/time';

const DAY_MIN = DAY_END_MIN;

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
  /** Stop number for numbered markers, 0 for residences. */
  n: number;
  /** Colour of the stop, for numbered markers. */
  colorVar: string | null;
}

/** Numbered markers for the stops, plus a quiet house marker for every residence. */
export function markerModels(stops: Stop[], residences: Poi[]): MarkerModel[] {
  const out: MarkerModel[] = residences.map((poi) => ({
    key: `house:${poi.id}`,
    poi,
    kind: 'house',
    n: 0,
    colorVar: null,
  }));
  for (const s of stops) {
    out.push({
      key: `item:${s.itemId}`,
      poi: s.poi,
      kind: 'number',
      n: s.number,
      colorVar: stopColorVar(s.number),
    });
  }
  return out;
}

export interface Span {
  startMin: number;
  endMin: number;
}

/**
 * Swap two stops in time. The earlier and later items exchange start times and each keeps its own
 * duration, on the 30 minute grid, with the end clamped to the end of the day.
 */
export function swapTimes(a: Span, b: Span): [Span, Span] {
  const place = (start: number, own: Span): Span => {
    const dur = Math.max(30, snap30(own.endMin - own.startMin));
    return { startMin: start, endMin: Math.min(DAY_MIN, start + dur) };
  };
  return [place(b.startMin, a), place(a.startMin, b)];
}

/**
 * Move the stop at fromIndex to toIndex. The involved stops keep the same set of start times, handed out in
 * time order to the stops in their new order; each keeps its own duration, on the 30 minute grid, with the end
 * clamped to the end of the day. Returns the new span of every input item at its input index.
 */
export function reorderTimes(items: Span[], fromIndex: number, toIndex: number): Span[] {
  const n = items.length;
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= n || toIndex >= n) {
    return items.map((s) => ({ ...s }));
  }
  const lo = Math.min(fromIndex, toIndex);
  const hi = Math.max(fromIndex, toIndex);
  const order: number[] = [];
  for (let i = lo; i <= hi; i++) order.push(i);
  order.splice(fromIndex - lo, 1);
  order.splice(toIndex - lo, 0, fromIndex);
  const starts = items
    .slice(lo, hi + 1)
    .map((s) => s.startMin)
    .sort((x, y) => x - y);
  const out = items.map((s) => ({ ...s }));
  order.forEach((src, k) => {
    const own = items[src];
    const dur = Math.max(30, snap30(own.endMin - own.startMin));
    out[src] = { startMin: starts[k], endMin: Math.min(DAY_MIN, starts[k] + dur) };
  });
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
