import { describe, expect, it } from 'vitest';
import { createMockStore } from './mockStore';
import type { ItineraryItem } from '../contracts/types';

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('mockStore', () => {
  it('seeds 6 people and 8 meals', () => {
    const s = createMockStore({ ephemeral: true });
    let people = 0;
    let meals = 0;
    s.watchPeople((p) => (people = p.length));
    s.watchItems('all', (i) => (meals = i.filter((x) => x.kind === 'meal').length));
    expect(people).toBe(6);
    expect(meals).toBe(8);
  });

  it('notifies watchers on the next tick', async () => {
    const s = createMockStore({ ephemeral: true });
    let items: ItineraryItem[] = [];
    s.watchItems('2026-11-21', (i) => (items = i));
    await s.updateItem('2026-11-21-lunch', { startMin: 750, endMin: 810 });
    expect(items.find((i) => i.id === '2026-11-21-lunch')?.startMin).toBe(720);
    await tick();
    expect(items.find((i) => i.id === '2026-11-21-lunch')?.startMin).toBe(750);
  });

  it('unlinks items when a poi is deleted', async () => {
    const s = createMockStore({ ephemeral: true });
    let items: ItineraryItem[] = [];
    s.watchItems('2026-11-20', (i) => (items = i));
    await s.deletePoi('mock-restaurant');
    await tick();
    expect(items.find((i) => i.id === '2026-11-20-lunch')?.poiId).toBeNull();
  });

  it('ensureSeed is idempotent', async () => {
    const s = createMockStore({ ephemeral: true });
    await s.ensureSeed();
    await s.ensureSeed();
    let n = 0;
    s.watchItems('all', (i) => (n = i.filter((x) => x.kind === 'meal').length));
    expect(n).toBe(8);
  });

  it('tracks me', async () => {
    const s = createMockStore({ ephemeral: true });
    const seen: (string | null)[] = [];
    s.watchMe((m) => seen.push(m));
    await s.setMe('xavier');
    expect(seen).toEqual([null, 'xavier']);
    expect(s.me()).toBe('xavier');
  });
});
