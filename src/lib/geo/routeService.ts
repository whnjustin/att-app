import type { RouteLeg } from '../../contracts/types';
import type { Store } from '../../contracts/store';
import type { Leg } from './legs';
import { fetchLeg } from './osrm';
import { decodePolyline } from './polyline';

export type ResolvedLeg = Leg &
  (
    | { coords: [number, number][]; distanceM: number; durationS: number; fallback: false }
    | { coords: [[number, number], [number, number]]; fallback: true }
  );

type RouteStore = Pick<Store, 'getRoute' | 'putRoute'>;

const memory = new Map<string, RouteLeg>();
const inflight = new Map<string, Promise<RouteLeg>>();

/** Test helper. */
export function clearRouteMemory(): void {
  memory.clear();
  inflight.clear();
}

async function load(leg: Leg, store: RouteStore, signal?: AbortSignal): Promise<RouteLeg> {
  const cached = memory.get(leg.key);
  if (cached) return cached;
  let p = inflight.get(leg.key);
  if (!p) {
    p = (async () => {
      let route: RouteLeg | null = null;
      try {
        route = await store.getRoute(leg.key);
      } catch {
        route = null;
      }
      if (!route) {
        route = await fetchLeg(leg.from, leg.to, leg.key, signal);
        try {
          await store.putRoute(route);
        } catch {
          // a cache write failure must not lose the route
        }
      }
      memory.set(leg.key, route);
      return route;
    })();
    inflight.set(leg.key, p);
    const clear = () => inflight.delete(leg.key);
    p.then(clear, clear);
  }
  return p;
}

export async function resolveLegs(
  legs: Leg[],
  store: RouteStore,
  signal?: AbortSignal,
): Promise<ResolvedLeg[]> {
  return Promise.all(
    legs.map(async (leg): Promise<ResolvedLeg> => {
      try {
        const r = await load(leg, store, signal);
        return {
          ...leg,
          coords: decodePolyline(r.polyline),
          distanceM: r.distanceM,
          durationS: r.durationS,
          fallback: false,
        };
      } catch {
        return {
          ...leg,
          coords: [
            [leg.from.lng, leg.from.lat],
            [leg.to.lng, leg.to.lat],
          ],
          fallback: true,
        };
      }
    }),
  );
}
