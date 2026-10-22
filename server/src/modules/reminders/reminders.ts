import { minutesOf } from '../../lib/dates.js';
import type { DayRoutine } from '../routines/repo.js';

export interface Reminder {
  /** Dedup key; a reminder with a given key is sent at most once. */
  key: string;
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Reminders stay eligible for this long after their time, so a brief outage doesn't drop them. */
export const SUMMARY_WINDOW_MIN = 180;
export const SESSION_WINDOW_MIN = 60;

const inWindow = (now: string, at: string, windowMin: number) => {
  const delta = minutesOf(now) - minutesOf(at);
  return delta >= 0 && delta < windowMin;
};

export function sessionName(routineName: string, label: string) {
  return label ? `${routineName} · ${label}` : routineName;
}

/**
 * Work out which reminders are due for a user at local `time` on `date`:
 * one morning summary of everything pending, plus a nudge for each pending
 * session that has its own time (e.g. "Face care · Evening" at 21:00).
 */
export function dueReminders(day: DayRoutine[], opts: { date: string; time: string; summaryTime: string }): Reminder[] {
  const reminders: Reminder[] = [];
  const pending = day.filter((r) => r.pending);

  if (pending.length && inWindow(opts.time, opts.summaryTime, SUMMARY_WINDOW_MIN)) {
    const names = pending.map((r) => `${r.routine.icon} ${r.routine.name}`);
    reminders.push({
      key: `summary:${opts.date}`,
      title: pending.length === 1 ? '1 routine pending today' : `${pending.length} routines pending today`,
      body: names.join('\n'),
      url: '/',
      tag: 'daily-summary',
    });
  }

  for (const r of pending) {
    for (const s of r.sessions) {
      if (!s.pending || !s.time || !inWindow(opts.time, s.time, SESSION_WINDOW_MIN)) continue;
      const remaining = s.steps.filter((st) => !s.checkedStepIds.includes(st.id)).map((st) => st.label);
      reminders.push({
        key: `session:${s.id}:${opts.date}`,
        title: `${r.routine.icon} Time for ${sessionName(r.routine.name, s.label)}`,
        body: remaining.length ? remaining.join(' → ') : r.routine.description || 'Tap to check it off.',
        url: '/',
        tag: `session-${s.id}`,
      });
    }
  }

  return reminders;
}
