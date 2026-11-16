import { useEffect, useId, useMemo, useState } from 'react';
import { TRIP_DAYS } from '../../../contracts/types';
import type { Movement, Person } from '../../../contracts/types';
import { usePeople, usePois, useStore } from '../../../contracts/store';
import {
  formatDay,
  formatDayLong,
  formatDayMonth,
  formatTime,
  hhmmToMin,
  minToHHmm,
  nowMyt,
} from '../../../lib/time';
import { Avatar, Button, DayField, Icon, Sheet, TextField, TimeField } from '../../../ui';
import { barLayout, nowFraction, sortPeople } from './layout';
import './arrivals.css';

export interface ArrivalsCalendarProps {
  /** Injectable clock for tests. */
  now?: () => { date: string; min: number };
}

function describeMovement(m: Movement | null): { day: string; time: string; place: string } {
  return {
    day: m?.date ? formatDayMonth(m.date) : 'Date not set',
    time: m?.time ? formatTime(m.time) : 'Time not set',
    place: m?.place ?? '',
  };
}

function accessibleName(p: Person): string {
  if (p.role === 'local') return `${p.name}, here all days`;
  if (!p.arrival?.date) return `${p.name}, dates not set`;
  const a = `arrives ${formatDayLong(p.arrival.date)}${p.arrival.time ? ` at ${formatTime(p.arrival.time)}` : ''}`;
  const d = p.departure?.date
    ? `leaves ${formatDayLong(p.departure.date)}${p.departure.time ? ` at ${formatTime(p.departure.time)}` : ''}`
    : 'departure not set';
  return `${p.name}, ${a}, ${d}`;
}

export function ArrivalsCalendar({ now = nowMyt }: ArrivalsCalendarProps = {}) {
  const people = usePeople();
  const pois = usePois();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frac = useMemo(() => nowFraction(now()), [now, tick]);
  const sorted = useMemo(() => sortPeople(people), [people]);
  const stayName = (id: string | null) => pois.find((p) => p.id === id)?.name ?? 'Not set';

  return (
    <section aria-labelledby="arrivals-title" className="arr">
      <h2 id="arrivals-title" className="section-title">
        Who&apos;s here
      </h2>
      <div className="arr-card">
        <div className="arr-head" aria-hidden="true">
          <span className="arr-lead" />
          <span className="arr-days">
            {TRIP_DAYS.map((d) => (
              <span key={d} className="arr-day">
                {formatDay(d)}
              </span>
            ))}
          </span>
        </div>
        <ul className="arr-rows">
          {sorted.map((p) => {
            const b = barLayout(p);
            const open = openId === p.id;
            return (
              <li key={p.id} className="arr-item">
                <button
                  type="button"
                  className="arr-row"
                  aria-expanded={open}
                  aria-label={accessibleName(p)}
                  onClick={() => setOpenId(open ? null : p.id)}
                >
                  <span className="arr-lead">
                    <Avatar initials={p.initials} colorToken={p.colorToken} size={32} label={p.name} />
                    <span className="arr-name">{p.name}</span>
                  </span>
                  <span className="arr-track">
                    {b.kind === 'none' ? <span className="arr-unset">Dates not set</span> : null}
                    {b.kind !== 'none' ? (
                      <span
                        className={`arr-bar${b.kind === 'full' ? ' local' : ''}`}
                        style={{
                          left: `${b.start * 100}%`,
                          width: `${(b.end - b.start) * 100}%`,
                          background: `var(${p.colorToken})`,
                        }}
                      >
                        {b.kind === 'bar' ? <span className="arr-dot start" /> : null}
                        {b.kind === 'bar' && !b.runsOffRight ? <span className="arr-dot end" /> : null}
                        {b.runsOffRight ? <Icon name="chevron" size={14} className="arr-more" /> : null}
                      </span>
                    ) : null}
                  </span>
                </button>
                {open ? (
                  <Details person={p} stay={stayName(p.stayPoiId)} onEdit={() => setEditing(p)} />
                ) : null}
              </li>
            );
          })}
        </ul>
        {frac !== null ? (
          <div className="arr-now-wrap" aria-hidden="true">
            <div className="arr-now" data-testid="now-line" style={{ left: `${frac * 100}%` }} />
          </div>
        ) : null}
      </div>
      {editing ? <EditSheet key={editing.id} person={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function Details({ person, stay, onEdit }: { person: Person; stay: string; onEdit: () => void }) {
  const visitor = person.role === 'visitor';
  const a = describeMovement(person.arrival);
  const d = describeMovement(person.departure);
  return (
    <div className="arr-details">
      <dl className="arr-dl">
        {visitor ? (
          <>
            <Line label="Arrives" parts={[a.day, a.time, a.place]} />
            <Line label="Leaves" parts={[d.day, d.time, d.place]} />
          </>
        ) : null}
        <Line label="Staying at" parts={[stay]} />
      </dl>
      <Button variant="tinted" size="small" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function Line({ label, parts }: { label: string; parts: string[] }) {
  return (
    <div className="arr-line">
      <dt>{label}</dt>
      <dd>
        {parts.filter(Boolean).map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </dd>
    </div>
  );
}

interface MoveDraft {
  date: string | null;
  time: number | null;
  place: string;
}

const toDraft = (m: Movement | null): MoveDraft => ({
  date: m?.date ?? null,
  time: m?.time ? hhmmToMin(m.time) : null,
  place: m?.place ?? '',
});

function fromDraft(d: MoveDraft): Movement | null {
  if (!d.date && d.time === null && !d.place.trim()) return null;
  return { date: d.date, time: d.time === null ? null : minToHHmm(d.time), place: d.place.trim() };
}

function EditSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const store = useStore();
  const pois = usePois();
  const stayId = useId();
  const [arrival, setArrival] = useState(() => toDraft(person.arrival));
  const [departure, setDeparture] = useState(() => toDraft(person.departure));
  const [stay, setStay] = useState(person.stayPoiId ?? '');
  const stays = pois.filter((p) => p.category === 'stay');
  const visitor = person.role === 'visitor';

  const save = async () => {
    await store.updatePerson(person.id, {
      ...(visitor ? { arrival: fromDraft(arrival), departure: fromDraft(departure) } : {}),
      stayPoiId: stay || null,
    });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={person.name} detent="large">
      <div className="arr-edit">
        {visitor ? (
          <>
            <MoveFields title="Arrival" value={arrival} onChange={setArrival} />
            <MoveFields title="Departure" value={departure} onChange={setDeparture} />
          </>
        ) : null}
        <div className="field">
          <label className="field-label" htmlFor={stayId}>
            Staying at
          </label>
          <select
            id={stayId}
            className="field-input arr-select"
            value={stay}
            onChange={(e) => setStay(e.target.value)}
          >
            <option value="">Not set</option>
            {stays.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="arr-actions">
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </div>
    </Sheet>
  );
}

function MoveFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: MoveDraft;
  onChange: (v: MoveDraft) => void;
}) {
  return (
    <fieldset className="arr-fieldset">
      <legend className="arr-legend">{title}</legend>
      <DayField label={`${title} day`} value={value.date} onChange={(date) => onChange({ ...value, date })} />
      {value.time === null ? (
        <div className="field">
          <span className="field-label">{`${title} time`}</span>
          <Button variant="tinted" onClick={() => onChange({ ...value, time: 12 * 60 })}>
            Set time
          </Button>
        </div>
      ) : (
        <div className="arr-time">
          <TimeField
            label={`${title} time`}
            value={value.time}
            onChange={(time) => onChange({ ...value, time })}
          />
          <Button variant="plain" size="small" onClick={() => onChange({ ...value, time: null })}>
            Clear time
          </Button>
        </div>
      )}
      <TextField
        label={`${title} place`}
        value={value.place}
        onChange={(place) => onChange({ ...value, place })}
      />
    </fieldset>
  );
}
