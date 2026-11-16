import { useEffect } from 'react';
import { HEARTBEAT_MS, useStore } from '../../contracts/store';
import type { Presence } from '../../contracts/types';

/** Heartbeat now, every HEARTBEAT_MS while visible, on page change and when the tab becomes visible. */
export function useHeartbeat(page: Presence['page']): void {
  const store = useStore();
  useEffect(() => {
    const beat = () => {
      store.heartbeat(page).catch(() => {});
    };
    beat();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') beat();
    }, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [store, page]);
}
