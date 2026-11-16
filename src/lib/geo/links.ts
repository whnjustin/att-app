import type { Poi } from '../../contracts/types';

type P = Pick<Poi, 'name' | 'address' | 'lat' | 'lng'>;

export function googleMapsUrl(poi: P): string {
  const text = `${poi.name} ${poi.address}`.trim();
  const query = text ? encodeURIComponent(text) : `${poi.lat},${poi.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function googleEmbedUrl(poi: Pick<Poi, 'lat' | 'lng'>): string {
  return `https://maps.google.com/maps?q=${poi.lat},${poi.lng}&z=17&output=embed`;
}

export function wazeUrl(poi: Pick<Poi, 'lat' | 'lng'>): string {
  return `https://waze.com/ul?ll=${poi.lat},${poi.lng}&navigate=yes`;
}
