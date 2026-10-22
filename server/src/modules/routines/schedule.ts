import { addDays, dayOfWeek, endOfMonth, type ISODate, startOfMonth, startOfWeek } from '../../lib/dates.js';

/**
 * - daily:   every day
 * - days:    on specific weekdays (e.g. Mon/Wed/Fri)
 * - weekly:  N times per week, any day
 * - monthly: N times per month, any day
 */
export type Frequency = 'daily' | 'days' | 'weekly' | 'monthly';

export interface ScheduleRule {
  frequency: Frequency;
  daysOfWeek: number[];
  timesPerPeriod: number;
  startDate: ISODate;
}

/** Whether completions are counted per day or per longer period. */
export function isFlexible(rule: ScheduleRule) {
  return rule.frequency === 'weekly' || rule.frequency === 'monthly';
}

/** First and last day of the period that `date` falls into. */
export function periodOf(rule: ScheduleRule, date: ISODate): { start: ISODate; end: ISODate } {
  switch (rule.frequency) {
    case 'weekly': {
      const start = startOfWeek(date);
      return { start, end: addDays(start, 6) };
    }
    case 'monthly':
      return { start: startOfMonth(date), end: endOfMonth(date) };
    default:
      return { start: date, end: date };
  }
}

/** Whether a fixed-schedule routine is expected on `date`. Flexible routines can be done any day. */
export function isScheduledOn(rule: ScheduleRule, date: ISODate): boolean {
  if (date < rule.startDate) return false;
  if (rule.frequency === 'days') return rule.daysOfWeek.includes(dayOfWeek(date));
  return true;
}

/** How many completions the period requires. */
export function targetFor(rule: ScheduleRule) {
  return isFlexible(rule) ? Math.max(1, rule.timesPerPeriod) : 1;
}

/**
 * Count consecutive satisfied occurrences ending at `today`.
 * `isDone(date)` reports whether the routine was fully completed on a date.
 * An occurrence still open today doesn't break the streak.
 */
export function computeStreak(rule: ScheduleRule, today: ISODate, isDone: (date: ISODate) => boolean, maxLookback = 400): number {
  let streak = 0;

  if (!isFlexible(rule)) {
    for (let i = 0, d = today; i < maxLookback && d >= rule.startDate; i++, d = addDays(d, -1)) {
      if (!isScheduledOn(rule, d)) continue;
      if (isDone(d)) streak++;
      else if (d !== today) break;
    }
    return streak;
  }

  const target = targetFor(rule);
  let { start, end } = periodOf(rule, today);
  for (let i = 0; i < maxLookback && end >= rule.startDate; i++) {
    let count = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) if (isDone(d)) count++;
    const current = i === 0;
    if (count >= target) streak++;
    else if (!current) break;
    ({ start, end } = periodOf(rule, addDays(start, -1)));
  }
  return streak;
}
