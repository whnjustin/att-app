import { describe, expect, it } from 'vitest';
import { findPrivate, sha } from './check-private.mjs';

describe('check-private', () => {
  it('passes ordinary text', () => {
    expect(findPrivate('Stay A in Area A, lunch at 12 PM')).toEqual([]);
  });
  it('matches one and two word terms case insensitively', () => {
    const deny = new Set([sha('secret'), sha('hidden place')]);
    expect(findPrivate('near SECRET road', deny)).toEqual(['secret']);
    expect(findPrivate('the Hidden-Place villa', deny)).toEqual(['hidden place']);
    expect(findPrivate('secretive', deny)).toEqual([]);
  });
});
