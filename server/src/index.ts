import path from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { startReminderScheduler } from './modules/reminders/scheduler.js';

const db = openDb(path.join(config.dataDir, 'seicore.db'));
const app = createApp(db, { serveClient: true });

app.listen(config.port, () => {
  console.log(`Seicore running on http://localhost:${config.port}`);
});
startReminderScheduler(db);
