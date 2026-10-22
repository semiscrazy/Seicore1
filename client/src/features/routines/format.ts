import { WEEKDAYS } from '../../lib/dates';
import type { Routine } from './types';

export function describeSchedule(r: Pick<Routine, 'frequency' | 'daysOfWeek' | 'timesPerPeriod'>) {
  switch (r.frequency) {
    case 'daily':
      return 'Every day';
    case 'days':
      if (r.daysOfWeek.length === 7) return 'Every day';
      if (sameSet(r.daysOfWeek, [1, 2, 3, 4, 5])) return 'Weekdays';
      if (sameSet(r.daysOfWeek, [0, 6])) return 'Weekends';
      return WEEKDAYS.filter((w) => r.daysOfWeek.includes(w.day)).map((w) => w.short).join(', ');
    case 'weekly':
      return r.timesPerPeriod === 1 ? 'Once a week' : `${r.timesPerPeriod}× a week`;
    case 'monthly':
      return r.timesPerPeriod === 1 ? 'Once a month' : `${r.timesPerPeriod}× a month`;
  }
}

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && b.every((x) => a.includes(x));
}

export function periodWord(r: Pick<Routine, 'frequency'>) {
  return r.frequency === 'monthly' ? 'this month' : 'this week';
}
