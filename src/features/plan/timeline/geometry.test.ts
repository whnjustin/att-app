import { describe, expect, it } from 'vitest';
import {
  firstFreeHour,
  keyboardSpan,
  moveSpan,
  packColumns,
  pxToMin,
  resizeEnd,
  resizeStart,
  slotAt,
} from './geometry';

const span = (id: string, startMin: number, endMin: number) => ({ id, startMin, endMin });

describe('pxToMin', () => {
  it('snaps to 30 and clamps to the day', () => {
    expect(pxToMin(0)).toBe(0);
    expect(pxToMin(56)).toBe(60);
    expect(pxToMin(56 * 9)).toBe(540);
    expect(pxToMin(14)).toBe(30);
    expect(pxToMin(-100)).toBe(0);
    expect(pxToMin(99999)).toBe(1440);
  });
});

describe('moveSpan and resize', () => {
  it('moves on the grid and keeps length', () => {
    expect(moveSpan({ startMin: 720, endMin: 780 }, 61)).toEqual({ startMin: 780, endMin: 840 });
  });
  it('clamps moves to the day', () => {
    expect(moveSpan({ startMin: 60, endMin: 120 }, -500)).toEqual({ startMin: 0, endMin: 60 });
    expect(moveSpan({ startMin: 1380, endMin: 1440 }, 500)).toEqual({ startMin: 1380, endMin: 1440 });
  });
  it('resizes with a 30 minute minimum', () => {
    expect(resizeEnd({ startMin: 600, endMin: 660 }, -120)).toEqual({ startMin: 600, endMin: 630 });
    expect(resizeEnd({ startMin: 600, endMin: 660 }, 5000)).toEqual({ startMin: 600, endMin: 1440 });
    expect(resizeStart({ startMin: 600, endMin: 660 }, 120)).toEqual({ startMin: 630, endMin: 660 });
    expect(resizeStart({ startMin: 600, endMin: 660 }, -5000)).toEqual({ startMin: 0, endMin: 660 });
  });
});

describe('packColumns', () => {
  it('gives lone items the full width', () => {
    expect(packColumns([span('a', 0, 60)])).toEqual({ a: { col: 0, cols: 1 } });
  });
  it('splits overlapping items side by side', () => {
    const p = packColumns([span('a', 600, 720), span('b', 630, 690)]);
    expect(p.a).toEqual({ col: 0, cols: 2 });
    expect(p.b).toEqual({ col: 1, cols: 2 });
  });
  it('reuses columns inside a cluster and resets between clusters', () => {
    const p = packColumns([
      span('a', 600, 720),
      span('b', 630, 660),
      span('c', 660, 720),
      span('d', 900, 960),
    ]);
    expect(p.a.cols).toBe(2);
    expect(p.b.col).toBe(1);
    expect(p.c).toEqual({ col: 1, cols: 2 });
    expect(p.d).toEqual({ col: 0, cols: 1 });
  });
  it('treats touching items as separate', () => {
    const p = packColumns([span('a', 600, 660), span('b', 660, 720)]);
    expect(p.a.cols).toBe(1);
    expect(p.b.cols).toBe(1);
  });
});

describe('firstFreeHour', () => {
  it('starts at 10 AM when free', () => {
    expect(firstFreeHour([])).toBe(600);
  });
  it('skips busy hours', () => {
    expect(firstFreeHour([span('a', 600, 660), span('b', 660, 690)])).toBe(720);
  });
  it('falls back to 10 AM when full', () => {
    expect(firstFreeHour([span('a', 0, 1440)])).toBe(600);
  });
});

describe('slotAt and keyboardSpan', () => {
  it('makes one hour slots inside the day', () => {
    expect(slotAt(750)).toEqual({ startMin: 750, endMin: 810 });
    expect(slotAt(1410)).toEqual({ startMin: 1380, endMin: 1440 });
  });
  it('moves with arrows and resizes with shift', () => {
    const s = { startMin: 600, endMin: 660 };
    expect(keyboardSpan('ArrowDown', false, s)).toEqual({ startMin: 630, endMin: 690 });
    expect(keyboardSpan('ArrowUp', false, s)).toEqual({ startMin: 570, endMin: 630 });
    expect(keyboardSpan('ArrowDown', true, s)).toEqual({ startMin: 600, endMin: 690 });
    expect(keyboardSpan('ArrowUp', true, { startMin: 600, endMin: 630 })).toEqual({
      startMin: 600,
      endMin: 630,
    });
    expect(keyboardSpan('a', false, s)).toBeNull();
  });
});
