# Seicore

A personal productivity app. Sign in and keep up with your routines. More features will be added over time.

## Features

### Routines (feature #1)
- **Schedules:** every day, specific weekdays (e.g. Mon/Wed/Fri), *N* times per week, or *N* times per month.
- **Sessions:** split a routine into parts done at different times of day, e.g. *Face care → Morning* and *Evening*.
- **Steps:** a checklist inside each session (*Cleanser → Vitamin C serum → Sunscreen*). Checking every step completes the session. You can also tick the session to finish it in one tap.
- **Today view:** shows what's pending and what's done, with a progress ring, streaks, and weekly/monthly progress (“2/3 this week”). You can go back to earlier days to check off something you forgot.
- **History:** each routine gets a heatmap of the last 17 weeks, its streak, and its 30-day consistency.
- **Reminders:** push notifications on desktop and mobile (the app can be installed as a PWA):
  - a daily summary of what's pending, at a time you choose (default 08:00)
  - a nudge at a session's own time if it isn't done yet (e.g. *Face care · Evening* at 22:00)
- **Templates** to start quickly: daily 7 km walk, AM/PM face care, workout 3×/week, weekly review.

### Account
- Login page with email and password. Passwords are hashed with bcrypt, sessions use a 30-day httpOnly cookie, and login attempts are rate-limited.
- The first person to open the app creates the owner account, and sign-up closes after that. Set `ALLOW_SIGNUP=true` to allow more accounts.

## Running it

Requires Node.js **22.13+**. The app uses the built-in `node:sqlite`, so there are no native dependencies.

```bash
npm install
npm run dev        # API on :3001, web app on http://localhost:5173
```

Production:

```bash
npm run build
npm start          # serves app + API on http://localhost:3001
```

Or with Docker:

```bash
docker build -t seicore .
docker run -p 3001:3001 -v seicore-data:/data -e COOKIE_SECURE=true seicore
```

**Free hosting:** see [deploy/ORACLE.md](deploy/ORACLE.md) for a step-by-step guide (Oracle Cloud Always Free + DuckDNS + automatic HTTPS) and a one-command setup script.

Tests: `npm test`. Type checks: `npm run typecheck`.

### Configuration (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port |
| `DATA_DIR` | `./data` | Where the SQLite database lives |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `ALLOW_SIGNUP` | `false` | Allow sign-ups after the first account |
| `JWT_SECRET` | auto-generated | Session signing secret (stored in the DB if unset) |
| `VAPID_SUBJECT` | `mailto:admin@localhost` | Contact address sent to push services (set it to your email) |

### Notifications
Push notifications only work when the app is served over **HTTPS** (or on `localhost`). To turn them on, open **Settings → Notifications on this device → Turn on** on each device. On iPhone/iPad, first use *Share → Add to Home Screen*, then open Seicore from the Home Screen (needs iOS 16.4+). The server sends the reminders, so it has to keep running. A small VPS, Fly.io, Railway or a home server all work.

## Project structure

```
server/                  Express + SQLite API
  src/db.ts              schema migrations (append new ones for new features)
  src/modules/auth       login, sign-up, sessions
  src/modules/account    profile, reminder settings, password
  src/modules/routines   routines, schedule rules, check-offs, history
  src/modules/reminders  web-push + the reminder scheduler
  test/                  vitest tests
client/                  React + Vite PWA
  src/features.tsx       navigation registry; add new features here
  src/features/routines  Today, Routines list, editor, detail pages
  public/sw.js           service worker for push notifications
```

**Adding a feature:**
1. Create `server/src/modules/<feature>` and mount its router in `app.ts` behind `requireAuth`.
2. Add a migration in `db.ts`.
3. Add pages under `client/src/features/<feature>`.
4. Add a nav entry in `features.tsx` and the routes in `App.tsx`.
