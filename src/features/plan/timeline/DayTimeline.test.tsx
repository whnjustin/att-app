import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../contracts/store';
import { createMockStore } from '../../../lib/mockStore';
import { DayTimeline } from './index';

vi.mock('maplibre-gl', () => ({ default: {} }));

afterEach(cleanup);

async function setup() {
  const store = createMockStore({ ephemeral: true });
  await store.ensureSeed();
  render(
    <StoreProvider store={store}>
      <DayTimeline date="2026-11-20" />
    </StoreProvider>,
  );
  return store;
}

describe('DayTimeline', () => {
  it('names each block with its range', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Restaurant A, 12 PM to 1 PM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dinner, 8 PM to 9 PM' })).toBeTruthy();
  });

  it('moves a focused block with arrow keys and writes after the debounce', async () => {
    vi.useFakeTimers();
    const store = await setup();
    const block = screen.getByRole('button', { name: 'Restaurant A, 12 PM to 1 PM' });
    fireEvent.keyDown(block, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Restaurant A, 12:30 PM to 1:30 PM' })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    let seen = 0;
    store.watchItems('2026-11-20', (items) => {
      seen = items.find((i) => i.poiId === 'mock-restaurant')?.startMin ?? 0;
    })();
    expect(seen).toBe(750);
    vi.useRealTimers();
  });

  it('opens the edit sheet with Enter', async () => {
    await setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Dinner, 8 PM to 9 PM' }), { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove from day' })).toBeTruthy();
  });
});
