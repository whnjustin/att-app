export type GmapsParse = { lat: number; lng: number; name?: string } | { error: 'short-link' | 'no-coords' };

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function pair(s: string | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return valid(lat, lng) ? { lat, lng } : null;
}

function placeName(path: string): string | undefined {
  const m = /\/maps\/place\/([^/@]+)/.exec(path);
  if (!m) return undefined;
  try {
    const n = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    return n || undefined;
  } catch {
    return undefined;
  }
}

export function parseGoogleMapsUrl(input: string): GmapsParse {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { error: 'no-coords' };
  }
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'))) {
    return { error: 'short-link' };
  }
  const name = placeName(url.pathname);
  const result = (lat: number, lng: number): GmapsParse => (name ? { lat, lng, name } : { lat, lng });

  // Place pin coordinates win over the viewport centre in @.
  const full = url.pathname + url.search + url.hash;
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(full);
  if (pin && valid(Number(pin[1]), Number(pin[2]))) return result(Number(pin[1]), Number(pin[2]));
  for (const key of ['q', 'query', 'll', 'center', 'destination']) {
    const p = pair(url.searchParams.get(key));
    if (p) return result(p.lat, p.lng);
  }
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(full);
  if (at && valid(Number(at[1]), Number(at[2]))) return result(Number(at[1]), Number(at[2]));
  return { error: 'no-coords' };
}
