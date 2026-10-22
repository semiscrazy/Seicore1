import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../../db.js';
import { isValidTimezone } from '../../lib/dates.js';
import { HttpError } from '../../lib/http.js';
import { findUserRow, hashPassword, toUser, verifyPassword } from '../auth/auth.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone').optional(),
  reminderTime: time.optional(),
  remindersEnabled: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export function accountRoutes(db: DB) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ user: req.user });
  });

  router.patch('/', (req, res) => {
    const input = updateSchema.parse(req.body);
    const fields: [string, string | number][] = [];
    if (input.name !== undefined) fields.push(['name', input.name]);
    if (input.timezone !== undefined) fields.push(['timezone', input.timezone]);
    if (input.reminderTime !== undefined) fields.push(['reminder_time', input.reminderTime]);
    if (input.remindersEnabled !== undefined) fields.push(['reminders_enabled', input.remindersEnabled ? 1 : 0]);
    if (fields.length) {
      db.prepare(`UPDATE users SET ${fields.map(([c]) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...fields.map(([, v]) => v), req.user!.id);
    }
    res.json({ user: toUser(findUserRow(db, { id: req.user!.id })!) });
  });

  router.post('/password', async (req, res) => {
    const input = passwordSchema.parse(req.body);
    const row = findUserRow(db, { id: req.user!.id })!;
    if (!(await verifyPassword(input.currentPassword, row.password_hash))) throw new HttpError(400, 'Current password is incorrect');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(input.newPassword), row.id);
    res.status(204).end();
  });

  return router;
}
