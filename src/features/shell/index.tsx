import type { ReactNode } from 'react';
import type { Route } from '../../lib/router';

/** Stub: WP3 replaces this with the glass top bar and sidebar. */
export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const title = route.page === 'plan' ? 'Day plan' : route.page === 'ui' ? 'UI' : 'ATT in KL';
  return (
    <>
      <header
        style={{ padding: 'var(--s4) var(--gutter)', maxWidth: 'var(--content-max)', margin: '0 auto' }}
      >
        <h1 style={{ font: 'var(--t-large)' }}>{title}</h1>
        <nav style={{ display: 'flex', gap: 'var(--s4)', marginTop: 'var(--s2)' }}>
          <a href="#/">Overview</a>
          <a href="#/plan">Day plan</a>
        </nav>
      </header>
      {children}
    </>
  );
}
