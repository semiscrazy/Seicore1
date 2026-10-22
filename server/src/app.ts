import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { config } from './config.js';
import type { DB } from './db.js';
import { errorHandler, HttpError } from './lib/http.js';
import { accountRoutes } from './modules/account/routes.js';
import { requireAuth } from './modules/auth/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { reminderRoutes } from './modules/reminders/routes.js';
import { routineRoutes } from './modules/routines/routes.js';

export function createApp(db: DB, opts: { serveClient?: boolean } = {}) {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRoutes(db));

  // Everything below requires a signed-in user. New feature modules mount here.
  api.use(requireAuth(db));
  api.use('/me', accountRoutes(db));
  api.use('/push', reminderRoutes(db));
  api.use('/', routineRoutes(db));

  api.use(() => {
    throw new HttpError(404, 'Not found');
  });
  app.use('/api', api);

  if (opts.serveClient && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
