import { describe, expect, it } from 'vitest';
import { parseHash, routeHref } from './router';

describe('router', () => {
  it('parses hashes', () => {
    expect(parseHash('')).toEqual({ page: 'overview' });
    expect(parseHash('#/')).toEqual({ page: 'overview' });
    expect(parseHash('#/plan')).toEqual({ page: 'plan', date: null });
    expect(parseHash('#/plan/2026-11-20')).toEqual({ page: 'plan', date: '2026-11-20' });
    expect(parseHash('#/plan/2026-12-01')).toEqual({ page: 'plan', date: null });
    expect(parseHash('#/ui')).toEqual({ page: 'ui' });
  });
  it('builds hrefs', () => {
    expect(routeHref({ page: 'plan', date: '2026-11-21' })).toBe('#/plan/2026-11-21');
    expect(routeHref({ page: 'overview' })).toBe('#/');
  });
});
