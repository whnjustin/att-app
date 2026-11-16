import { describe, expect, it } from 'vitest';
import type { ItineraryItem, Poi } from '../../../contracts/types';
import {
  displayAddress,
  findDuplicate,
  groupPlaces,
  haversineM,
  normaliseName,
  shouldShowNotFound,
  shouldShowSearching,
  usageCounts,
} from './logic';

describe('shouldShowNotFound', () => {
  const base = { query: 'zz', settledQuery: 'zz', hitCount: 0, failed: false };
  it('shows after a finished empty search of 2 or more characters', () => {
    expect(shouldShowNotFound(base)).toBe(true);
  });
  it('hides while in flight, for short or empty queries, with hits, or on failure', () => {
    expect(shouldShowNotFound({ ...base, settledQuery: null })).toBe(false);
    expect(shouldShowNotFound({ ...base, settledQuery: 'z' })).toBe(false);
    expect(shouldShowNotFound({ ...base, query: 'z', settledQuery: 'z' })).toBe(false);
    expect(shouldShowNotFound({ ...base, query: '', settledQuery: '' })).toBe(false);
    expect(shouldShowNotFound({ ...base, hitCount: 1 })).toBe(false);
    expect(shouldShowNotFound({ ...base, failed: true })).toBe(false);
  });
});

function poi(over: Partial<Poi>): Poi {
  return {
    id: 'p',
    name: 'Place',
    category: 'other',
    lat: 3.14,
    lng: 101.69,
    address: '',
    source: 'search',
    osmRef: null,
    note: '',
    createdAt: 0,
    createdBy: null,
    updatedAt: 0,
    ...over,
  };
}

function item(poiId: string | null, id = Math.random().toString()): ItineraryItem {
  return {
    id,
    date: '2026-11-20',
    kind: 'poi',
    meal: null,
    poiId,
    startMin: 600,
    endMin: 660,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: null,
  };
}

describe('groupPlaces', () => {
  it('orders groups, sorts alphabetically, puts stays in Other and hides empty groups', () => {
    const groups = groupPlaces([
      poi({ id: '1', name: 'zeta', category: 'restaurant' }),
      poi({ id: '2', name: 'Alpha', category: 'restaurant' }),
      poi({ id: '3', name: 'Stay A', category: 'stay' }),
      poi({ id: '4', name: 'Bar B', category: 'bar' }),
      poi({ id: '5', name: 'Spot', category: 'other' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Restaurants', 'Bars', 'Other']);
    expect(groups[0].places.map((p) => p.name)).toEqual(['Alpha', 'zeta']);
    expect(groups[2].places.map((p) => p.name)).toEqual(['Spot', 'Stay A']);
  });
  it('returns nothing for no places', () => {
    expect(groupPlaces([])).toEqual([]);
  });
});

describe('usageCounts', () => {
  it('counts items per poi and skips unlinked', () => {
    const m = usageCounts([item('a'), item('a'), item('b'), item(null)]);
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(1);
    expect(m.size).toBe(2);
  });
});

describe('displayAddress', () => {
  it('trims and hides empty', () => {
    expect(displayAddress('  Area X ')).toBe('Area X');
    expect(displayAddress('   ')).toBeUndefined();
    expect(displayAddress(undefined)).toBeUndefined();
  });
});

describe('duplicates', () => {
  const existing = [poi({ id: 'x', name: 'Cafe Nine', osmRef: 'N1', lat: 3.15, lng: 101.7 })];
  it('normalises names', () => {
    expect(normaliseName('  Café  Nine! ')).toBe('cafe nine');
  });
  it('matches by osmRef regardless of position', () => {
    expect(findDuplicate({ name: 'Other', lat: 0, lng: 0, osmRef: 'N1' }, existing)?.id).toBe('x');
  });
  it('matches same name within 100 m', () => {
    const near = { name: 'cafe nine', lat: 3.1505, lng: 101.7, osmRef: null };
    expect(haversineM(existing[0], near)).toBeLessThan(100);
    expect(findDuplicate(near, existing)?.id).toBe('x');
  });
  it('ignores same name farther than 100 m and different names nearby', () => {
    expect(findDuplicate({ name: 'Cafe Nine', lat: 3.152, lng: 101.7, osmRef: null }, existing)).toBeNull();
    expect(findDuplicate({ name: 'Cafe Ten', lat: 3.15, lng: 101.7, osmRef: null }, existing)).toBeNull();
    expect(findDuplicate({ name: '', lat: 3.15, lng: 101.7, osmRef: null }, existing)).toBeNull();
  });
});

describe('shouldShowSearching', () => {
  const base = { query: 'cafe', settledQuery: null, failed: false, debounced: true };
  it('shows while the current query is in flight', () => {
    expect(shouldShowSearching(base)).toBe(true);
  });
  it('hides before the debounce, when settled, failed, or too short', () => {
    expect(shouldShowSearching({ ...base, debounced: false })).toBe(false);
    expect(shouldShowSearching({ ...base, settledQuery: 'cafe' })).toBe(false);
    expect(shouldShowSearching({ ...base, failed: true })).toBe(false);
    expect(shouldShowSearching({ ...base, query: 'c' })).toBe(false);
  });
  it('hides when Not found shows', () => {
    expect(shouldShowNotFound({ query: 'zz', settledQuery: 'zz', hitCount: 0, failed: false })).toBe(true);
    expect(shouldShowSearching({ query: 'zz', settledQuery: 'zz', failed: false, debounced: true })).toBe(
      false,
    );
  });
});
