import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../../contracts/store';
import type { Person, Presence } from '../../contracts/types';
import { createMockStore } from '../../lib/mockStore';
import { Shell } from './index';
import { onlinePeople } from './online';

afterEach(cleanup);

const person = (id: string): Person => ({ id, name: id, initials: id.slice(0, 2) }) as unknown as Person;
const seen = (personId: string | null, uid: string): Presence =>
  ({ uid, personId, page: 'overview', lastSeen: 1 }) as unknown as Presence;

describe('onlinePeople', () => {
  it('dedupes, skips null ids and keeps people order', () => {
    const people = [person('ayyad'), person('bqck'), person('xavier')];
    const out = onlinePeople(
      [seen('xavier', 'a'), seen(null, 'b'), seen('ayyad', 'c'), seen('xavier', 'd')],
      people,
    );
    expect(out.map((p) => p.id)).toEqual(['ayyad', 'xavier']);
  });
});

describe('Shell sidebar', () => {
  it('opens by button and closes by Escape and scrim', async () => {
    const store = createMockStore({ reset: true });
    await store.ensureSeed();
    render(
      <StoreProvider store={store}>
        <Shell route={{ page: 'overview' }}>
          <main>content</main>
        </Shell>
      </StoreProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    expect(screen.getByText('You are')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(document.querySelector('.scrim') as Element);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders children only on the ui route', () => {
    const store = createMockStore({ reset: true });
    render(
      <StoreProvider store={store}>
        <Shell route={{ page: 'ui' }}>
          <main>gallery</main>
        </Shell>
      </StoreProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
  });
});
