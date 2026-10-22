import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../../db.js';
import { addDays, localNow, parseISODate } from '../../lib/dates.js';
import { HttpError } from '../../lib/http.js';
import {
  createRoutine,
  deleteRoutine,
  getDay,
  getHistory,
  getRoutine,
  listRoutines,
  reorderRoutines,
  setArchived,
  setSessionDone,
  setStepChecked,
  updateRoutine,
} from './repo.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(parseISODate(s).getTime()), 'Invalid date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const id = z.coerce.number().int().positive();

const routineSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    description: z.string().trim().max(1000).default(''),
    icon: z.string().trim().min(1).max(16).default('✅'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4f46e5'),
    frequency: z.enum(['daily', 'days', 'weekly', 'monthly']),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
    timesPerPeriod: z.number().int().min(1).max(31).default(1),
    startDate: isoDate.optional(),
    sessions: z
      .array(
        z.object({
          id: z.number().int().positive().optional(),
          label: z.string().trim().max(60).default(''),
          time: time.nullish(),
          steps: z.array(z.object({ id: z.number().int().positive().optional(), label: z.string().trim().min(1).max(120) })).max(50).default([]),
        }),
      )
      .min(1, 'Add at least one session')
      .max(10),
  })
  .refine((r) => r.frequency !== 'days' || r.daysOfWeek.length > 0, { message: 'Pick at least one day', path: ['daysOfWeek'] });

export function routineRoutes(db: DB) {
  const router = Router();

  const todayFor = (tz: string) => localNow(tz).date;

  /** A date from the query/body, defaulting to the user's today; future dates are rejected. */
  const dateParam = (value: unknown, tz: string) => {
    const today = todayFor(tz);
    if (value === undefined || value === '') return { date: today, today };
    const date = isoDate.parse(value);
    if (date > today) throw new HttpError(400, "Can't check off future days");
    return { date, today };
  };

  const toInput = (body: unknown, tz: string) => {
    const parsed = routineSchema.parse(body);
    return {
      ...parsed,
      daysOfWeek: [...new Set(parsed.daysOfWeek)].sort(),
      startDate: parsed.startDate ?? todayFor(tz),
      sessions: parsed.sessions.map((s) => ({ ...s, time: s.time ?? null })),
    };
  };

  router.get('/routines', (req, res) => {
    res.json({ routines: listRoutines(db, req.user!.id, { includeArchived: req.query.archived === '1' }) });
  });

  router.post('/routines', (req, res) => {
    res.status(201).json({ routine: createRoutine(db, req.user!.id, toInput(req.body, req.user!.timezone)) });
  });

  router.post('/routines/reorder', (req, res) => {
    const { ids } = z.object({ ids: z.array(id) }).parse(req.body);
    reorderRoutines(db, req.user!.id, ids);
    res.status(204).end();
  });

  router.get('/routines/:id', (req, res) => {
    res.json({ routine: getRoutine(db, req.user!.id, id.parse(req.params.id)) });
  });

  router.put('/routines/:id', (req, res) => {
    res.json({ routine: updateRoutine(db, req.user!.id, id.parse(req.params.id), toInput(req.body, req.user!.timezone)) });
  });

  router.post('/routines/:id/archive', (req, res) => {
    const { archived } = z.object({ archived: z.boolean() }).parse(req.body);
    res.json({ routine: setArchived(db, req.user!.id, id.parse(req.params.id), archived) });
  });

  router.delete('/routines/:id', (req, res) => {
    deleteRoutine(db, req.user!.id, id.parse(req.params.id));
    res.status(204).end();
  });

  router.get('/routines/:id/history', (req, res) => {
    const today = todayFor(req.user!.timezone);
    const to = req.query.to ? isoDate.parse(req.query.to) : today;
    const from = req.query.from ? isoDate.parse(req.query.from) : addDays(to, -7 * 17 + 1);
    if (from > to || parseISODate(to).getTime() - parseISODate(from).getTime() > 400 * 86400000) {
      throw new HttpError(400, 'Invalid range');
    }
    res.json(getHistory(db, req.user!.id, id.parse(req.params.id), from, to, today));
  });

  router.get('/today', (req, res) => {
    const { date, today } = dateParam(req.query.date, req.user!.timezone);
    const routines = getDay(db, req.user!.id, date, today);
    const sessions = routines.flatMap((r) => r.sessions);
    res.json({
      date,
      today,
      routines,
      summary: {
        routines: routines.length,
        pending: routines.filter((r) => r.pending).length,
        sessions: sessions.length,
        sessionsDone: sessions.filter((s) => s.done).length,
      },
    });
  });

  router.put('/sessions/:id/done', (req, res) => {
    const body = z.object({ date: isoDate.optional(), done: z.boolean() }).parse(req.body);
    const { date } = dateParam(body.date, req.user!.timezone);
    setSessionDone(db, req.user!.id, id.parse(req.params.id), date, body.done);
    res.status(204).end();
  });

  router.put('/steps/:id/checked', (req, res) => {
    const body = z.object({ date: isoDate.optional(), checked: z.boolean() }).parse(req.body);
    const { date } = dateParam(body.date, req.user!.timezone);
    setStepChecked(db, req.user!.id, id.parse(req.params.id), date, body.checked);
    res.status(204).end();
  });

  return router;
}
