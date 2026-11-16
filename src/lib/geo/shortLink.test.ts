import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractCoordsFromHtml,
  extractNameFromHtml,
  geocodeCandidates,
  geocodeQuery,
  interpretResolved,
  isShortLink,
  resolveShortLink,
} from './shortLink';

const FINAL =
  'https://www.google.com/maps/place/Some+Cafe/@3.1478,101.7130,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d3.1479!4d101.7131';
const DOT = String.fromCharCode(0xb7);
const HTML = `<html><head><meta property="og:title" content="Some Cafe ${DOT} Google Maps"><meta content="https://maps.google.com/maps/api/staticmap?center=3.1480%2C101.7132&amp;zoom=15" itemprop="image"></head></html>`;

afterEach(() => vi.unstubAllGlobals());

describe('isShortLink', () => {
  it('detects short hosts only', () => {
    expect(isShortLink('https://maps.app.goo.gl/AbC?g_st=ic')).toBe(true);
    expect(isShortLink('maps.app.goo.gl/AbC')).toBe(true);
    expect(isShortLink('https://goo.gl/maps/xyz')).toBe(true);
    expect(isShortLink('https://www.google.com/maps/place/X')).toBe(false);
    expect(isShortLink('nonsense')).toBe(false);
  });
});

describe('extractCoordsFromHtml', () => {
  it('reads staticmap center', () => {
    expect(extractCoordsFromHtml(HTML)).toEqual({ lat: 3.148, lng: 101.7132 });
  });
  it('prefers Malaysia over other matches, else any match', () => {
    expect(extractCoordsFromHtml('x !3d40.7!4d-74.0 y !3d3.15!4d101.71')).toEqual({ lat: 3.15, lng: 101.71 });
    expect(extractCoordsFromHtml('x !3d40.7!4d-74.0')).toEqual({ lat: 40.7, lng: -74 });
  });
  it('reads @ and ll forms', () => {
    expect(extractCoordsFromHtml('<a href="https://www.google.com/maps/@3.1,101.6,15z">')).toEqual({
      lat: 3.1,
      lng: 101.6,
    });
    expect(extractCoordsFromHtml('href="/maps?ll=3.2,101.5&amp;z=1"')).toEqual({ lat: 3.2, lng: 101.5 });
    expect(extractCoordsFromHtml('center=3.3,101.4')).toEqual({ lat: 3.3, lng: 101.4 });
  });
  it('returns null with no match', () => {
    expect(extractCoordsFromHtml('<html></html>')).toBeNull();
  });
});

describe('extractNameFromHtml', () => {
  it('strips the Google Maps suffix', () => {
    expect(extractNameFromHtml(HTML)).toBe('Some Cafe');
    expect(extractNameFromHtml('<meta property="og:title" content="Some Cafe - Google Maps">')).toBe(
      'Some Cafe',
    );
    expect(extractNameFromHtml('<meta content="Some Cafe" property="og:title">')).toBe('Some Cafe');
    expect(extractNameFromHtml('<meta property="og:title" content="Google Maps">')).toBeUndefined();
  });
});

describe('interpretResolved', () => {
  it('uses the final URL pin and place name', () => {
    expect(interpretResolved(FINAL, null)).toEqual({ lat: 3.1479, lng: 101.7131, name: 'Some Cafe' });
  });
  it('falls back to HTML coordinates and og name', () => {
    expect(interpretResolved(null, HTML)).toEqual({ lat: 3.148, lng: 101.7132, name: 'Some Cafe' });
  });
  it('returns no-coords with a name, else unresolved', () => {
    expect(interpretResolved('https://www.google.com/maps/place/Some+Cafe', '<html></html>')).toEqual({
      error: 'no-coords',
      name: 'Some Cafe',
      query: 'Some Cafe',
    });
    expect(interpretResolved(null, '<html></html>')).toEqual({ error: 'unresolved' });
    expect(interpretResolved(null, null)).toEqual({ error: 'unresolved' });
  });
});

const CONSENT =
  'https://consent.google.com/ml?continue=https://maps.google.com/maps?q%3DSome%2BCafe%2B@%2BArea,%2B6,%2BJln%2BTest%2B4,%2BArea,%2B59100%2BKuala%2BLumpur%26ftid%3D0x1:0x2%26entry%3Dgps&gl=MY&hl=en';

describe('consent pages', () => {
  it('unwraps continue= and returns the name and full query', () => {
    expect(interpretResolved(CONSENT, null)).toEqual({
      error: 'no-coords',
      name: 'Some Cafe @ Area',
      query: 'Some Cafe @ Area, 6, Jln Test 4, Area, 59100 Kuala Lumpur',
    });
  });
  it('reads the target from a consent form in HTML', () => {
    const html =
      '<form action="https://consent.google.com/save"><input type="hidden" name="continue" value="https://www.google.com/maps/place/Some+Cafe/data=!4m2!3m1!1s0x0:0x0!3d3.15!4d101.71?entry=tts&amp;g_st=ic"></form>';
    expect(interpretResolved('https://consent.google.com/ml?x=1', html)).toEqual({
      lat: 3.15,
      lng: 101.71,
      name: 'Some Cafe',
    });
  });
});

describe('geocodeQuery', () => {
  const hit = (name: string, lat = 3.13) => ({
    name,
    address: 'Area',
    lat,
    lng: 101.67,
    osmRef: '',
    category: 'other' as const,
  });
  it('builds candidates from specific to broad', () => {
    expect(geocodeCandidates('Some Cafe @ Area, 6, Jln Test 4, Area, 59100 Kuala Lumpur')).toEqual([
      'Some Cafe @ Area, 6, Jalan Test 4, Area, 59100 Kuala Lumpur',
      'Some Cafe @ Area',
      'Jalan Test 4, Area, Kuala Lumpur',
      'Jalan Test 4, Area',
      'Some Cafe',
    ]);
  });
  it('falls through empty and failing searches to the street', async () => {
    const search = vi.fn(async (q: string) => {
      if (q.startsWith('Some Cafe @ Area,')) throw new Error('down');
      if (q.startsWith('Jalan Test 4, Area, Kuala')) return [hit('Jalan Test 4')];
      return [];
    });
    expect(
      await geocodeQuery('Some Cafe @ Area, 6, Jln Test 4, Area, 59100 Kuala Lumpur', search),
    ).toMatchObject({
      name: 'Jalan Test 4',
    });
  });
  it('returns null when nothing matches', async () => {
    expect(await geocodeQuery('Nowhere, 1, Jln X', async () => [])).toBeNull();
  });
});

type Route = Record<string, () => unknown>;
function routeFetch(routes: Route) {
  return vi.fn(async (url: string) => {
    for (const [k, v] of Object.entries(routes)) {
      if (String(url).includes(k)) {
        const body = v();
        if (body instanceof Error) throw body;
        return {
          ok: true,
          json: async () => body,
          text: async () => String(body),
        };
      }
    }
    throw new Error('blocked');
  });
}

describe('resolveShortLink', () => {
  it('asks every proxy in parallel', async () => {
    const f = routeFetch({});
    vi.stubGlobal('fetch', f);
    await resolveShortLink('https://maps.app.goo.gl/AbC?g_st=ic');
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('api.allorigins.win/get?url=https%3A%2F%2Fmaps.app.goo.gl'))).toBe(
      true,
    );
    expect(urls.some((u) => u.includes('unshorten.me/json/https://maps.app.goo.gl/AbC'))).toBe(true);
    expect(urls.some((u) => u.includes('codetabs.com'))).toBe(true);
    expect(urls.some((u) => u.includes('corsproxy.io/?url='))).toBe(true);
  });
  it('takes a pin from allorigins', async () => {
    vi.stubGlobal('fetch', routeFetch({ allorigins: () => ({ status: { url: FINAL }, contents: '' }) }));
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC?g_st=ic')).toEqual({
      lat: 3.1479,
      lng: 101.7131,
      name: 'Some Cafe',
    });
  });
  it('takes a pin from an HTML proxy when others fail', async () => {
    vi.stubGlobal('fetch', routeFetch({ corsproxy: () => HTML, allorigins: () => new Error('down') }));
    expect(await resolveShortLink('maps.app.goo.gl/AbC')).toMatchObject({ lat: 3.148, lng: 101.7132 });
  });
  it('returns the query from unshorten.me consent redirect', async () => {
    vi.stubGlobal('fetch', routeFetch({ 'unshorten.me': () => ({ resolved_url: CONSENT, success: true }) }));
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC')).toMatchObject({
      error: 'no-coords',
      name: 'Some Cafe @ Area',
    });
  });
  it('reports unresolved when all fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC')).toEqual({ error: 'unresolved' });
  });
});
