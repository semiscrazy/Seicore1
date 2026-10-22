import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import type { DB } from '../../db.js';
import { isValidTimezone } from '../../lib/dates.js';
import { HttpError } from '../../lib/http.js';
import {
  createLoginLimiter,
  endSession,
  findUserRow,
  hashPassword,
  startSession,
  toUser,
  userCount,
  verifyPassword,
} from './auth.js';

const timezone = z.string().refine(isValidTimezone, 'Unknown timezone');

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  timezone: timezone.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export function authRoutes(db: DB) {
  const router = Router();
  const limiter = createLoginLimiter();

  const signupOpen = () => userCount(db) === 0 || config.allowSignup;

  router.get('/status', (_req, res) => {
    res.json({ needsSetup: userCount(db) === 0, signupOpen: signupOpen() });
  });

  router.post('/signup', async (req, res) => {
    if (!signupOpen()) throw new HttpError(403, 'Sign-up is closed');
    const input = signupSchema.parse(req.body);
    if (findUserRow(db, { email: input.email })) throw new HttpError(409, 'An account with this email already exists');
    const hash = await hashPassword(input.password);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (email, name, password_hash, timezone) VALUES (?, ?, ?, ?)')
      .run(input.email, input.name, hash, input.timezone ?? 'UTC');
    const user = toUser(findUserRow(db, { id: Number(lastInsertRowid) })!);
    startSession(db, res, user.id);
    res.status(201).json({ user });
  });

  router.post('/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    const key = `${req.ip}|${input.email}`;
    limiter.check(key);
    const row = findUserRow(db, { email: input.email });
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      limiter.fail(key);
      throw new HttpError(401, 'Incorrect email or password');
    }
    limiter.reset(key);
    startSession(db, res, row.id);
    res.json({ user: toUser(row) });
  });

  router.post('/logout', (_req, res) => {
    endSession(res);
    res.status(204).end();
  });

  return router;
}
