import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreProvider, type Store } from '../../contracts/store';
import { createMockStore } from '../../lib/mockStore';
import { Gate } from './index';

function fake(over: Partial<Store>, member = false): Store {
  const base = createMockStore({ reset: true });
  let me: string | null = null;
  let isMem = member;
  const ls = new Set<(i: never) => void>();
  return {
    ...base,
    kind: 'firestore',
    signIn: async () => 'u1',
    isMember: async () => isMem,
    join: async (c: string) => {
      if (c.trim() === 'good') {
        isMem = true;
        return 'ok';
      }
      return 'bad-code';
    },
    me: () => me as never,
    setMe: async (id) => {
      me = id;
      ls.forEach((f) => f(id as never));
    },
    watchMe: (cb) => {
      cb(me as never);
      ls.add(cb as never);
      return () => ls.delete(cb as never);
    },
    ...over,
  } as Store;
}

describe('Gate', () => {
  afterEach(cleanup);

  it('renders children directly for the mock store', () => {
    render(
      <StoreProvider store={createMockStore({ reset: true })}>
        <Gate>
          <p>inside</p>
        </Gate>
      </StoreProvider>,
    );
    expect(screen.getByText('inside')).toBeTruthy();
  });

  it('wrong code shows the error, right code seeds then shows the picker then children', async () => {
    const ensureSeed = vi.fn(async () => {});
    const store = fake({ ensureSeed });
    render(
      <StoreProvider store={store}>
        <Gate>
          <p>inside</p>
        </Gate>
      </StoreProvider>,
    );
    const input = await screen.findByLabelText('Passcode');
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.click(screen.getByText('Enter'));
    await screen.findByText('Wrong passcode');
    fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: ' good ' } });
    fireEvent.click(screen.getByText('Enter'));
    await waitFor(() => expect(ensureSeed).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('Bqck'));
    await screen.findByText('inside');
  });

  it('skips the code for an existing member with a saved identity', async () => {
    const store = fake({}, true);
    await store.setMe('xavier');
    render(
      <StoreProvider store={store}>
        <Gate>
          <p>inside</p>
        </Gate>
      </StoreProvider>,
    );
    await screen.findByText('inside');
  });
});
