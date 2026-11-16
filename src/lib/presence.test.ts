import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_MS } from '../contracts/store';
import { createMockStore } from './mockStore';
import { startHeartbeat } from './presence';

describe('startHeartbeat', () => {
  afterEach(() => vi.useRealTimers());

  it('beats now, on interval, on visible, and stops', () => {
    vi.useFakeTimers();
    const store = createMockStore({ reset: true });
    const hb = vi.spyOn(store, 'heartbeat');
    const stop = startHeartbeat(store, 'plan');
    expect(hb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(hb).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(hb).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(HEARTBEAT_MS * 2);
    expect(hb).toHaveBeenCalledTimes(3);
  });
});
