import type { DB } from '../../db.js';
import { localNow } from '../../lib/dates.js';
import { getDay } from '../routines/repo.js';
import { sendToUser } from './push.js';
import { dueReminders } from './reminders.js';

type Sender = typeof sendToUser;

/** One pass over all users with reminders on and at least one subscribed device. */
export async function runReminderTick(db: DB, now = new Date(), send: Sender = sendToUser) {
  const users = db
    .prepare(
      `SELECT id, timezone, reminder_time FROM users u
       WHERE reminders_enabled = 1 AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id)`,
    )
    .all() as { id: number; timezone: string; reminder_time: string }[];

  for (const user of users) {
    const { date, time } = localNow(user.timezone, now);
    const due = dueReminders(getDay(db, user.id, date), { date, time, summaryTime: user.reminder_time });
    for (const r of due) {
      // Claim the key first so overlapping ticks never double-send.
      const { changes } = db.prepare('INSERT OR IGNORE INTO reminder_log (user_id, key) VALUES (?, ?)').run(user.id, r.key);
      if (!changes) continue;
      await send(db, user.id, { title: r.title, body: r.body, url: r.url, tag: r.tag });
    }
  }

  db.prepare("DELETE FROM reminder_log WHERE sent_at < datetime('now', '-7 days')").run();
}

export function startReminderScheduler(db: DB, intervalMs = 30_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runReminderTick(db);
    } catch (err) {
      console.error('Reminder tick failed:', err);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
