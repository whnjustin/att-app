import { useEffect } from 'react';
import { HEARTBEAT_MS, useStore, type Store } from '../contracts/store';

type Page = 'overview' | 'plan';

/** Start the heartbeat loop. Returns a stop function. Exposed for tests. */
export function startHeartbeat(store: Store, page: Page, doc: Document = document): () => void {
  const beat = () => {
    store.heartbeat(page).catch(() => {});
  };
  beat();
  const timer = setInterval(() => {
    if (doc.visibilityState === 'visible') beat();
  }, HEARTBEAT_MS);
  const onVisible = () => {
    if (doc.visibilityState === 'visible') beat();
  };
  doc.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    doc.removeEventListener('visibilitychange', onVisible);
  };
}

/** Beats now, every HEARTBEAT_MS while visible, on page change and when the tab becomes visible. */
export function usePresenceHeartbeat(page: Page): void {
  const store = useStore();
  useEffect(() => startHeartbeat(store, page), [store, page]);
}
