import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { TRIP_DAYS, type DateKey } from '../../../contracts/types';
import { useDays, useItems, usePois, useStore } from '../../../contracts/store';
import {
  MapCanvas,
  buildLegs,
  googleMapsUrl,
  resolveLegs,
  stopsFor,
  wazeUrl,
  type ResolvedLeg,
} from '../../../lib/geo';
import { formatDay, todayTripDay } from '../../../lib/time';
import { Badge, Glass, Icon, IconButton, ListGroup, ListRow, SegmentedControl } from '../../../ui';
import { formatDistance, formatDuration } from './format';
import {
  boundsOf,
  defaultDay,
  displayLegs,
  lineCollection,
  markerModels,
  type LngLat,
  type MarkerModel,
} from './model';
import './map.css';

const SOURCE = 'day-legs';
const DAY_OPTIONS = TRIP_DAYS.map((d) => ({ value: d, label: formatDay(d) }));
const DARK_TEXT = new Set(['--leg-6', '--leg-7']);
const DEBOUNCE_MS = 600;
const HOUSE_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/></svg>';

function cssColor(colorVar: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
  return v || '#007aff';
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function ensureLayers(map: maplibregl.Map) {
  if (map.getSource(SOURCE)) return;
  map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'legs-casing',
    type: 'line',
    source: SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 8 },
  });
  map.addLayer({
    id: 'legs-line',
    type: 'line',
    source: SOURCE,
    filter: ['==', ['get', 'dashed'], 0],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
  });
  map.addLayer({
    id: 'legs-dashed',
    type: 'line',
    source: SOURCE,
    filter: ['==', ['get', 'dashed'], 1],
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-dasharray': [1.2, 1.4] },
  });
}

export function DayMap() {
  const store = useStore();
  const pois = usePois();
  const days = useDays();
  const [day, setDay] = useState<DateKey>(() => defaultDay(todayTripDay()));
  const items = useItems(day);

  const dayConfig = days.find((d) => d.date === day);
  const stops = useMemo(() => (dayConfig ? stopsFor(items, pois, dayConfig) : []), [items, pois, dayConfig]);
  const legs = useMemo(() => (dayConfig ? buildLegs(items, pois, dayConfig) : []), [items, pois, dayConfig]);

  const [resolved, setResolved] = useState<ResolvedLeg[]>([]);
  const display = useMemo(() => displayLegs(legs, resolved), [legs, resolved]);

  // Refresh: debounce, abort the previous resolve, then swap the source data.
  const legsRef = useRef(legs);
  legsRef.current = legs;
  const legsSig = legs.map((l) => l.key).join('|');
  useEffect(() => {
    if (!legsRef.current.length) {
      setResolved([]);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      resolveLegs(legsRef.current, store, ctl.signal).then(
        (r) => {
          if (!ctl.signal.aborted) setResolved(r);
        },
        () => undefined,
      );
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [legsSig, store]);

  // Map lifecycle. `epoch` bumps when the style is (re)loaded or the colour scheme changes.
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [epoch, setEpoch] = useState(0);
  const bump = useCallback(() => setEpoch((e) => e + 1), []);
  const onReady = useCallback(
    (map: maplibregl.Map) => {
      mapRef.current = map;
      bump();
    },
    [bump],
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', bump);
    return () => mq.removeEventListener('change', bump);
  }, [bump]);
  useEffect(
    () => () => {
      mapRef.current = null;
    },
    [],
  );

  // Lines: layers once per style, then setData only.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || epoch === 0) return;
    ensureLayers(map);
    const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData(lineCollection(display, cssColor) as never);
  }, [display, epoch]);

  // Markers.
  const [selected, setSelected] = useState<MarkerModel | null>(null);
  const models = useMemo(() => markerModels(stops, legs), [stops, legs]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || epoch === 0) return;
    const created = models.map((m) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'stop-marker';
      el.setAttribute('aria-label', m.poi.name);
      const dot = document.createElement('span');
      dot.className = 'stop-dot';
      if (m.kind === 'house') {
        dot.classList.add('house');
        dot.innerHTML = HOUSE_SVG;
      } else {
        dot.textContent = String(m.n);
        if (m.colorVar) dot.style.setProperty('--stop-color', `var(${m.colorVar})`);
        if (m.colorVar && DARK_TEXT.has(m.colorVar)) dot.classList.add('dark-text');
      }
      el.appendChild(dot);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setSelected(m);
      });
      return new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([m.poi.lng, m.poi.lat])
        .addTo(map);
    });
    return () => created.forEach((mk) => mk.remove());
  }, [models, epoch]);

  // Dismiss the popover on map tap, day change and Escape.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || epoch === 0) return;
    const close = () => setSelected(null);
    map.on('click', close);
    return () => {
      map.off('click', close);
    };
  }, [epoch]);
  useEffect(() => setSelected(null), [day]);
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Fit on day change, and again as the stops settle until the user moves the map.
  const fitted = useRef<{ day: DateKey | null; sig: string }>({ day: null, sig: '' });
  const moved = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || epoch === 0) return;
    const mark = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) moved.current = true;
    };
    map.on('dragstart', mark);
    map.on('zoomstart', mark);
    return () => {
      map.off('dragstart', mark);
      map.off('zoomstart', mark);
    };
  }, [epoch]);
  const stopsSig = stops.map((s) => `${s.poi.id}@${s.poi.lat},${s.poi.lng}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || epoch === 0) return;
    const dayChanged = fitted.current.day !== day;
    if (!dayChanged && (moved.current || fitted.current.sig === stopsSig)) return;
    if (dayChanged) moved.current = false;
    fitted.current = { day, sig: stopsSig };
    if (!stops.length) return;
    const animate = !reducedMotion();
    const points: LngLat[] = stops.map((s) => [s.poi.lng, s.poi.lat]);
    if (points.length === 1) {
      map.easeTo({ center: points[0], zoom: 14, animate });
      return;
    }
    const b = boundsOf(points);
    if (b) map.fitBounds(b, { padding: 56, maxZoom: 16, animate });
    // stops is covered by stopsSig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, stopsSig, epoch]);

  return (
    <section aria-labelledby="routes-title">
      <h2 id="routes-title" className="section-title">
        Routes
      </h2>
      <SegmentedControl
        className="daymap-switch"
        ariaLabel="Day"
        options={DAY_OPTIONS}
        value={day}
        onChange={setDay}
      />
      <div className="map-card">
        <MapCanvas className="map-canvas" onReady={onReady} onStyleReload={bump} />
        {selected ? (
          <Glass variant="strong" className="map-popover" role="dialog" aria-label={selected.poi.name}>
            <div className="map-popover-head">
              <span className="map-popover-name">{selected.poi.name}</span>
              <IconButton icon="close" aria-label="Close" onClick={() => setSelected(null)} />
            </div>
            <div className="map-popover-actions">
              <a
                className="btn btn-tinted btn-small"
                href={googleMapsUrl(selected.poi)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="map" size={16} />
                Google Maps
              </a>
              <a
                className="btn btn-tinted btn-small"
                href={wazeUrl(selected.poi)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="waze" size={16} />
                Waze
              </a>
            </div>
          </Glass>
        ) : null}
      </div>
      {legs.length === 0 ? (
        <div className="map-empty">No stops</div>
      ) : (
        <div className="leg-list">
          <ListGroup>
            {display.map((d) => (
              <ListRow
                key={`${d.leg.index}:${d.leg.key}`}
                leading={<Badge n={d.leg.index + 1} colorVar={d.leg.colorVar} />}
                title={d.leg.from.name}
                subtitle={d.leg.to.name}
                trailing={
                  d.durationS !== null && d.distanceM !== null ? (
                    <span className="leg-trailing">
                      <span>{formatDuration(d.durationS)}</span>
                      <span>{formatDistance(d.distanceM)}</span>
                    </span>
                  ) : undefined
                }
              />
            ))}
          </ListGroup>
        </div>
      )}
    </section>
  );
}
