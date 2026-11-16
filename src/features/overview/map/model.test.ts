import { describe, expect, it } from 'vitest';
import type { Poi } from '../../../contracts/types';
import type { Leg, Stop } from '../../../lib/geo';
import { formatDistance, formatDuration } from './format';
import {
  boundsOf,
  defaultDay,
  displayLegs,
  lineCollection,
  markerModels,
  reorderTimes,
  swapTimes,
} from './model';

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
  const stop = (p: Poi, number: number, itemId: string): Stop => ({ poi: p, number, itemId });
  it('numbers stops with their colour and adds a house per residence', () => {
    const C = poi('c', 101.3, 3.3);
    const H = poi('h', 101.0, 3.0);
    const m = markerModels([stop(B, 1, 'i1'), stop(C, 2, 'i2')], [H]);
    expect(m.map((x) => x.kind)).toEqual(['house', 'number', 'number']);
    expect(m[0]).toMatchObject({ n: 0, colorVar: null });
    expect(m[1]).toMatchObject({ n: 1, colorVar: '--leg-1' });
    expect(m[2]).toMatchObject({ n: 2, colorVar: '--leg-2' });
  });
  it('wraps colours after 8', () => {
    const m = markerModels([stop(A, 9, 'i9')], []);
    expect(m[0].colorVar).toBe('--leg-1');
  });
});

describe('swapTimes', () => {
  it('exchanges start times and keeps own durations', () => {
    const [a, b] = swapTimes({ startMin: 600, endMin: 660 }, { startMin: 720, endMin: 870 });
    expect(a).toEqual({ startMin: 720, endMin: 780 });
    expect(b).toEqual({ startMin: 600, endMin: 750 });
  });
  it('clamps to the end of the day', () => {
    const [a, b] = swapTimes({ startMin: 1500, endMin: 1680 }, { startMin: 1680, endMin: 1740 });
    expect(a).toEqual({ startMin: 1680, endMin: 1740 });
    expect(b).toEqual({ startMin: 1500, endMin: 1560 });
  });
  it('keeps the 30 minute grid and a minimum of 30 minutes', () => {
    const [a] = swapTimes({ startMin: 600, endMin: 610 }, { startMin: 660, endMin: 720 });
    expect(a).toEqual({ startMin: 660, endMin: 690 });
  });
});

describe('reorderTimes', () => {
  const A1 = { startMin: 600, endMin: 660 };
  const B1 = { startMin: 720, endMin: 870 };
  const C1 = { startMin: 900, endMin: 960 };
  it('matches swapTimes for an adjacent move', () => {
    const [a, b] = swapTimes(A1, B1);
    expect(reorderTimes([A1, B1, C1], 0, 1)).toEqual([a, b, C1]);
    expect(reorderTimes([A1, B1, C1], 1, 0)).toEqual([a, b, C1]);
  });
  it('moves first to last and keeps the set of start times', () => {
    const r = reorderTimes([A1, B1, C1], 0, 2);
    expect(r[1]).toEqual({ startMin: 600, endMin: 750 });
    expect(r[2]).toEqual({ startMin: 720, endMin: 780 });
    expect(r[0]).toEqual({ startMin: 900, endMin: 960 });
  });
  it('moves last to first', () => {
    const r = reorderTimes([A1, B1, C1], 2, 0);
    expect(r[2]).toEqual({ startMin: 600, endMin: 660 });
    expect(r[0]).toEqual({ startMin: 720, endMin: 780 });
    expect(r[1]).toEqual({ startMin: 900, endMin: 1050 });
  });
  it('leaves stops outside the range alone and ignores a no-op', () => {
    const r = reorderTimes([A1, B1, C1], 1, 2);
    expect(r[0]).toEqual(A1);
    expect(reorderTimes([A1, B1, C1], 1, 1)).toEqual([A1, B1, C1]);
    expect(reorderTimes([A1, B1, C1], 1, 5)).toEqual([A1, B1, C1]);
  });
  it('clamps to the end of the day', () => {
    const r = reorderTimes(
      [
        { startMin: 1500, endMin: 1680 },
        { startMin: 1680, endMin: 1740 },
      ],
      0,
      1,
    );
    expect(r[0]).toEqual({ startMin: 1680, endMin: 1740 });
    expect(r[1]).toEqual({ startMin: 1500, endMin: 1560 });
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
