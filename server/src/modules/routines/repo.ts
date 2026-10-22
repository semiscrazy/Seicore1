import { transaction, type DB } from '../../db.js';
import { addDays, type ISODate } from '../../lib/dates.js';
import { computeStreak, type Frequency, isFlexible, isScheduledOn, periodOf, type ScheduleRule, targetFor } from './schedule.js';

export interface StepInput { id?: number; label: string }
export interface SessionInput { id?: number; label: string; time?: string | null; steps: StepInput[] }
export interface RoutineInput {
  name: string;
  description: string;
  icon: string;
  color: string;
  frequency: Frequency;
  daysOfWeek: number[];
  timesPerPeriod: number;
  startDate: ISODate;
  sessions: SessionInput[];
}

export interface Step { id: number; label: string }
export interface Session { id: number; label: string; time: string | null; steps: Step[] }
export interface Routine extends Omit<RoutineInput, 'sessions'> {
  id: number;
  archived: boolean;
  sessions: Session[];
}

interface RoutineRow {
  id: number; name: string; description: string; icon: string; color: string; frequency: Frequency;
  days_of_week: string; times_per_period: number; start_date: string; archived_at: string | null;
}
interface SessionRow { id: number; routine_id: number; label: string; time: string | null }
interface StepRow { id: number; session_id: number; label: string }

export class NotFoundError extends Error {}

export function ruleOf(r: Pick<Routine, 'frequency' | 'daysOfWeek' | 'timesPerPeriod' | 'startDate'>): ScheduleRule {
  return { frequency: r.frequency, daysOfWeek: r.daysOfWeek, timesPerPeriod: r.timesPerPeriod, startDate: r.startDate };
}

function hydrate(db: DB, rows: RoutineRow[]): Routine[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  const sessions = db
    .prepare(`SELECT id, routine_id, label, time FROM routine_sessions WHERE routine_id IN (${marks}) ORDER BY sort_order, id`)
    .all(...ids) as unknown as SessionRow[];
  const sessionIds = sessions.map((s) => s.id);
  const steps = sessionIds.length
    ? (db
        .prepare(`SELECT id, session_id, label FROM routine_steps WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY sort_order, id`)
        .all(...sessionIds) as unknown as StepRow[])
    : [];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    color: r.color,
    frequency: r.frequency,
    daysOfWeek: JSON.parse(r.days_of_week),
    timesPerPeriod: r.times_per_period,
    startDate: r.start_date,
    archived: r.archived_at !== null,
    sessions: sessions
      .filter((s) => s.routine_id === r.id)
      .map((s) => ({
        id: s.id,
        label: s.label,
        time: s.time,
        steps: steps.filter((st) => st.session_id === s.id).map((st) => ({ id: st.id, label: st.label })),
      })),
  }));
}

const ROUTINE_COLUMNS = 'id, name, description, icon, color, frequency, days_of_week, times_per_period, start_date, archived_at';

export function listRoutines(db: DB, userId: number, opts: { includeArchived?: boolean } = {}): Routine[] {
  const rows = db
    .prepare(
      `SELECT ${ROUTINE_COLUMNS} FROM routines WHERE user_id = ? ${opts.includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY sort_order, id`,
    )
    .all(userId) as unknown as RoutineRow[];
  return hydrate(db, rows);
}

export function getRoutine(db: DB, userId: number, id: number): Routine {
  const row = db.prepare(`SELECT ${ROUTINE_COLUMNS} FROM routines WHERE id = ? AND user_id = ?`).get(id, userId) as unknown as
    | RoutineRow
    | undefined;
  if (!row) throw new NotFoundError('Routine not found');
  return hydrate(db, [row])[0];
}

function writeSessions(db: DB, routineId: number, sessions: SessionInput[]) {
  const existing = db.prepare('SELECT id FROM routine_sessions WHERE routine_id = ?').all(routineId) as { id: number }[];
  const existingIds = new Set(existing.map((s) => s.id));
  const keep = new Set(sessions.flatMap((s) => (s.id && existingIds.has(s.id) ? [s.id] : [])));
  for (const { id } of existing) if (!keep.has(id)) db.prepare('DELETE FROM routine_sessions WHERE id = ?').run(id);

  sessions.forEach((s, i) => {
    let sessionId: number;
    if (s.id && keep.has(s.id)) {
      sessionId = s.id;
      db.prepare('UPDATE routine_sessions SET label = ?, time = ?, sort_order = ? WHERE id = ?').run(s.label, s.time ?? null, i, sessionId);
    } else {
      sessionId = Number(
        db.prepare('INSERT INTO routine_sessions (routine_id, label, time, sort_order) VALUES (?, ?, ?, ?)').run(routineId, s.label, s.time ?? null, i)
          .lastInsertRowid,
      );
    }

    const existingSteps = db.prepare('SELECT id FROM routine_steps WHERE session_id = ?').all(sessionId) as { id: number }[];
    const existingStepIds = new Set(existingSteps.map((st) => st.id));
    const keepSteps = new Set(s.steps.flatMap((st) => (st.id && existingStepIds.has(st.id) ? [st.id] : [])));
    for (const { id } of existingSteps) if (!keepSteps.has(id)) db.prepare('DELETE FROM routine_steps WHERE id = ?').run(id);
    s.steps.forEach((st, j) => {
      if (st.id && keepSteps.has(st.id)) {
        db.prepare('UPDATE routine_steps SET label = ?, sort_order = ? WHERE id = ?').run(st.label, j, st.id);
      } else {
        db.prepare('INSERT INTO routine_steps (session_id, label, sort_order) VALUES (?, ?, ?)').run(sessionId, st.label, j);
      }
    });
  });
}

export function createRoutine(db: DB, userId: number, input: RoutineInput): Routine {
  const id = transaction(db, () => {
    const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM routines WHERE user_id = ?').get(userId) as { next: number };
    const id = Number(
      db
        .prepare(
          `INSERT INTO routines (user_id, name, description, icon, color, frequency, days_of_week, times_per_period, start_date, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(userId, input.name, input.description, input.icon, input.color, input.frequency, JSON.stringify(input.daysOfWeek), input.timesPerPeriod, input.startDate, next)
        .lastInsertRowid,
    );
    writeSessions(db, id, input.sessions);
    return id;
  });
  return getRoutine(db, userId, id);
}

export function updateRoutine(db: DB, userId: number, id: number, input: RoutineInput): Routine {
  getRoutine(db, userId, id);
  transaction(db, () => {
    db.prepare(
      `UPDATE routines SET name = ?, description = ?, icon = ?, color = ?, frequency = ?, days_of_week = ?, times_per_period = ?, start_date = ?
       WHERE id = ? AND user_id = ?`,
    ).run(input.name, input.description, input.icon, input.color, input.frequency, JSON.stringify(input.daysOfWeek), input.timesPerPeriod, input.startDate, id, userId);
    writeSessions(db, id, input.sessions);
  });
  return getRoutine(db, userId, id);
}

export function setArchived(db: DB, userId: number, id: number, archived: boolean): Routine {
  getRoutine(db, userId, id);
  db.prepare(`UPDATE routines SET archived_at = ${archived ? "datetime('now')" : 'NULL'} WHERE id = ? AND user_id = ?`).run(id, userId);
  return getRoutine(db, userId, id);
}

export function deleteRoutine(db: DB, userId: number, id: number) {
  const { changes } = db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').run(id, userId);
  if (!changes) throw new NotFoundError('Routine not found');
}

export function reorderRoutines(db: DB, userId: number, ids: number[]) {
  transaction(db, () => {
    ids.forEach((id, i) => db.prepare('UPDATE routines SET sort_order = ? WHERE id = ? AND user_id = ?').run(i, id, userId));
  });
}

// ---------------------------------------------------------------------------
// Check-offs

function ownedSession(db: DB, userId: number, sessionId: number) {
  const row = db
    .prepare('SELECT s.id FROM routine_sessions s JOIN routines r ON r.id = s.routine_id WHERE s.id = ? AND r.user_id = ?')
    .get(sessionId, userId);
  if (!row) throw new NotFoundError('Session not found');
}

/** Mark a whole session done or not done on `date`; checks/unchecks all of its steps too. */
export function setSessionDone(db: DB, userId: number, sessionId: number, date: ISODate, done: boolean) {
  ownedSession(db, userId, sessionId);
  transaction(db, () => {
    if (done) {
      db.prepare('INSERT OR IGNORE INTO completions (session_id, date) VALUES (?, ?)').run(sessionId, date);
      db.prepare('INSERT OR IGNORE INTO step_checks (step_id, date) SELECT id, ? FROM routine_steps WHERE session_id = ?').run(date, sessionId);
    } else {
      db.prepare('DELETE FROM completions WHERE session_id = ? AND date = ?').run(sessionId, date);
      db.prepare('DELETE FROM step_checks WHERE date = ? AND step_id IN (SELECT id FROM routine_steps WHERE session_id = ?)').run(date, sessionId);
    }
  });
}

/** Check or uncheck one step; the session counts as done once every step is checked. */
export function setStepChecked(db: DB, userId: number, stepId: number, date: ISODate, checked: boolean) {
  const row = db
    .prepare(
      `SELECT st.session_id FROM routine_steps st JOIN routine_sessions s ON s.id = st.session_id JOIN routines r ON r.id = s.routine_id
       WHERE st.id = ? AND r.user_id = ?`,
    )
    .get(stepId, userId) as { session_id: number } | undefined;
  if (!row) throw new NotFoundError('Step not found');

  transaction(db, () => {
    if (checked) db.prepare('INSERT OR IGNORE INTO step_checks (step_id, date) VALUES (?, ?)').run(stepId, date);
    else db.prepare('DELETE FROM step_checks WHERE step_id = ? AND date = ?').run(stepId, date);

    const { total, done } = db
      .prepare(
        `SELECT COUNT(*) AS total, COUNT(c.step_id) AS done FROM routine_steps st
         LEFT JOIN step_checks c ON c.step_id = st.id AND c.date = ? WHERE st.session_id = ?`,
      )
      .get(date, row.session_id) as { total: number; done: number };
    if (total > 0 && done === total) db.prepare('INSERT OR IGNORE INTO completions (session_id, date) VALUES (?, ?)').run(row.session_id, date);
    else db.prepare('DELETE FROM completions WHERE session_id = ? AND date = ?').run(row.session_id, date);
  });
}

// ---------------------------------------------------------------------------
// Day view & history

export interface DaySession extends Session {
  done: boolean;
  checkedStepIds: number[];
  /** Completions within the current period (week/month for flexible routines, otherwise 0 or 1). */
  periodCount: number;
  pending: boolean;
}

export interface DayRoutine {
  routine: Routine;
  scheduled: boolean;
  target: number;
  period: { start: ISODate; end: ISODate };
  sessions: DaySession[];
  done: boolean;
  pending: boolean;
  streak: number;
}

/** Map of sessionId -> set of dates with a completion, within [from, to]. */
function completionsBetween(db: DB, sessionIds: number[], from: ISODate, to: ISODate): Map<number, Set<ISODate>> {
  const map = new Map<number, Set<ISODate>>(sessionIds.map((id) => [id, new Set()]));
  if (!sessionIds.length) return map;
  const rows = db
    .prepare(`SELECT session_id, date FROM completions WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) AND date BETWEEN ? AND ?`)
    .all(...sessionIds, from, to) as { session_id: number; date: string }[];
  for (const r of rows) map.get(r.session_id)!.add(r.date);
  return map;
}

const STREAK_LOOKBACK_DAYS = 400;

/** Everything needed to render (or remind about) one day for a user. */
export function getDay(db: DB, userId: number, date: ISODate, today: ISODate = date): DayRoutine[] {
  const routines = listRoutines(db, userId).filter((r) => r.startDate <= date);
  const sessionIds = routines.flatMap((r) => r.sessions.map((s) => s.id));
  const stepIds = routines.flatMap((r) => r.sessions.flatMap((s) => s.steps.map((st) => st.id)));
  const from = addDays(date < today ? date : today, -STREAK_LOOKBACK_DAYS);
  const completions = completionsBetween(db, sessionIds, from, addDays(date > today ? date : today, 31));
  const checked = new Set(
    stepIds.length
      ? (db.prepare(`SELECT step_id FROM step_checks WHERE date = ? AND step_id IN (${stepIds.map(() => '?').join(',')})`).all(date, ...stepIds) as {
          step_id: number;
        }[]).map((r) => r.step_id)
      : [],
  );

  return routines.flatMap((routine) => {
    const rule = ruleOf(routine);
    const scheduled = isScheduledOn(rule, date);
    if (!scheduled) return [];
    const flexible = isFlexible(rule);
    const target = targetFor(rule);
    const period = periodOf(rule, date);

    const sessions: DaySession[] = routine.sessions.map((s) => {
      const dates = completions.get(s.id)!;
      const done = dates.has(date);
      const periodCount = flexible ? [...dates].filter((d) => d >= period.start && d <= period.end).length : done ? 1 : 0;
      return {
        ...s,
        done,
        checkedStepIds: s.steps.filter((st) => checked.has(st.id)).map((st) => st.id),
        periodCount,
        pending: !done && periodCount < target,
      };
    });

    const allDoneOn = (d: ISODate) => routine.sessions.every((s) => completions.get(s.id)!.has(d));
    return [
      {
        routine,
        scheduled,
        target,
        period,
        sessions,
        done: sessions.every((s) => s.done),
        pending: sessions.some((s) => s.pending),
        streak: computeStreak(rule, today, allDoneOn, STREAK_LOOKBACK_DAYS),
      },
    ];
  });
}

export function getHistory(db: DB, userId: number, routineId: number, from: ISODate, to: ISODate, today: ISODate = to) {
  const routine = getRoutine(db, userId, routineId);
  const lookbackFrom = addDays(from < today ? from : today, -STREAK_LOOKBACK_DAYS);
  const completions = completionsBetween(db, routine.sessions.map((s) => s.id), lookbackFrom, to > today ? to : today);
  const allDoneOn = (d: ISODate) => routine.sessions.every((s) => completions.get(s.id)!.has(d));
  const days: { date: ISODate; scheduled: boolean; completedSessionIds: number[] }[] = [];
  const rule = ruleOf(routine);
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push({
      date: d,
      scheduled: isScheduledOn(rule, d),
      completedSessionIds: routine.sessions.filter((s) => completions.get(s.id)!.has(d)).map((s) => s.id),
    });
  }
  return { routine, days, streak: computeStreak(rule, today, allDoneOn, STREAK_LOOKBACK_DAYS) };
}
