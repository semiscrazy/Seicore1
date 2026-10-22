import webpush from 'web-push';
import { config } from '../../config.js';
import { getSetting, setSetting, type DB } from '../../db.js';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configuredFor: DB | undefined;

/** VAPID keys are generated on first use and kept in the database so subscriptions survive restarts. */
export function vapidPublicKey(db: DB): string {
  let publicKey = getSetting(db, 'vapid_public_key');
  let privateKey = getSetting(db, 'vapid_private_key');
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    setSetting(db, 'vapid_public_key', publicKey);
    setSetting(db, 'vapid_private_key', privateKey);
  }
  if (configuredFor !== db) {
    webpush.setVapidDetails(config.vapidSubject, publicKey, privateKey);
    configuredFor = db;
  }
  return publicKey;
}

export function saveSubscription(db: DB, userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}

export function removeSubscription(db: DB, userId: number, endpoint: string) {
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
}

export function subscriptionCount(db: DB, userId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?').get(userId) as { n: number }).n;
}

/** Send to every device the user subscribed; prunes subscriptions the push service says are gone. */
export async function sendToUser(db: DB, userId: number, payload: PushPayload): Promise<number> {
  vapidPublicKey(db);
  const subs = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId) as {
    id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
        else console.warn(`Push to subscription ${s.id} failed:`, (err as Error).message);
      }
    }),
  );
  return delivered;
}
