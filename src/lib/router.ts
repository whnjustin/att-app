import { useEffect, useState } from 'react';
import type { DateKey } from '../contracts/types';
import { isTripDay } from './time';

export type Route = { page: 'overview' } | { page: 'plan'; date: DateKey | null } | { page: 'ui' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').split('?')[0];
  const [head, arg] = path.split('/');
  if (head === 'plan') return { page: 'plan', date: arg && isTripDay(arg) ? arg : null };
  if (head === 'ui') return { page: 'ui' };
  return { page: 'overview' };
}

export function routeHref(route: Route): string {
  if (route.page === 'plan') return route.date ? `#/plan/${route.date}` : '#/plan';
  if (route.page === 'ui') return '#/ui';
  return '#/';
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const href = routeHref(route);
  if (opts.replace) {
    history.replaceState(null, '', href);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = href;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
