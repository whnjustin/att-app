import { describe, expect, it } from 'vitest';
import { MOCK_PEOPLE } from '../../../contracts/seed';
import type { Person } from '../../../contracts/types';
import { barLayout, nowFraction, sortPeople } from './layout';

const byId = (id: string) => MOCK_PEOPLE.find((p) => p.id === id) as Person;
const T = 4 * 1440;

describe('barLayout', () => {
  it('starts and ends at the seeded times', () => {
    const b = barLayout(byId('bqck'));
    expect(b.kind).toBe('bar');
    expect(b.start).toBeCloseTo((14 * 60 + 30) / T, 10);
    expect(b.end).toBeCloseTo((3 * 1440 + 13 * 60) / T, 10);
    expect(b.runsOffRight).toBe(false);
  });
  it('runs off the right edge when departure is after 22 Nov', () => {
    const b = barLayout(byId('ayyad'));
    expect(b.start).toBeCloseTo((17 * 60) / T, 10);
    expect(b.end).toBe(1);
    expect(b.runsOffRight).toBe(true);
  });
  it('flags a visitor without arrival', () => {
    const b = barLayout(byId('nicolino'));
    expect(b.kind).toBe('none');
    expect(b.noArrival).toBe(true);
  });
  it('makes locals full width', () => {
    expect(barLayout(byId('justinn'))).toMatchObject({ kind: 'full', start: 0, end: 1 });
  });
  it('starts at 00:00 when arrival time is null', () => {
    const p = { ...byId('xavier'), arrival: { date: '2026-11-20', time: null, place: '' } };
    expect(barLayout(p).start).toBe(1440 / T);
  });
  it('ends at the end of the day when departure time is null', () => {
    const p = { ...byId('xavier'), departure: { date: '2026-11-21', time: null, place: '' } };
    expect(barLayout(p).end).toBe((3 * 1440) / T);
  });
  it('runs off the right when no departure is set', () => {
    const p = { ...byId('xavier'), departure: null };
    expect(barLayout(p)).toMatchObject({ end: 1, runsOffRight: true });
  });
});

describe('sortPeople', () => {
  it('orders arrivals, then no arrival, then locals', () => {
    const ids = sortPeople([...MOCK_PEOPLE].reverse()).map((p) => p.id);
    expect(ids.slice(0, 4)).toEqual(['bqck', 'xavier', 'ayyad', 'nicolino']);
    expect(ids.slice(4).sort()).toEqual(['justinn', 'justinw']);
  });
});

describe('nowFraction', () => {
  it('is null outside the window', () => {
    expect(nowFraction({ date: '2026-11-18', min: 1439 })).toBeNull();
    expect(nowFraction({ date: '2026-11-23', min: 1 })).toBeNull();
  });
  it('maps inside the window', () => {
    expect(nowFraction({ date: '2026-11-20', min: 720 })).toBeCloseTo(2160 / T, 10);
  });
});
