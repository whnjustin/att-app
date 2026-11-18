import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../contracts/store';

/** Placeholder layout while the app and its data load. Styles live in index.html so the same
 * skeleton can show before the script runs. */
export function AppSkeleton() {
  return (
    <div className="skel" aria-busy="true" aria-label="Loading">
      <div className="skel-top">
        <span className="skel-b skel-circle" />
      </div>
      <span className="skel-b skel-title" />
      <span className="skel-b skel-seg" />
      <span className="skel-b skel-card" />
      <span className="skel-b skel-row" />
      <span className="skel-b skel-row" />
      <span className="skel-b skel-row short" />
    </div>
  );
}

/** Shows the skeleton until people, places and items have each arrived once (or a few seconds pass). */
export function DataReady({ children }: { children: ReactNode }) {
  const store = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const got = new Set<string>();
    const unsubs: (() => void)[] = [];
    const mark = (k: string) => () => {
      got.add(k);
      if (got.size === 3) setReady(true);
    };
    unsubs.push(store.watchPeople(mark('people')));
    unsubs.push(store.watchPois(mark('pois')));
    unsubs.push(store.watchItems('all', mark('items')));
    const t = window.setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => {
      window.clearTimeout(t);
      unsubs.forEach((u) => u());
    };
  }, [store]);
  return ready ? <>{children}</> : <AppSkeleton />;
}

const READY_FALLBACK_MS = 4000;
