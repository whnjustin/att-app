import type { Poi, RouteLeg } from '../../contracts/types';

export const OSRM_INTERVAL_MS = 1000;
export const OSRM_TIMEOUT_MS = 8000;

type LL = Pick<Poi, 'lat' | 'lng'>;

let tail: Promise<unknown> = Promise.resolve();
let lastStart = -Infinity;

/** Test helper: forget queue state. */
export function resetOsrmQueue(): void {
  tail = Promise.resolve();
  lastStart = -Infinity;
}

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Run tasks one at a time, each starting at least OSRM_INTERVAL_MS after the previous start. */
export function enqueueOsrm<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const run = async () => {
    if (signal?.aborted) throw abortError();
    const wait = lastStart + OSRM_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait, signal);
    lastStart = Date.now();
    return task();
  };
  const p = tail.then(run, run);
  tail = p.catch(() => undefined);
  return p;
}

export function osrmUrl(a: LL, b: LL): string {
  return `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=polyline`;
}

interface OsrmResponse {
  code?: string;
  routes?: { geometry: string; distance: number; duration: number }[];
}

export function fetchLeg(a: LL, b: LL, key: string, signal?: AbortSignal): Promise<RouteLeg> {
  return enqueueOsrm(async () => {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS);
    try {
      const res = await fetch(osrmUrl(a, b), { signal: ctrl.signal });
      if (!res.ok) throw new Error(`osrm ${res.status}`);
      const json = (await res.json()) as OsrmResponse;
      const r = json.routes?.[0];
      if (json.code !== 'Ok' || !r) throw new Error(`osrm ${json.code ?? 'empty'}`);
      return {
        key,
        polyline: r.geometry,
        distanceM: r.distance,
        durationS: r.duration,
        fetchedAt: Date.now(),
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }, signal);
}
