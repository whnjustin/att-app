import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatDay,
  formatDayLong,
  formatDayMonth,
  formatMin,
  formatRange,
  formatTime,
  hhmmToMin,
  minToHHmm,
  nowMyt,
  snap30,
  todayTripDay,
} from './time';

describe('time', () => {
  it('formats times', () => {
    expect(formatTime('16:00')).toBe('4 PM');
    expect(formatTime('16:30')).toBe('4:30 PM');
    expect(formatTime('00:00')).toBe('12 AM');
    expect(formatTime('12:00')).toBe('12 PM');
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatMin(1440)).toBe('12 AM');
    expect(formatRange(720, 780)).toBe('12 PM to 1 PM');
  });
  it('converts minutes', () => {
    expect(hhmmToMin('16:30')).toBe(990);
    expect(minToHHmm(990)).toBe('16:30');
    expect(minToHHmm(0)).toBe('00:00');
    expect(minToHHmm(1440)).toBe('24:00');
  });
  it('formats days', () => {
    expect(formatDay('2026-11-19')).toBe('Thu 19');
    expect(formatDay('2026-11-22')).toBe('Sun 22');
    expect(formatDayMonth('2026-11-27')).toBe('Fri 27 Nov');
    expect(formatDayLong('2026-11-19')).toBe('Thursday 19 November');
  });
  it('snaps to 30', () => {
    expect(snap30(14)).toBe(0);
    expect(snap30(15)).toBe(30);
    expect(snap30(749)).toBe(750);
  });
  it('computes Malaysia now', () => {
    const ms = Date.UTC(2026, 10, 19, 16, 30); // 00:30 on the 20th in KL
    expect(nowMyt(ms)).toEqual({ date: '2026-11-20', min: 30 });
    expect(todayTripDay(ms)).toBe('2026-11-20');
    expect(todayTripDay(Date.UTC(2026, 10, 30))).toBeNull();
  });
  it('counts days', () => {
    expect(daysBetween('2026-11-19', '2026-11-27')).toBe(8);
  });
});
