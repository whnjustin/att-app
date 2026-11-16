import { DAY_END_MIN, DAY_START_MIN } from '../../../contracts/types';
import { clamp, snap30 } from '../../../lib/time';

export const PX_PER_HOUR = 56;
export const PX_PER_MIN = PX_PER_HOUR / 60;
/** The grid runs 5 AM to 5 AM next morning. */
export const DAY_START = DAY_START_MIN;
export const DAY_END = DAY_END_MIN;
export const STEP = 30;

export interface Span {
  startMin: number;
  endMin: number;
}

/** Pixels from the top of the hour area (5 AM) to minutes, snapped to 30 and clamped to the day. */
export function pxToMin(px: number): number {
  return clamp(snap30(px / PX_PER_MIN) + DAY_START, DAY_START, DAY_END);
}

export function minToPx(min: number): number {
  return (min - DAY_START) * PX_PER_MIN;
}

/** Move a span by a minute delta, keeping its length and the 30 minute grid. */
export function moveSpan(s: Span, deltaMin: number): Span {
  const len = s.endMin - s.startMin;
  const start = clamp(snap30(s.startMin + deltaMin), DAY_START, DAY_END - len);
  return { startMin: start, endMin: start + len };
}

/** Move the end edge. Minimum 30 minutes, clamped to the day. */
export function resizeEnd(s: Span, deltaMin: number): Span {
  const end = clamp(snap30(s.endMin + deltaMin), s.startMin + STEP, DAY_END);
  return { startMin: s.startMin, endMin: end };
}

/** Move the start edge. Minimum 30 minutes, clamped to the day. */
export function resizeStart(s: Span, deltaMin: number): Span {
  const start = clamp(snap30(s.startMin + deltaMin), DAY_START, s.endMin - STEP);
  return { startMin: start, endMin: s.endMin };
}

export interface Placement {
  col: number;
  cols: number;
}

/** Standard calendar packing: overlapping clusters share width, one column per concurrent item. */
export function packColumns<T extends Span & { id: string }>(items: T[]): Record<string, Placement> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Record<string, Placement> = {};
  let cluster: { id: string; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const c of cluster) out[c.id] = { col: c.col, cols: colEnds.length };
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((e) => e <= it.startMin);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else {
      colEnds[col] = it.endMin;
    }
    cluster.push({ id: it.id, col });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

/** Start of the first free hour from 10 AM, or 10 AM when the day is full. */
export function firstFreeHour(items: Span[]): number {
  for (let t = 600; t + 60 <= DAY_END; t += 60) {
    if (!items.some((i) => i.startMin < t + 60 && i.endMin > t)) return t;
  }
  return 600;
}

/** One hour slot starting at a half hour, kept inside the day. */
export function slotAt(startMin: number): Span {
  const start = clamp(snap30(startMin), DAY_START, DAY_END - 60);
  return { startMin: start, endMin: start + 60 };
}

/** Keyboard move and resize. Returns null for keys that do nothing. */
export function keyboardSpan(key: string, shift: boolean, s: Span): Span | null {
  const dir = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  if (!dir) return null;
  return shift ? resizeEnd(s, dir * STEP) : moveSpan(s, dir * STEP);
}
