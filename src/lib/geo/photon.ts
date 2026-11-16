import type { PoiCategory } from '../../contracts/types';

export interface PlaceHit {
  name: string;
  address: string;
  lat: number;
  lng: number;
  osmRef: string;
  category: PoiCategory;
}

interface PhotonProps {
  name?: string;
  osm_type?: string;
  osm_id?: number | string;
  osm_key?: string;
  osm_value?: string;
  district?: string;
  locality?: string;
  city?: string;
  street?: string;
  housenumber?: string;
}

interface PhotonFeature {
  geometry?: { type?: string; coordinates?: number[] };
  properties?: PhotonProps;
}

export interface PhotonResponse {
  features?: PhotonFeature[];
}

export function guessCategory(osmKey: string | undefined, osmValue: string | undefined): PoiCategory {
  const k = osmKey ?? '';
  const v = osmValue ?? '';
  if (k === 'amenity') {
    if (['restaurant', 'fast_food', 'food_court'].includes(v)) return 'restaurant';
    if (['cafe', 'ice_cream'].includes(v)) return 'cafe';
    if (['bar', 'pub', 'nightclub', 'biergarten'].includes(v)) return 'bar';
  }
  if (k === 'shop' && ['coffee', 'bakery'].includes(v)) return 'cafe';
  return 'other';
}

function shortAddress(p: PhotonProps): string {
  const parts = [p.district, p.locality, p.city].filter((x): x is string => !!x && x.trim() !== '');
  if (parts.length === 0) return p.street ?? '';
  return parts.reduce((a, b) => (b.length < a.length ? b : a));
}

export function parsePhoton(json: unknown): PlaceHit[] {
  const features = (json as PhotonResponse | null)?.features;
  if (!Array.isArray(features)) return [];
  const hits: PlaceHit[] = [];
  for (const f of features) {
    const p = f.properties;
    const c = f.geometry?.coordinates;
    if (!p || !p.name || !c || c.length < 2) continue;
    const [lng, lat] = c;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    hits.push({
      name: p.name,
      address: shortAddress(p),
      lat,
      lng,
      osmRef: p.osm_type && p.osm_id !== undefined ? `${p.osm_type}${p.osm_id}` : '',
      category: guessCategory(p.osm_key, p.osm_value),
    });
  }
  return hits;
}

export function photonUrl(q: string): string {
  return `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=3.139&lon=101.6869&limit=8&lang=en&bbox=101.40,2.85,101.95,3.35`;
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const query = q.trim();
  if (!query) return [];
  const res = await fetch(photonUrl(query), { signal });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  return parsePhoton(await res.json());
}

export interface DebouncedSearch {
  /** Resolves with hits, or null when superseded or cancelled. */
  search(q: string): Promise<PlaceHit[] | null>;
  cancel(): void;
}

export function createDebouncedSearch(ms = 350): DebouncedSearch {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ctrl: AbortController | null = null;
  let settle: ((v: PlaceHit[] | null) => void) | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    ctrl?.abort();
    ctrl = null;
    settle?.(null);
    settle = null;
  };

  const search = (q: string) => {
    cancel();
    return new Promise<PlaceHit[] | null>((resolve, reject) => {
      settle = resolve;
      timer = setTimeout(() => {
        timer = null;
        const mine = new AbortController();
        ctrl = mine;
        searchPlaces(q, mine.signal).then(
          (hits) => {
            if (ctrl !== mine) return;
            ctrl = null;
            settle = null;
            resolve(hits);
          },
          (err) => {
            if (ctrl !== mine || mine.signal.aborted) return;
            ctrl = null;
            settle = null;
            reject(err);
          },
        );
      }, ms);
    });
  };

  return { search, cancel };
}
