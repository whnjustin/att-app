import type { DateKey } from '../contracts/types';
import { DAY_END_MIN, DAY_START_MIN, TRIP_DAYS } from '../contracts/types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Malaysia is UTC+8 with no DST. */
export const MYT_OFFSET_MIN = 8 * 60;

/** 'HH:mm' to minutes from midnight. */
export function hhmmToMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes from midnight to 'HH:mm'. 1440 becomes '24:00'. */
export function minToHHmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutes from midnight to '4 PM' or '4:30 PM'. 0 and 1440 are '12 AM'. */
export function formatMin(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

/** 'HH:mm' to '4 PM' or '4:30 PM'. */
export function formatTime(hhmm: string): string {
  return formatMin(hhmmToMin(hhmm));
}

/** '12 PM to 1 PM' */
export function formatRange(startMin: number, endMin: number): string {
  return `${formatMin(startMin)} to ${formatMin(endMin)}`;
}

function parts(date: string): { y: number; mo: number; d: number; dow: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`bad date ${date}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return { y, mo, d, dow };
}

/** '2026-11-19' to 'Thu 19' */
export function formatDay(date: string): string {
  const p = parts(date);
  return `${DOW[p.dow]} ${p.d}`;
}

/** '2026-11-19' to 'Thu 19 Nov' */
export function formatDayMonth(date: string): string {
  const p = parts(date);
  return `${DOW[p.dow]} ${p.d} ${MONTHS[p.mo - 1]}`;
}

/** '2026-11-19' to 'Thursday 19 November' */
export function formatDayLong(date: string): string {
  const p = parts(date);
  return `${DOW_LONG[p.dow]} ${p.d} ${MONTHS_LONG[p.mo - 1]}`;
}

/** Round to the nearest multiple of 30. */
export function snap30(min: number): number {
  return Math.round(min / 30) * 30;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function isTripDay(date: string): date is DateKey {
  return (TRIP_DAYS as string[]).includes(date);
}

/** Current Malaysia date and minute of day, independent of the device time zone. */
export function nowMyt(nowMs = Date.now()): { date: string; min: number } {
  const t = new Date(nowMs + MYT_OFFSET_MIN * 60_000);
  const date = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  return { date, min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** Shift a 'YYYY-MM-DD' by whole days. */
export function addDays(date: string, n: number): string {
  const p = parts(date);
  const t = new Date(Date.UTC(p.y, p.mo - 1, p.d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Malaysia time on the trip clock: before 5 AM still belongs to the previous day, as minutes past 1440. */
export function tripNow(nowMs = Date.now()): { date: string; min: number } {
  const n = nowMyt(nowMs);
  return n.min < DAY_START_MIN ? { date: addDays(n.date, -1), min: n.min + 1440 } : n;
}

/** Today's trip day in Malaysia time (days turn over at 5 AM), or null outside the window. */
export function todayTripDay(nowMs = Date.now()): DateKey | null {
  const { date } = tripNow(nowMs);
  return isTripDay(date) ? date : null;
}

/**
 * Items saved before days ran 5 AM to 5 AM may sit on the next date before 5 AM. Show them on the
 * day they belong to, after midnight. The first trip day keeps early items, clamped to 5 AM.
 */
export function toTripDayItem<T extends { date: DateKey; startMin: number; endMin: number }>(item: T): T {
  if (item.startMin >= DAY_START_MIN) return item;
  const prev = addDays(item.date, -1);
  if (isTripDay(prev)) {
    return {
      ...item,
      date: prev,
      startMin: item.startMin + 1440,
      endMin: Math.min(DAY_END_MIN, item.endMin + 1440),
    };
  }
  const len = Math.max(30, item.endMin - item.startMin);
  return { ...item, startMin: DAY_START_MIN, endMin: DAY_START_MIN + len };
}

/** Whole days between two 'YYYY-MM-DD' strings (b minus a). */
export function daysBetween(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.mo - 1, pb.d) - Date.UTC(pa.y, pa.mo - 1, pa.d)) / 86_400_000);
}
