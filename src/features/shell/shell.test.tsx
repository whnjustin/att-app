import { afterEach, describe, expect, it, vi } from 'vitest';
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

function mount(route: Parameters<typeof Shell>[0]['route'] = { page: 'overview' }) {
  const store = createMockStore({ reset: true });
  return store.ensureSeed().then(() => {
    render(
      <StoreProvider store={store}>
        <Shell route={route}>
          <main>content</main>
        </Shell>
      </StoreProvider>,
    );
    return store;
  });
}

describe('Shell nav', () => {
  it('opens the popover, navigates, and closes by Escape and outside tap', async () => {
    await mount();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    expect(screen.getByRole('menuitemradio', { name: 'Overview' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Day plan' }));
    expect(window.location.hash).toMatch(/^#\/plan/);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the page title', async () => {
    await mount({ page: 'plan', date: null });
    expect(screen.getByRole('heading', { name: 'Day plan' })).toBeTruthy();
  });
});

describe('Shell accounts', () => {
  it('switches person and picks a background', async () => {
    const store = await mount();
    const id = await store.addBackground('data:image/jpeg;base64,AAAA');
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
    expect(screen.getByRole('dialog', { name: 'Accounts' })).toBeTruthy();
    const setMe = vi.spyOn(store, 'setMe');
    const radios = screen.getAllByRole('radio');
    await act(async () => {
      fireEvent.click(radios[1]);
    });
    expect(setMe).toHaveBeenCalledTimes(1);
    const spy = vi.spyOn(store, 'setMyBackground');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    });
    expect(spy).toHaveBeenCalledWith(id);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'None' }));
    });
    expect(spy).toHaveBeenCalledWith(null);
  });

  it('deletes an own upload in two steps', async () => {
    const store = await mount();
    const spy = vi.spyOn(store, 'deleteBackground');
    await store.setMe('ayyad');
    await store.addBackground('data:image/jpeg;base64,AAAA');
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete background' }));
    expect(spy).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    });
    expect(spy).toHaveBeenCalledTimes(1);
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
    expect(screen.queryByRole('button', { name: 'Pages' })).toBeNull();
  });
});
