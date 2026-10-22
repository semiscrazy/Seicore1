import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');

export const config = {
  port: Number(process.env.PORT ?? 3001),
  dataDir: process.env.DATA_DIR ?? path.join(root, 'data'),
  clientDist: process.env.CLIENT_DIST ?? path.join(root, 'client', 'dist'),
  /** When unset, a secret is generated once and stored in the database. */
  jwtSecret: process.env.JWT_SECRET,
  /** Set to "true" when served over HTTPS so the session cookie is marked Secure. */
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  /** Signup is always allowed for the very first account; afterwards only if this is "true". */
  allowSignup: process.env.ALLOW_SIGNUP === 'true',
  /** Contact sent to push services alongside VAPID keys. */
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:admin@localhost',
};
