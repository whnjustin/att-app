import type { Movement, Person } from '../../../contracts/types';
import { TRIP_DAYS } from '../../../contracts/types';
import { daysBetween, hhmmToMin } from '../../../lib/time';

export const WINDOW_START = TRIP_DAYS[0];
export const WINDOW_MIN = TRIP_DAYS.length * 1440;

export interface BarLayout {
  /** 'bar' has a start and end, 'full' is a local, 'none' has no arrival date. */
  kind: 'bar' | 'full' | 'none';
  /** Fractions of the track, 0 to 1. */
  start: number;
  end: number;
  /** Departure is after the last trip day or not set. */
  runsOffRight: boolean;
  noArrival: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Minutes from the window start. A null time means the start of the day, or the end of it when `endOfDay`. */
function windowMin(m: Movement & { date: string }, endOfDay: boolean): number {
  const day = daysBetween(WINDOW_START, m.date) * 1440;
  if (m.time) return day + hhmmToMin(m.time);
  return day + (endOfDay ? 1440 : 0);
}

export function barLayout(p: Person): BarLayout {
  if (p.role === 'local') return { kind: 'full', start: 0, end: 1, runsOffRight: false, noArrival: false };
  if (!p.arrival?.date) return { kind: 'none', start: 0, end: 0, runsOffRight: false, noArrival: true };
  const start = windowMin({ ...p.arrival, date: p.arrival.date }, false);
  let end = WINDOW_MIN;
  let runsOffRight = true;
  if (p.departure?.date) {
    const dep = windowMin({ ...p.departure, date: p.departure.date }, true);
    end = dep;
    runsOffRight = dep > WINDOW_MIN;
  }
  return {
    kind: 'bar',
    start: clamp01(start / WINDOW_MIN),
    end: clamp01(Math.max(end, start) / WINDOW_MIN),
    runsOffRight,
    noArrival: false,
  };
}

/** Sort key: visitors with an arrival moment, visitors without, then locals. */
function rank(p: Person): [number, number] {
  if (p.role === 'local') return [2, 0];
  if (!p.arrival?.date) return [1, 0];
  return [0, windowMin({ ...p.arrival, date: p.arrival.date }, false)];
}

export function sortPeople(people: Person[]): Person[] {
  return people
    .map((p, i) => ({ p, i, r: rank(p) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.p);
}

/** Fraction of the track for a Malaysia date and minute, or null when outside the window. */
export function nowFraction(now: { date: string; min: number }): number | null {
  const x = daysBetween(WINDOW_START, now.date) * 1440 + now.min;
  return x >= 0 && x <= WINDOW_MIN ? x / WINDOW_MIN : null;
}
