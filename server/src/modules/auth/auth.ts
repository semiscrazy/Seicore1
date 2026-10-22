import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { getSetting, setSetting, type DB } from '../../db.js';
import { HttpError } from '../../lib/http.js';

export const COOKIE_NAME = 'seicore_session';
const SESSION_DAYS = 30;

export interface User {
  id: number;
  email: string;
  name: string;
  timezone: string;
  reminderTime: string;
  remindersEnabled: boolean;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  timezone: string;
  reminder_time: string;
  reminders_enabled: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    reminderTime: row.reminder_time,
    remindersEnabled: !!row.reminders_enabled,
  };
}

export function findUserRow(db: DB, by: { id: number } | { email: string }): UserRow | undefined {
  return ('id' in by
    ? db.prepare('SELECT * FROM users WHERE id = ?').get(by.id)
    : db.prepare('SELECT * FROM users WHERE email = ?').get(by.email)) as UserRow | undefined;
}

export function userCount(db: DB): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

export function jwtSecret(db: DB): string {
  if (config.jwtSecret) return config.jwtSecret;
  let secret = getSetting(db, 'jwt_secret');
  if (!secret) {
    secret = crypto.randomBytes(48).toString('base64url');
    setSetting(db, 'jwt_secret', secret);
  }
  return secret;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function startSession(db: DB, res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, jwtSecret(db), { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Attaches `req.user` from the session cookie, or responds 401. */
export function requireAuth(db: DB) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next(new HttpError(401, 'Not signed in'));
    try {
      const payload = jwt.verify(token, jwtSecret(db)) as { sub: string };
      const row = findUserRow(db, { id: Number(payload.sub) });
      if (!row) return next(new HttpError(401, 'Not signed in'));
      req.user = toUser(row);
      next();
    } catch {
      next(new HttpError(401, 'Session expired'));
    }
  };
}

/** Tiny in-memory limiter for login attempts, keyed by IP + email. */
export function createLoginLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key: string) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (entry && entry.resetAt > now && entry.count >= max) {
        throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
      }
    },
    fail(key: string) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + windowMs });
      else entry.count++;
    },
    reset(key: string) {
      attempts.delete(key);
    },
  };
}
