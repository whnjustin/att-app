import { describe, expect, it } from 'vitest';
import { compressToFit, fitSize } from './compress';

describe('fitSize', () => {
  it('limits the long side and keeps ratio', () => {
    expect(fitSize(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitSize(800, 3200, 1600)).toEqual({ width: 400, height: 1600 });
  });
  it('never enlarges', () => {
    expect(fitSize(500, 400, 1600)).toEqual({ width: 500, height: 400 });
  });
});

describe('compressToFit', () => {
  it('returns at the first quality when it fits', () => {
    const calls: number[] = [];
    const out = compressToFit({ width: 4000, height: 3000 }, 100, (w, h, q) => {
      calls.push(q);
      expect(Math.max(w, h)).toBe(1600);
      return 'x'.repeat(50);
    });
    expect(out).toHaveLength(50);
    expect(calls).toEqual([0.8]);
  });
  it('steps quality down before scaling', () => {
    const seen: [number, number][] = [];
    const out = compressToFit({ width: 2000, height: 1000 }, 100, (w, _h, q) => {
      seen.push([w, q]);
      return 'x'.repeat(Math.round(q * 140));
    });
    expect(out).not.toBeNull();
    expect(seen.map((s) => s[0])).toEqual([1600, 1600]);
    expect(seen.map((s) => s[1])).toEqual([0.8, 0.7]);
  });
  it('scales down when no quality fits', () => {
    const widths = new Set<number>();
    const out = compressToFit({ width: 1600, height: 1600 }, 400, (w, _h, q) => {
      widths.add(w);
      return 'x'.repeat(Math.round(w * q));
    });
    expect(out).not.toBeNull();
    expect(widths.size).toBeGreaterThan(1);
  });
  it('gives up with null when nothing fits', () => {
    expect(compressToFit({ width: 1000, height: 1000 }, 10, () => 'x'.repeat(100))).toBeNull();
  });
});
