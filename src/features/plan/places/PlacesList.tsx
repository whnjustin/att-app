import { useEffect, useMemo, useRef, useState } from 'react';
import { useItems, usePois, useStore } from '../../../contracts/store';
import { TRIP_DAYS, type Poi, type PoiCategory } from '../../../contracts/types';
import { googleEmbedUrl, googleMapsUrl, MapCanvas, wazeUrl } from '../../../lib/geo';
import {
  Button,
  DayField,
  Icon,
  ListGroup,
  ListRow,
  SegmentedControl,
  Sheet,
  TextField,
  TimeField,
} from '../../../ui';
import { AddPlaceSheet } from './AddPlaceSheet';
import { displayAddress, groupPlaces, usageCounts } from './logic';
import './places.css';

const EMBED_TIMEOUT_MS = 6000;
const CONFIRM_RESET_MS = 4000;

const CATEGORY_OPTIONS: { value: Exclude<PoiCategory, 'stay'>; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'bar', label: 'Bar' },
  { value: 'other', label: 'Other' },
];

function categoryIcon(c: PoiCategory) {
  const name =
    c === 'restaurant'
      ? 'fork-knife'
      : c === 'cafe'
        ? 'cup'
        : c === 'bar'
          ? 'glass'
          : c === 'stay'
            ? 'house'
            : 'pin';
  return <Icon name={name} size={22} />;
}

function MapEmbed({ poi }: { poi: Poi }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  useEffect(() => {
    if (state !== 'loading') return;
    const t = setTimeout(() => setState('failed'), EMBED_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (state === 'failed') {
    return (
      <div className="place-embed" role="img" aria-label={`Map of ${poi.name}`}>
        <MapCanvas interactive={false} center={[poi.lng, poi.lat]} zoom={15} onReady={() => {}} />
        <span className="place-pin" aria-hidden="true">
          <Icon name="pin" size={32} />
        </span>
      </div>
    );
  }
  return (
    <div className="place-embed">
      <iframe
        title={`Map of ${poi.name}`}
        src={googleEmbedUrl(poi)}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setState('ok')}
        onError={() => setState('failed')}
      />
    </div>
  );
}

function PlaceDetails({ poi }: { poi: Poi }) {
  const store = useStore();
  const [note, setNote] = useState(poi.note);
  const [confirm, setConfirm] = useState(false);
  const noteRef = useRef(poi.note);
  useEffect(() => {
    if (poi.note !== noteRef.current) {
      noteRef.current = poi.note;
      setNote(poi.note);
    }
  }, [poi.note]);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), CONFIRM_RESET_MS);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <div className="place-details">
      <MapEmbed poi={poi} />
      <div className="place-links">
        <a
          className="btn btn-tinted btn-regular"
          href={googleMapsUrl(poi)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="map" size={18} />
          Google Maps
        </a>
        <a
          className="btn btn-tinted btn-regular"
          href={wazeUrl(poi)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="waze" size={18} />
          Waze
        </a>
      </div>
      <TextField
        label="Note"
        value={note}
        onChange={setNote}
        onBlur={() => {
          if (note !== poi.note) {
            noteRef.current = note;
            void store.updatePoi(poi.id, { note });
          }
        }}
      />
      {poi.category !== 'stay' ? (
        <div className="field">
          <span className="field-label">Category</span>
          <SegmentedControl
            ariaLabel="Category"
            options={CATEGORY_OPTIONS}
            value={poi.category}
            onChange={(category) => void store.updatePoi(poi.id, { category })}
          />
        </div>
      ) : null}
      <Button
        variant="destructive"
        leading="trash"
        onClick={() => {
          if (confirm) void store.deletePoi(poi.id);
          else setConfirm(true);
        }}
      >
        {confirm ? 'Confirm delete' : 'Delete'}
      </Button>
    </div>
  );
}

function AddToDaySheet({ poi, onClose }: { poi: Poi | null; onClose: () => void }) {
  const store = useStore();
  const [date, setDate] = useState<string | null>(TRIP_DAYS[0]);
  const [start, setStart] = useState(600);
  const day = TRIP_DAYS.find((d) => d === date) ?? null;

  const save = async () => {
    if (!poi || !day) return;
    await store.addItem({
      date: day,
      kind: 'poi',
      meal: null,
      poiId: poi.id,
      startMin: start,
      endMin: Math.min(1440, start + 60),
    });
    onClose();
  };

  return (
    <Sheet open={!!poi} onClose={onClose} title="Add to day plan">
      <div className="place-form">
        <DayField
          label="Day"
          value={date}
          onChange={(d) => setDate(d && (TRIP_DAYS as string[]).includes(d) ? d : null)}
        />
        <TimeField label="Start" value={start} onChange={setStart} />
        <Button onClick={() => void save()} disabled={!day}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}

export function PlacesList() {
  const pois = usePois();
  const items = useItems('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [planFor, setPlanFor] = useState<Poi | null>(null);
  const groups = useMemo(() => groupPlaces(pois), [pois]);
  const uses = useMemo(() => usageCounts(items), [items]);

  return (
    <section aria-labelledby="places-title" className="places">
      <div className="places-head">
        <h2 id="places-title" className="section-title">
          Places
        </h2>
        <Button variant="tinted" size="small" leading="plus" onClick={() => setAdding(true)}>
          Add place
        </Button>
      </div>
      {groups.length === 0 ? <p className="places-empty">No places yet</p> : null}
      <div className="places-groups">
        {groups.map((g) => (
          <ListGroup key={g.key} title={g.title}>
            {g.places.map((p) => {
              const n = uses.get(p.id) ?? 0;
              return (
                <ListRow
                  key={p.id}
                  leading={categoryIcon(p.category)}
                  title={p.name}
                  subtitle={displayAddress(p.address)}
                  expanded={openId === p.id}
                  onClick={() => setOpenId(openId === p.id ? null : p.id)}
                  trailing={
                    <span className="place-trailing">
                      {n > 0 ? (
                        <span className="place-count" aria-label={`Used ${n} times`}>
                          {n}
                        </span>
                      ) : null}
                    </span>
                  }
                  action={
                    <button
                      type="button"
                      className="place-plus"
                      aria-label={`Add ${p.name} to day plan`}
                      onClick={() => setPlanFor(p)}
                    >
                      <Icon name="plus" size={22} />
                    </button>
                  }
                  expandedContent={<PlaceDetails poi={p} />}
                />
              );
            })}
          </ListGroup>
        ))}
      </div>
      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <AddToDaySheet poi={planFor} onClose={() => setPlanFor(null)} />
    </section>
  );
}
