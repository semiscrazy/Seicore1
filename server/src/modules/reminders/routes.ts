import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../../db.js';
import { localNow } from '../../lib/dates.js';
import { HttpError } from '../../lib/http.js';
import { getDay } from '../routines/repo.js';
import { removeSubscription, saveSubscription, sendToUser, subscriptionCount, vapidPublicKey } from './push.js';
import { sessionName } from './reminders.js';

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export function reminderRoutes(db: DB) {
  const router = Router();

  router.get('/public-key', (req, res) => {
    res.json({ publicKey: vapidPublicKey(db), devices: subscriptionCount(db, req.user!.id) });
  });

  router.post('/subscribe', (req, res) => {
    saveSubscription(db, req.user!.id, subscriptionSchema.parse(req.body));
    res.status(204).end();
  });

  router.post('/unsubscribe', (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
    removeSubscription(db, req.user!.id, endpoint);
    res.status(204).end();
  });

  /** Sends what's pending right now, so you can check notifications work on this device. */
  router.post('/test', async (req, res) => {
    const day = getDay(db, req.user!.id, localNow(req.user!.timezone).date);
    const pending = day.flatMap((r) => r.sessions.filter((s) => s.pending).map((s) => `${r.routine.icon} ${sessionName(r.routine.name, s.label)}`));
    const delivered = await sendToUser(db, req.user!.id, {
      title: pending.length ? `${pending.length} pending today` : 'All caught up 🎉',
      body: pending.length ? pending.join('\n') : 'Notifications are working on this device.',
      url: '/',
      tag: 'test',
    });
    if (!delivered) throw new HttpError(400, 'No device is subscribed. Enable notifications first.');
    res.json({ delivered });
  });

  return router;
}
