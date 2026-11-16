import { parseGoogleMapsUrl } from './gmapsUrl';
import type { PlaceHit } from './photon';

export type ShortLinkResult =
  | { lat: number; lng: number; name?: string }
  | { error: 'unresolved' }
  | { error: 'no-coords'; name: string; query: string };

interface Pt {
  lat: number;
  lng: number;
}

const NUM = '-?\\d+(?:\\.\\d+)?';
const MIDDLE_DOT = String.fromCharCode(0xb7);

export function isShortLink(input: string): boolean {
  const raw = input.trim();
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    const h = u.hostname.toLowerCase();
    return h === 'maps.app.goo.gl' || (h === 'goo.gl' && u.pathname.startsWith('/maps'));
  } catch {
    return false;
  }
}

function ok(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function inMalaysia(p: Pt): boolean {
  return p.lat >= 0.5 && p.lat <= 7.5 && p.lng >= 99 && p.lng <= 120;
}

function collect(html: string, re: RegExp): Pt[] {
  const out: Pt[] = [];
  for (const m of html.matchAll(re)) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (ok(lat, lng)) out.push({ lat, lng });
  }
  return out;
}

/** First coordinate pair in page HTML, preferring one inside Malaysia. */
export function extractCoordsFromHtml(html: string): Pt | null {
  const text = html
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/g, '&');
  const patterns = [
    new RegExp(`!3d(${NUM})!4d(${NUM})`, 'g'),
    new RegExp(`center=(${NUM})(?:%2C|%2c|,)(${NUM})`, 'g'),
    new RegExp(`maps[^"'\\s]*?@(${NUM}),(${NUM}),`, 'g'),
    new RegExp(`[?&;]ll=(${NUM})(?:%2C|%2c|,)(${NUM})`, 'g'),
  ];
  const all: Pt[] = [];
  for (const re of patterns) all.push(...collect(text, re));
  return all.find(inMalaysia) ?? all[0] ?? null;
}

function clean(s: string): string | undefined {
  let n = s.trim();
  n = n.replace(/\s*-\s*Google Maps\s*$/i, '');
  const i = n.lastIndexOf(` ${MIDDLE_DOT} `);
  if (i > 0 && /google maps/i.test(n.slice(i))) n = n.slice(0, i);
  n = n.trim();
  return n && !/^google maps$/i.test(n) ? n : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
}

const COORD_TEXT = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;

/** Follow consent and redirect wrappers (continue=, url=) to the inner Google Maps URL. */
export function unwrapGoogleUrl(url: string): string {
  let cur = url;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try {
      u = new URL(cur);
    } catch {
      return cur;
    }
    const inner = u.searchParams.get('continue') ?? (u.pathname === '/url' ? u.searchParams.get('q') : null);
    if (!inner || !/^https?:\/\//i.test(inner)) return cur;
    cur = inner;
  }
  return cur;
}

function decodeParam(s: string): string | undefined {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' ')).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Full place text from a resolved URL: /place/<name> or q=<name, address>. */
export function extractQueryFromUrl(finalUrl: string): string | undefined {
  let u: URL;
  try {
    u = new URL(unwrapGoogleUrl(finalUrl));
  } catch {
    return undefined;
  }
  const place = /\/maps\/place\/([^/@]+)/.exec(u.pathname);
  if (place) {
    const n = decodeParam(place[1]);
    if (n && !COORD_TEXT.test(n)) return n;
  }
  const q = u.searchParams.get('q') ?? u.searchParams.get('query');
  if (q && !COORD_TEXT.test(q)) return q.trim() || undefined;
  return undefined;
}

/** Place name only: the text before the first comma of the query. */
export function nameFromQuery(query: string): string {
  const head = query.split(',')[0].trim();
  return head || query.trim();
}

export function extractNameFromUrl(finalUrl: string): string | undefined {
  const q = extractQueryFromUrl(finalUrl);
  return q ? nameFromQuery(q) : undefined;
}

const MAPS_URL_RE = /https?:(?:\/\/|\\\/\\\/)(?:www\.|maps\.)?google\.[a-z.]+(?:\/|\\\/)maps[^"'\s<>\\]*/gi;

/** Google Maps URLs embedded in page HTML (consent pages carry the target in continue=). */
export function mapsUrlsInHtml(html: string): string[] {
  const text = html
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/g, '&');
  const out: string[] = [];
  for (const m of text.matchAll(MAPS_URL_RE)) out.push(m[0].replace(/\\\//g, '/'));
  for (const m of text.matchAll(/[?&]continue=([^"'\s<>&]+)/gi)) {
    const inner = decodeParam(m[1]);
    if (inner && /^https?:\/\//i.test(inner)) out.push(inner);
  }
  return out;
}

export function extractNameFromHtml(html: string): string | undefined {
  const a = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html);
  const b = /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i.exec(html);
  const raw = a?.[1] ?? b?.[1];
  return raw ? clean(decodeEntities(raw)) : undefined;
}

/** Pure: turn a resolved final URL and page HTML into a result. */
export function interpretResolved(finalUrl: string | null, html: string | null): ShortLinkResult {
  const urls: string[] = [];
  if (finalUrl) urls.push(unwrapGoogleUrl(finalUrl));
  if (html) urls.push(...mapsUrlsInHtml(html).map(unwrapGoogleUrl));
  let query: string | undefined;
  for (const u of urls) {
    query = query ?? extractQueryFromUrl(u);
    const r = parseGoogleMapsUrl(u);
    if (!('error' in r)) {
      const q = extractQueryFromUrl(u) ?? query;
      const nm =
        (q ? nameFromQuery(q) : undefined) ?? r.name ?? (html ? extractNameFromHtml(html) : undefined);
      return nm ? { lat: r.lat, lng: r.lng, name: nm } : { lat: r.lat, lng: r.lng };
    }
  }
  if (html) {
    const c = extractCoordsFromHtml(html);
    const og = extractNameFromHtml(html);
    const nm = query ? nameFromQuery(query) : og;
    if (c) return nm ? { ...c, name: nm } : c;
    query = query ?? og;
  }
  return query ? { error: 'no-coords', name: nameFromQuery(query), query } : { error: 'unresolved' };
}

async function timed(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export const SHORT_LINK_TIMEOUT_MS = 8000;

type Reader = (res: Response) => Promise<ShortLinkResult>;

const readHtml: Reader = async (res) => interpretResolved(null, await res.text());

/** Public CORS proxies and unshorteners, tried in parallel. Any one may be down. */
export function shortLinkProxies(link: string): { url: string; read: Reader }[] {
  const e = encodeURIComponent(link);
  return [
    {
      url: `https://api.allorigins.win/get?url=${e}`,
      read: async (res) => {
        const j = (await res.json()) as { contents?: unknown; status?: { url?: unknown } };
        return interpretResolved(
          typeof j.status?.url === 'string' ? j.status.url : null,
          typeof j.contents === 'string' ? j.contents : null,
        );
      },
    },
    {
      url: `https://unshorten.me/json/${link}`,
      read: async (res) => {
        const j = (await res.json()) as { resolved_url?: unknown };
        return interpretResolved(typeof j.resolved_url === 'string' ? j.resolved_url : null, null);
      },
    },
    { url: `https://api.codetabs.com/v1/proxy?quest=${e}`, read: readHtml },
    { url: `https://corsproxy.io/?url=${e}`, read: readHtml },
  ];
}

export async function resolveShortLink(
  link: string,
  timeoutMs = SHORT_LINK_TIMEOUT_MS,
): Promise<ShortLinkResult> {
  const raw = link.trim();
  const target = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  let best: ShortLinkResult = { error: 'unresolved' };
  const attempts = shortLinkProxies(target).map(async ({ url, read }) => {
    try {
      const res = await timed(url, timeoutMs);
      if (!res.ok) return;
      const r = await read(res);
      if (!('error' in r)) throw r; // first pin wins: reject to short-circuit Promise.all
      if (r.error === 'no-coords' && 'error' in best) best = r;
    } catch (e) {
      if (e && typeof e === 'object' && 'lat' in e) throw e;
    }
  });
  try {
    await Promise.all(attempts);
    return best;
  } catch (hit) {
    return hit as ShortLinkResult;
  }
}

/** Search candidates for a "Name, number, street, area, postcode city" query, most specific first. */
export function geocodeCandidates(query: string): string[] {
  const parts = query
    .split(',')
    .map((p) =>
      p
        .trim()
        .replace(/\bJln\b\.?/gi, 'Jalan')
        .replace(/\bLrg\b\.?/gi, 'Lorong'),
    )
    .filter(Boolean);
  const name = parts[0] ?? '';
  const rest = parts
    .slice(1)
    .filter((p) => !/^\d+[A-Za-z]?(?:-\d+)?$/.test(p) && !/^(?:no\.?\s*)?\d+[A-Za-z]?$/i.test(p))
    .map((p) => p.replace(/^\d{5}\s+/, ''));
  const out = [
    parts.join(', '),
    name,
    rest.join(', '),
    rest.slice(0, 2).join(', '),
    name.split('@')[0].trim(),
  ];
  return [...new Set(out.filter((q) => q.length > 2))];
}

/** Find coordinates for a place text from a share link. Street level at worst, never just a city. */
export async function geocodeQuery(
  query: string,
  search: (q: string) => Promise<PlaceHit[]>,
): Promise<PlaceHit | null> {
  for (const q of geocodeCandidates(query)) {
    try {
      const hits = await search(q);
      const hit = hits.find(inMalaysia) ?? hits[0];
      if (hit) return hit;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
