import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractCoordsFromHtml,
  extractNameFromHtml,
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
    });
    expect(interpretResolved(null, '<html></html>')).toEqual({ error: 'unresolved' });
    expect(interpretResolved(null, null)).toEqual({ error: 'unresolved' });
  });
});

describe('resolveShortLink', () => {
  it('uses allorigins first', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: { url: FINAL }, contents: '' }),
    });
    vi.stubGlobal('fetch', f);
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC?g_st=ic')).toEqual({
      lat: 3.1479,
      lng: 101.7131,
      name: 'Some Cafe',
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toContain('api.allorigins.win/get?url=https%3A%2F%2Fmaps.app.goo.gl');
  });
  it('falls back to corsproxy on failure', async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: true, text: async () => HTML });
    vi.stubGlobal('fetch', f);
    const r = await resolveShortLink('maps.app.goo.gl/AbC');
    expect(r).toMatchObject({ lat: 3.148, lng: 101.7132 });
    expect(String(f.mock.calls[1][0])).toContain('corsproxy.io/?url=');
  });
  it('reports unresolved when both fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await resolveShortLink('https://maps.app.goo.gl/AbC')).toEqual({ error: 'unresolved' });
  });
});
