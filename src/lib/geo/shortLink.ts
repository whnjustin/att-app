import { parseGoogleMapsUrl } from './gmapsUrl';

export type ShortLinkResult =
  | { lat: number; lng: number; name?: string }
  | { error: 'unresolved' }
  | { error: 'no-coords'; name: string };

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

export function extractNameFromUrl(finalUrl: string): string | undefined {
  let u: URL;
  try {
    u = new URL(finalUrl);
  } catch {
    return undefined;
  }
  const dec = (s: string) => {
    try {
      return decodeURIComponent(s.replace(/\+/g, ' ')).trim() || undefined;
    } catch {
      return undefined;
    }
  };
  const place = /\/maps\/place\/([^/@]+)/.exec(u.pathname);
  if (place) {
    const n = dec(place[1]);
    if (n && !COORD_TEXT.test(n)) return n;
  }
  const q = u.searchParams.get('q') ?? u.searchParams.get('query');
  if (q && !COORD_TEXT.test(q)) return q.trim() || undefined;
  return undefined;
}

export function extractNameFromHtml(html: string): string | undefined {
  const a = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html);
  const b = /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i.exec(html);
  const raw = a?.[1] ?? b?.[1];
  return raw ? clean(decodeEntities(raw)) : undefined;
}

/** Pure: turn a resolved final URL and page HTML into a result. */
export function interpretResolved(finalUrl: string | null, html: string | null): ShortLinkResult {
  let name: string | undefined;
  if (finalUrl) {
    name = extractNameFromUrl(finalUrl);
    const r = parseGoogleMapsUrl(finalUrl);
    if (!('error' in r)) {
      const nm = name ?? r.name ?? (html ? extractNameFromHtml(html) : undefined);
      return nm ? { lat: r.lat, lng: r.lng, name: nm } : { lat: r.lat, lng: r.lng };
    }
  }
  if (html) {
    name = name ?? extractNameFromHtml(html);
    const c = extractCoordsFromHtml(html);
    if (c) return name ? { ...c, name } : c;
  }
  return name ? { error: 'no-coords', name } : { error: 'unresolved' };
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

export const SHORT_LINK_TIMEOUT_MS = 6000;

export function shortLinkProxies(link: string): string[] {
  const e = encodeURIComponent(link);
  return [`https://api.allorigins.win/get?url=${e}`, `https://corsproxy.io/?url=${e}`];
}

export async function resolveShortLink(
  link: string,
  timeoutMs = SHORT_LINK_TIMEOUT_MS,
): Promise<ShortLinkResult> {
  const target = link.trim();
  const [allorigins, corsproxy] = shortLinkProxies(
    /^[a-z]+:\/\//i.test(target) ? target : `https://${target}`,
  );
  let best: ShortLinkResult = { error: 'unresolved' };
  const keep = (r: ShortLinkResult) => {
    if (!('error' in r)) return true;
    if (r.error === 'no-coords') best = r;
    return false;
  };
  try {
    const res = await timed(allorigins, timeoutMs);
    if (res.ok) {
      const j = (await res.json()) as { contents?: unknown; status?: { url?: unknown } };
      const r = interpretResolved(
        typeof j.status?.url === 'string' ? j.status.url : null,
        typeof j.contents === 'string' ? j.contents : null,
      );
      if (keep(r)) return r;
    }
  } catch {
    // fall through to the next proxy
  }
  try {
    const res = await timed(corsproxy, timeoutMs);
    if (res.ok) {
      const r = interpretResolved(null, await res.text());
      if (keep(r)) return r;
    }
  } catch {
    // unresolved
  }
  return best;
}
