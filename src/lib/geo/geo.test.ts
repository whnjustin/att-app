import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayConfig, ItineraryItem, Poi, RouteLeg } from '../../contracts/types';
import {
  buildLegs,
  createDebouncedSearch,
  decodePolyline,
  googleEmbedUrl,
  googleMapsUrl,
  guessCategory,
  legIndexByItem,
  legKey,
  parseGoogleMapsUrl,
  parsePhoton,
  resolveLegs,
  stopsFor,
  wazeUrl,
} from './index';
import { stopColorVar } from './legs';
import { enqueueOsrm, resetOsrmQueue } from './osrm';
import { clearRouteMemory } from './routeService';

vi.mock('maplibre-gl', () => ({ default: {} }));

const fixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [101.7088, 3.1456] },
      properties: {
        name: 'Restaurant A',
        osm_type: 'N',
        osm_id: 111,
        osm_key: 'amenity',
        osm_value: 'restaurant',
        district: 'Area Long Name',
        locality: 'Loc',
        city: 'Kuala Lumpur',
        street: 'Street A',
        housenumber: '1',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [101.7041, 3.1518] },
      properties: {
        name: 'Cafe A',
        osm_type: 'W',
        osm_id: 222,
        osm_key: 'shop',
        osm_value: 'bakery',
        city: 'Kuala Lumpur',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [101.7, 3.15] },
      properties: { osm_type: 'R', osm_id: 333, osm_key: 'highway', osm_value: 'bus_stop' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [101.71, 3.16] },
      properties: {
        name: 'Plain',
        osm_type: 'R',
        osm_id: 444,
        osm_key: 'tourism',
        osm_value: 'attraction',
        street: 'Street B',
      },
    },
  ],
};

describe('photon', () => {
  it('parses features, skipping nameless ones', () => {
    const hits = parsePhoton(fixture);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toEqual({
      name: 'Restaurant A',
      address: 'Loc',
      lat: 3.1456,
      lng: 101.7088,
      osmRef: 'N111',
      category: 'restaurant',
    });
    expect(hits[1].category).toBe('cafe');
    expect(hits[1].address).toBe('Kuala Lumpur');
    expect(hits[2].address).toBe('Street B');
    expect(hits[2].osmRef).toBe('R444');
  });

  it('tolerates junk', () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({})).toEqual([]);
  });

  it('guessCategory', () => {
    expect(guessCategory('amenity', 'fast_food')).toBe('restaurant');
    expect(guessCategory('amenity', 'food_court')).toBe('restaurant');
    expect(guessCategory('amenity', 'ice_cream')).toBe('cafe');
    expect(guessCategory('shop', 'coffee')).toBe('cafe');
    expect(guessCategory('amenity', 'pub')).toBe('bar');
    expect(guessCategory('amenity', 'nightclub')).toBe('bar');
    expect(guessCategory('tourism', 'hotel')).toBe('other');
    expect(guessCategory(undefined, undefined)).toBe('other');
  });
});

describe('createDebouncedSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('debounces and aborts the previous request', async () => {
    const signals: AbortSignal[] = [];
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: { signal: AbortSignal }) => {
        urls.push(url);
        signals.push(init.signal);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(fixture) });
      }),
    );
    const s = createDebouncedSearch(350);
    const first = s.search('a');
    await vi.advanceTimersByTimeAsync(100);
    const second = s.search('ab');
    expect(await first).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(await second).toHaveLength(3);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(
      'https://photon.komoot.io/api/?q=ab&lat=3.139&lon=101.6869&limit=8&lang=en&bbox=101.40,2.85,101.95,3.35',
    );
    const third = s.search('abc');
    await vi.advanceTimersByTimeAsync(350);
    await third;
    expect(signals).toHaveLength(2);
  });

  it('aborts an in flight request when superseded', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: { signal: AbortSignal }) => {
        signals.push(init.signal);
        return new Promise(() => undefined);
      }),
    );
    const s = createDebouncedSearch(10);
    const p = s.search('x');
    await vi.advanceTimersByTimeAsync(10);
    expect(signals[0].aborted).toBe(false);
    s.search('xy');
    expect(signals[0].aborted).toBe(true);
    expect(await p).toBeNull();
    s.cancel();
  });
});

describe('parseGoogleMapsUrl', () => {
  it('prefers !3d!4d over @', () => {
    const r = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Name+Here/@3.1456,101.7088,17z/data=!4m5!3m4!1s0x0:0x0!8m2!3d3.1457!4d101.7089',
    );
    expect(r).toEqual({ lat: 3.1457, lng: 101.7089, name: 'Name Here' });
  });
  it('uses @ when no pin', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@3.1456,101.7088,17z')).toEqual({
      lat: 3.1456,
      lng: 101.7088,
    });
  });
  it('parses q= and query=', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=3.14,101.70')).toEqual({ lat: 3.14, lng: 101.7 });
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=3.14,101.70')).toEqual({
      lat: 3.14,
      lng: 101.7,
    });
  });
  it('flags short links', () => {
    expect(parseGoogleMapsUrl('https://maps.app.goo.gl/xyz')).toEqual({ error: 'short-link' });
    expect(parseGoogleMapsUrl('https://goo.gl/maps/xyz')).toEqual({ error: 'short-link' });
  });
  it('flags missing coords', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/place/Name')).toEqual({ error: 'no-coords' });
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=some+text')).toEqual({
      error: 'no-coords',
    });
    expect(parseGoogleMapsUrl('not a url ::')).toEqual({ error: 'no-coords' });
  });
});

describe('links', () => {
  const poi = { name: 'Cafe A', address: 'Area G', lat: 3.1518, lng: 101.7041 };
  it('builds urls', () => {
    expect(googleMapsUrl(poi)).toBe('https://www.google.com/maps/search/?api=1&query=Cafe%20A%20Area%20G');
    expect(googleMapsUrl({ ...poi, name: '', address: '' })).toContain('query=3.1518,101.7041');
    expect(googleEmbedUrl(poi)).toBe('https://maps.google.com/maps?q=3.1518,101.7041&z=17&output=embed');
    expect(wazeUrl(poi)).toBe('https://waze.com/ul?ll=3.1518,101.7041&navigate=yes');
  });
});

describe('polyline', () => {
  it('decodes the Google example to [lng, lat]', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    const want = [
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ];
    expect(pts).toHaveLength(3);
    pts.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(want[i][0], 5);
      expect(p[1]).toBeCloseTo(want[i][1], 5);
    });
  });
  it('handles empty and truncated input', () => {
    expect(decodePolyline('')).toEqual([]);
    expect(() => decodePolyline('_p~iF')).toThrow();
  });
});

function poi(id: string, lat: number, lng: number): Poi {
  return {
    id,
    name: id,
    category: 'other',
    lat,
    lng,
    address: '',
    source: 'seed',
    osmRef: null,
    note: '',
    createdAt: 0,
    createdBy: null,
    updatedAt: 0,
  };
}

function item(
  id: string,
  startMin: number,
  poiId: string | null,
  kind: 'meal' | 'poi' = 'poi',
): ItineraryItem {
  return {
    id,
    date: '2026-11-20',
    kind,
    meal: kind === 'meal' ? 'lunch' : null,
    poiId,
    startMin,
    endMin: startMin + 30,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: null,
  };
}

const pois = [
  poi('home', 3.139, 101.6869),
  poi('a', 3.1456, 101.7088),
  poi('b', 3.1518, 101.7041),
  poi('c', 3.1583, 101.7123),
];
const day: Pick<DayConfig, 'startPoiId' | 'endPoiId'> = { startPoiId: 'home', endPoiId: 'home' };

describe('legKey', () => {
  it('rounds to 5 decimals and escapes', () => {
    expect(legKey({ lat: 3.139, lng: 101.6869 }, { lat: -3.1234567, lng: 101.7088 })).toBe(
      '3p139,101p6869_m3p12346,101p7088',
    );
    expect(legKey({ lat: 3, lng: 101 }, { lat: 3.000001, lng: 101 })).toBe('3,101_3,101');
  });
});

describe('buildLegs', () => {
  it('sorts and links consecutive stops without the stay', () => {
    const legs = buildLegs([item('i2', 900, 'b'), item('i1', 600, 'a')], pois, day);
    expect(legs.map((l) => [l.from.id, l.to.id])).toEqual([['a', 'b']]);
    expect(legs[0].index).toBe(0);
    expect(legs[0].colorVar).toBe('--leg-1');
    expect(legs[0].key).toBe(legKey(pois[1], pois[2]));
  });
  it('skips unlinked meals and missing pois', () => {
    const items = [
      item('m', 700, null, 'meal'),
      item('x', 800, 'gone'),
      item('i', 900, 'a'),
      item('j', 950, 'b'),
    ];
    expect(stopsFor(items, pois, day).map((s) => s.poi.id)).toEqual(['a', 'b']);
    expect(buildLegs(items, pois, day).map((l) => l.to.id)).toEqual(['b']);
  });
  it('drops consecutive duplicates', () => {
    const legs = buildLegs([item('i1', 600, 'home'), item('i2', 700, 'a'), item('i3', 800, 'a')], pois, day);
    expect(legs.map((l) => [l.from.id, l.to.id])).toEqual([['home', 'a']]);
  });
  it('no legs for zero or one stop', () => {
    expect(buildLegs([], pois, day)).toEqual([]);
    expect(buildLegs([item('i1', 600, 'a')], pois, day)).toEqual([]);
  });
  it('wraps colours after 8 and the leg takes the colour of the stop it leaves', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(`i${i}`, i * 30, i % 2 ? 'a' : 'b'));
    const legs = buildLegs(items, pois, day);
    expect(legs).toHaveLength(9);
    expect(legs[7].colorVar).toBe('--leg-8');
    expect(legs[8].colorVar).toBe('--leg-1');
    expect(stopColorVar(1)).toBe('--leg-1');
    expect(stopColorVar(9)).toBe('--leg-1');
    expect(stopColorVar(10)).toBe('--leg-2');
  });
  it('stopsFor and legIndexByItem agree on 1 based stop numbers', () => {
    const items = [item('i1', 600, 'a'), item('i2', 700, 'a'), item('i3', 800, 'b')];
    const stops = stopsFor(items, pois, day);
    expect(stops.map((s) => [s.poi.id, s.number, s.itemId])).toEqual([
      ['a', 1, 'i1'],
      ['b', 2, 'i3'],
    ]);
    expect(legIndexByItem(items, pois, day)).toEqual({ i1: 1, i3: 2 });
  });
});

describe('osrm queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetOsrmQueue();
  });
  afterEach(() => vi.useRealTimers());

  it('spaces starts by one second', async () => {
    const starts: number[] = [];
    const t0 = Date.now();
    const task = () => {
      starts.push(Date.now() - t0);
      return Promise.resolve();
    };
    const all = Promise.all([enqueueOsrm(task), enqueueOsrm(task), enqueueOsrm(task)]);
    await vi.advanceTimersByTimeAsync(3000);
    await all;
    expect(starts).toEqual([0, 1000, 2000]);
  });

  it('rejects when aborted while waiting', async () => {
    await enqueueOsrm(() => Promise.resolve());
    const ctrl = new AbortController();
    const p = enqueueOsrm(() => Promise.resolve(), ctrl.signal);
    const assertion = expect(p).rejects.toThrow();
    ctrl.abort();
    await assertion;
  });
});

describe('resolveLegs', () => {
  const route: RouteLeg = {
    key: '',
    polyline: '_p~iF~ps|U_ulLnnqC',
    distanceM: 1234,
    durationS: 56,
    fetchedAt: 1,
  };

  function mkStore(initial: RouteLeg | null) {
    const calls: string[] = [];
    return {
      calls,
      getRoute: vi.fn(async (k: string) => {
        calls.push('get');
        return initial ? { ...initial, key: k } : null;
      }),
      putRoute: vi.fn(async () => {
        calls.push('put');
      }),
    };
  }
  const legs = () => buildLegs([item('i0', 500, 'home'), item('i1', 600, 'a')], pois, day);

  beforeEach(() => {
    clearRouteMemory();
    resetOsrmQueue();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the store before OSRM and skips putRoute', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const store = mkStore(route);
    const out = await resolveLegs(legs(), store);
    expect(out[0].fallback).toBe(false);
    expect(out[0]).toMatchObject({ distanceM: 1234, durationS: 56 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.putRoute).not.toHaveBeenCalled();
    // memory cache second time
    await resolveLegs(legs(), store);
    expect(store.getRoute).toHaveBeenCalledTimes(1);
  });

  it('fetches from OSRM on store miss, then putRoute', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ geometry: route.polyline, distance: 10, duration: 5 }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const store = mkStore(null);
    const out = await resolveLegs(legs(), store);
    expect(store.calls).toEqual(['get', 'put']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls as unknown[][])[0][0])).toContain(
      'router.project-osrm.org/route/v1/driving/101.6869,3.139;101.7088,3.1456',
    );
    expect(out[0]).toMatchObject({ fallback: false, distanceM: 10, durationS: 5 });
    expect(out[0].coords).toHaveLength(2);
    const again = await resolveLegs(legs(), store);
    expect(again[0].fallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a straight line on failure and retries later', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    const store = mkStore(null);
    const out = await resolveLegs(legs(), store);
    expect(out[0].fallback).toBe(true);
    expect(out[0].coords).toEqual([
      [101.6869, 3.139],
      [101.7088, 3.1456],
    ]);
    expect(store.putRoute).not.toHaveBeenCalled();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ code: 'Ok', routes: [{ geometry: route.polyline, distance: 1, duration: 1 }] }),
      })),
    );
    vi.useFakeTimers();
    const p = resolveLegs(legs(), store);
    await vi.advanceTimersByTimeAsync(1500);
    expect((await p)[0].fallback).toBe(false);
    vi.useRealTimers();
  });
});
