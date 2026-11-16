import { describe, expect, it } from 'vitest';
import type { Poi } from '../../../contracts/types';
import type { Leg, Stop } from '../../../lib/geo';
import { formatDistance, formatDuration } from './format';
import { boundsOf, defaultDay, displayLegs, lineCollection, markerModels } from './model';

const poi = (id: string, lng: number, lat: number): Poi => ({
  id,
  name: `Place ${id}`,
  category: 'other',
  lat,
  lng,
  address: '',
  source: 'seed',
  osmRef: null,
  note: '',
  createdAt: 0,
  createdBy: null,
  updatedAt: 0,
});

const A = poi('a', 101.1, 3.1);
const B = poi('b', 101.2, 3.2);
const leg = (index: number, from: Poi, to: Poi): Leg => ({
  index,
  from,
  to,
  key: `${from.id}_${to.id}`,
  colorVar: `--leg-${index + 1}`,
});

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(18 * 60)).toBe('18 min');
    expect(formatDuration(18 * 60 + 40)).toBe('19 min');
    expect(formatDuration(65 * 60)).toBe('1 h 5 min');
    expect(formatDuration(120 * 60)).toBe('2 h');
    expect(formatDuration(10)).toBe('0 min');
  });
  it('formats distances', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(999.7)).toBe('1.0 km');
    expect(formatDistance(6240)).toBe('6.2 km');
    expect(formatDistance(12000)).toBe('12.0 km');
  });
});

describe('defaultDay', () => {
  it('uses today inside the window, else the first day', () => {
    expect(defaultDay('2026-11-21')).toBe('2026-11-21');
    expect(defaultDay(null)).toBe('2026-11-19');
  });
});

describe('displayLegs and lineCollection', () => {
  const legs = [leg(0, A, B), leg(1, B, A)];
  it('marks unresolved legs as loading and dashed', () => {
    const d = displayLegs(legs, []);
    expect(d.every((x) => x.loading && x.dashed)).toBe(true);
    expect(d[0].coords).toEqual([
      [101.1, 3.1],
      [101.2, 3.2],
    ]);
    expect(d[0].distanceM).toBeNull();
  });
  it('keeps resolved routes solid with values and fallbacks dashed without values', () => {
    const d = displayLegs(legs, [
      {
        key: 'a_b',
        coords: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        fallback: false,
        distanceM: 6200,
        durationS: 1080,
      },
      {
        key: 'b_a',
        coords: [
          [101.2, 3.2],
          [101.1, 3.1],
        ],
        fallback: true,
      },
    ]);
    expect(d[0]).toMatchObject({ dashed: false, loading: false, distanceM: 6200, durationS: 1080 });
    expect(d[1]).toMatchObject({ dashed: true, loading: false, fallback: true, distanceM: null });
    const fc = lineCollection(d, (v) => `c${v}`);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties).toEqual({ index: 0, color: 'c--leg-1', dashed: 0 });
    expect(fc.features[1].properties.dashed).toBe(1);
    expect(fc.features[0].geometry.coordinates).toHaveLength(3);
  });
});

describe('markerModels', () => {
  const stop = (p: Poi, role: Stop['role'], number: number, itemId: string | null): Stop => ({
    poi: p,
    role,
    number,
    itemId,
  });
  it('uses the arriving leg colour and merges a shared start and end', () => {
    const C = poi('c', 101.3, 3.3);
    const stops = [
      stop(A, 'start', 0, null),
      stop(B, 'item', 1, 'i1'),
      stop(C, 'item', 2, 'i2'),
      stop(A, 'end', 3, null),
    ];
    const legs = [leg(0, A, B), leg(1, B, C), leg(2, C, A)];
    const m = markerModels(stops, legs);
    expect(m.map((x) => x.kind)).toEqual(['house', 'number', 'number']);
    expect(m[1]).toMatchObject({ n: 1, colorVar: '--leg-1' });
    expect(m[2]).toMatchObject({ n: 2, colorVar: '--leg-2' });
  });
  it('keeps separate houses for different start and end', () => {
    const m = markerModels([stop(A, 'start', 0, null), stop(B, 'end', 1, null)], [leg(0, A, B)]);
    expect(m.map((x) => x.kind)).toEqual(['house', 'house']);
  });
});

describe('boundsOf', () => {
  it('returns null when empty and the box otherwise', () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        [1, 5],
        [3, 2],
      ]),
    ).toEqual([
      [1, 2],
      [3, 5],
    ]);
  });
});
