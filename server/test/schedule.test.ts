import { describe, expect, it } from 'vitest';
import { addDays, localNow, startOfWeek, endOfMonth } from '../src/lib/dates.js';
import { computeStreak, isScheduledOn, periodOf, type ScheduleRule } from '../src/modules/routines/schedule.js';

const rule = (r: Partial<ScheduleRule>): ScheduleRule => ({ frequency: 'daily', daysOfWeek: [], timesPerPeriod: 1, startDate: '2026-01-01', ...r });

describe('dates', () => {
  it('handles week and month boundaries', () => {
    expect(startOfWeek('2026-10-22')).toBe('2026-10-19'); // Thursday -> Monday
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Sunday belongs to the same week
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('reads wall-clock time in a timezone', () => {
    const now = new Date('2026-10-22T23:30:00Z');
    expect(localNow('UTC', now)).toEqual({ date: '2026-10-22', time: '23:30' });
    expect(localNow('Europe/Istanbul', now)).toEqual({ date: '2026-10-23', time: '02:30' });
  });
});

describe('schedule', () => {
  it('only schedules picked weekdays, from the start date', () => {
    const r = rule({ frequency: 'days', daysOfWeek: [1, 3], startDate: '2026-10-20' });
    expect(isScheduledOn(r, '2026-10-19')).toBe(false); // Monday, before start
    expect(isScheduledOn(r, '2026-10-21')).toBe(true); // Wednesday
    expect(isScheduledOn(r, '2026-10-22')).toBe(false); // Thursday
  });

  it('uses Monday–Sunday weeks and calendar months as periods', () => {
    expect(periodOf(rule({ frequency: 'weekly' }), '2026-10-22')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(periodOf(rule({ frequency: 'monthly' }), '2026-10-22')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });

  it('counts daily streaks without breaking on an unfinished today', () => {
    const done = new Set(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(computeStreak(rule({}), '2026-10-22', (d) => done.has(d))).toBe(3);
    done.add('2026-10-22');
    expect(computeStreak(rule({}), '2026-10-22', (d) => done.has(d))).toBe(4);
  });

  it('skips unscheduled days in weekday streaks', () => {
    const r = rule({ frequency: 'days', daysOfWeek: [1, 3, 5] });
    const done = new Set(['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21']);
    expect(computeStreak(r, '2026-10-22', (d) => done.has(d))).toBe(5);
  });

  it('counts weekly streaks by periods that met the target', () => {
    const r = rule({ frequency: 'weekly', timesPerPeriod: 2 });
    const done = new Set(['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-20']);
    // This week has 1/2 so far (still open), the two weeks before met the target.
    expect(computeStreak(r, '2026-10-22', (d) => done.has(d))).toBe(2);
  });
});
