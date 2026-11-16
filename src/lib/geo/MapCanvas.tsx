import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import maplibregl from 'maplibre-gl';

export const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
export const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const KL_CENTER: [number, number] = [101.6869, 3.139];
export const KL_ZOOM = 11.5;

export interface MapCanvasProps {
  className?: string;
  style?: CSSProperties;
  onReady: (map: maplibregl.Map) => void;
  onStyleReload?: (map: maplibregl.Map) => void;
  interactive?: boolean;
  center?: [number, number];
  zoom?: number;
}

export function MapCanvas({
  className,
  style,
  onReady,
  onStyleReload,
  interactive = true,
  center,
  zoom,
}: MapCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onReady, onStyleReload });
  cbs.current = { onReady, onStyleReload };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hasMq = typeof window.matchMedia === 'function';
    const mq = hasMq ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const touch = 'ontouchstart' in window || (hasMq && window.matchMedia('(pointer: coarse)').matches);
    let darkFailed = false;
    let styleLoaded = false;
    let currentUrl = mq?.matches ? STYLE_DARK : STYLE_LIGHT;

    const map = new maplibregl.Map({
      container: el,
      style: currentUrl,
      center: center ?? KL_CENTER,
      zoom: zoom ?? KL_ZOOM,
      interactive,
      attributionControl: false,
      cooperativeGestures: touch && interactive,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on('error', () => {
      if (!styleLoaded && currentUrl === STYLE_DARK) {
        darkFailed = true;
        currentUrl = STYLE_LIGHT;
        map.setStyle(STYLE_LIGHT);
      }
    });
    map.on('style.load', () => {
      styleLoaded = true;
    });
    map.once('load', () => cbs.current.onReady(map));

    const swap = () => {
      const url = mq?.matches && !darkFailed ? STYLE_DARK : STYLE_LIGHT;
      if (url === currentUrl) return;
      currentUrl = url;
      styleLoaded = false;
      map.once('style.load', () => cbs.current.onStyleReload?.(map));
      map.setStyle(url);
    };
    mq?.addEventListener('change', swap);

    return () => {
      mq?.removeEventListener('change', swap);
      map.remove();
    };
    // Initial view props are read once; the map is not recreated when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  return <div ref={ref} className={className} style={{ width: '100%', height: '100%', ...style }} />;
}
