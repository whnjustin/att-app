import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreProvider } from '../../../contracts/store';
import { createMockStore } from '../../../lib/mockStore';
import { ArrivalsCalendar } from './index';

afterEach(cleanup);

const noon = () => ({ date: '2026-11-20', min: 720 });

function setup(now = noon) {
  const store = createMockStore({ ephemeral: true });
  render(
    <StoreProvider store={store}>
      <ArrivalsCalendar now={now} />
    </StoreProvider>,
  );
  return store;
}

describe('ArrivalsCalendar', () => {
  it('lists rows in order with accessible names and expands', async () => {
    setup();
    const rows = await screen.findAllByRole('button', { expanded: false });
    expect(rows[0].getAttribute('aria-label')).toBe(
      'Bqck, arrives Thursday 19 November at 2:30 PM, leaves Sunday 22 November at 1 PM',
    );
    expect(screen.getByRole('button', { name: 'Nicolino, dates not set' })).toBeTruthy();
    fireEvent.click(rows[0]);
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Arrives')).toBeTruthy();
    expect(screen.getByText('Thu 19 Nov')).toBeTruthy();
    expect(screen.getByText('Staying at')).toBeTruthy();
  });

  it('shows Time not set for a departure without time', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Ayyad/ }));
    expect(screen.getByText('Fri 27 Nov')).toBeTruthy();
    expect(screen.getAllByText('Time not set').length).toBe(1);
  });

  it('shows the now line only inside the window', async () => {
    setup();
    await screen.findAllByRole('button');
    expect(screen.queryByTestId('now-line')).toBeTruthy();
    cleanup();
    setup(() => ({ date: '2026-11-26', min: 0 }));
    await screen.findAllByRole('button');
    expect(screen.queryByTestId('now-line')).toBeNull();
  });

  it('saves edits through updatePerson', async () => {
    const store = setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Bqck/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Arrival place'), { target: { value: 'Station' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      let saved = '';
      store.watchPeople((p) => (saved = p.find((x) => x.id === 'bqck')?.arrival?.place ?? ''))();
      expect(saved).toBe('Station');
    });
  });
});
