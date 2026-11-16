import { useEffect, useMemo, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { usePois, useStore } from '../../../contracts/store';
import type { Poi, PoiCategory } from '../../../contracts/types';
import { createDebouncedSearch, MapCanvas, parseGoogleMapsUrl, type PlaceHit } from '../../../lib/geo';
import {
  Button,
  Icon,
  ListGroup,
  ListRow,
  SearchField,
  SegmentedControl,
  Sheet,
  TextField,
} from '../../../ui';
import { findDuplicate, shouldShowNotFound } from './logic';
import './places.css';

export interface AddPlaceSheetProps {
  open: boolean;
  onClose: () => void;
  onSaved: (poiId: string) => void;
}

type Mode = 'search' | 'link' | 'pin';

interface Draft {
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  address: string;
  osmRef: string | null;
  source: Poi['source'];
}

const CATEGORY_OPTIONS: { value: PoiCategory; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'bar', label: 'Bar' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_LABEL: Record<PoiCategory, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  bar: 'Bar',
  other: 'Other',
  stay: 'Stay',
};

export function AddPlaceSheet({ open, onClose, onSaved }: AddPlaceSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Add place" detent="large">
      <AddPlaceBody onSaved={onSaved} />
    </Sheet>
  );
}

function AddPlaceBody({ onSaved }: { onSaved: (poiId: string) => void }) {
  const store = useStore();
  const pois = usePois();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searchFailed, setSearchFailed] = useState(false);
  const [settledQuery, setSettledQuery] = useState<string | null>(null);
  const [focusLink, setFocusLink] = useState(false);
  const [link, setLink] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const searcher = useMemo(() => createDebouncedSearch(350), []);

  useEffect(() => () => searcher.cancel(), [searcher]);

  const onQuery = (q: string) => {
    setQuery(q);
    setSearchFailed(false);
    setSettledQuery(null);
    if (!q.trim()) {
      searcher.cancel();
      setHits([]);
      return;
    }
    searcher.search(q).then(
      (res) => {
        if (res) {
          setHits(res);
          setSettledQuery(q.trim());
        }
      },
      () => setSearchFailed(true),
    );
  };

  const pick = (h: PlaceHit) => {
    setDraft({
      name: h.name,
      category: h.category,
      lat: h.lat,
      lng: h.lng,
      address: h.address,
      osmRef: h.osmRef || null,
      source: 'search',
    });
    setDuplicate(false);
  };

  const onLink = (v: string) => {
    setLink(v);
    if (!v.trim()) return;
    const r = parseGoogleMapsUrl(v);
    if ('error' in r) return;
    setDraft({
      name: r.name ?? '',
      category: 'other',
      lat: r.lat,
      lng: r.lng,
      address: '',
      osmRef: null,
      source: 'gmaps-url',
    });
    setDuplicate(false);
  };
  const linkResult = link.trim() ? parseGoogleMapsUrl(link) : null;
  const linkError =
    linkResult && 'error' in linkResult
      ? linkResult.error === 'short-link'
        ? 'Open the link and copy the full address bar URL'
        : 'No coordinates in link'
      : null;

  const usePin = () => {
    const c = mapRef.current?.getCenter();
    if (!c) return;
    setDraft({
      name: '',
      category: 'other',
      lat: c.lat,
      lng: c.lng,
      address: '',
      osmRef: null,
      source: 'pin',
    });
    setDuplicate(false);
  };

  const save = async () => {
    if (!draft || !draft.name.trim() || saving) return;
    const existing = findDuplicate(draft, pois);
    if (existing) {
      setDuplicate(true);
      onSaved(existing.id);
      return;
    }
    setSaving(true);
    try {
      const id = await store.addPoi({
        name: draft.name.trim(),
        category: draft.category,
        lat: draft.lat,
        lng: draft.lng,
        address: draft.address,
        source: draft.source,
        osmRef: draft.osmRef,
        note: note.trim(),
      });
      onSaved(id);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (m: Mode) => {
    setFocusLink(false);
    setMode(mode === m ? 'search' : m);
  };
  const notFound = shouldShowNotFound({ query, settledQuery, hitCount: hits.length, failed: searchFailed });
  const pasteLink = () => {
    setMode('link');
    setFocusLink(true);
    document.getElementById('place-link')?.focus();
  };

  return (
    <div className="place-form">
      <SearchField value={query} onChange={onQuery} ariaLabel="Search places" placeholder="Search places" />
      {searchFailed ? <p className="place-status">Search unavailable</p> : null}
      {notFound ? (
        <div className="place-notfound">
          <p className="place-status" role="status">
            Not found
          </p>
          <Button variant="tinted" onClick={pasteLink}>
            Paste a Google Maps link
          </Button>
        </div>
      ) : null}
      {mode === 'search' && hits.length > 0 ? (
        <ListGroup>
          {hits.map((h, i) => (
            <ListRow
              key={`${h.osmRef}-${i}`}
              title={h.name}
              subtitle={h.address || undefined}
              trailing={<span className="place-chip">{CATEGORY_LABEL[h.category]}</span>}
              onClick={() => pick(h)}
            />
          ))}
        </ListGroup>
      ) : null}

      <ListGroup>
        <ListRow
          leading={<Icon name="map" size={22} />}
          title="Paste Google Maps link"
          expanded={mode === 'link'}
          onClick={() => toggle('link')}
          expandedContent={
            <div className="place-form">
              <TextField
                id="place-link"
                autoFocus={focusLink}
                label="Link"
                value={link}
                onChange={onLink}
                inputMode="url"
                autoComplete="off"
              />
              {linkError ? (
                <p className="place-status" role="alert">
                  {linkError}
                </p>
              ) : null}
            </div>
          }
        />
        <ListRow
          leading={<Icon name="pin" size={22} />}
          title="Drop a pin"
          expanded={mode === 'pin'}
          onClick={() => toggle('pin')}
          expandedContent={
            <div className="place-form">
              <div className="place-pinmap">
                <MapCanvas
                  onReady={(m) => {
                    mapRef.current = m;
                  }}
                />
                <span className="place-crosshair" aria-hidden="true" />
              </div>
              <Button onClick={usePin}>Use this spot</Button>
            </div>
          }
        />
      </ListGroup>

      {draft ? (
        <div className="place-form">
          <TextField
            label="Name"
            value={draft.name}
            onChange={(name) => {
              setDraft({ ...draft, name });
              setDuplicate(false);
            }}
          />
          <div className="field">
            <span className="field-label">Category</span>
            <SegmentedControl
              ariaLabel="Category"
              options={CATEGORY_OPTIONS}
              value={draft.category}
              onChange={(category) => setDraft({ ...draft, category })}
            />
          </div>
          <TextField label="Note" value={note} onChange={setNote} />
          {duplicate ? (
            <p className="place-status" role="status">
              Already added
            </p>
          ) : null}
          <Button onClick={() => void save()} disabled={!draft.name.trim() || saving}>
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
