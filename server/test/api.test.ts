import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb, type DB } from '../src/db.js';
import { localNow } from '../src/lib/dates.js';
import { runReminderTick } from '../src/modules/reminders/scheduler.js';

let db: DB;
let agent: ReturnType<typeof request.agent>;

const faceCare = {
  name: 'Face care',
  icon: '🧴',
  frequency: 'daily',
  sessions: [
    { label: 'Morning', time: '07:30', steps: [{ label: 'Cleanser' }, { label: 'Vitamin C serum' }, { label: 'Sunscreen' }] },
    { label: 'Evening', time: '21:30', steps: [{ label: 'Cleanser' }, { label: 'Retinol' }, { label: 'Night cream' }] },
  ],
};

beforeEach(async () => {
  db = openDb(':memory:');
  agent = request.agent(createApp(db));
  await agent.post('/api/auth/signup').send({ name: 'Me', email: 'me@example.com', password: 'correct horse', timezone: 'UTC' }).expect(201);
});

describe('auth', () => {
  it('closes signup after the first account and requires login', async () => {
    await request(createApp(db)).post('/api/auth/signup').send({ name: 'X', email: 'x@example.com', password: 'password123' }).expect(403);
    const anon = request.agent(createApp(db));
    await anon.get('/api/today').expect(401);
    await anon.post('/api/auth/login').send({ email: 'me@example.com', password: 'wrong password' }).expect(401);
    await anon.post('/api/auth/login').send({ email: 'ME@example.com', password: 'correct horse' }).expect(200);
    await anon.get('/api/today').expect(200);
    await anon.post('/api/auth/logout').expect(204);
    await anon.get('/api/today').expect(401);
  });
});

describe('routines', () => {
  it('tracks a multi-session routine step by step', async () => {
    const { body } = await agent.post('/api/routines').send(faceCare).expect(201);
    const [morning, evening] = body.routine.sessions;

    let today = (await agent.get('/api/today')).body;
    expect(today.summary).toMatchObject({ routines: 1, pending: 1, sessions: 2, sessionsDone: 0 });

    for (const step of morning.steps) await agent.put(`/api/steps/${step.id}/checked`).send({ checked: true }).expect(204);
    today = (await agent.get('/api/today')).body;
    expect(today.routines[0].sessions.map((s: { done: boolean }) => s.done)).toEqual([true, false]);
    expect(today.routines[0].pending).toBe(true);

    await agent.put(`/api/sessions/${evening.id}/done`).send({ done: true }).expect(204);
    today = (await agent.get('/api/today')).body;
    expect(today.routines[0]).toMatchObject({ done: true, pending: false, streak: 1 });

    // Unchecking one step reopens the session.
    await agent.put(`/api/steps/${evening.steps[1].id}/checked`).send({ checked: false }).expect(204);
    today = (await agent.get('/api/today')).body;
    expect(today.routines[0].sessions[1]).toMatchObject({ done: false, checkedStepIds: [evening.steps[0].id, evening.steps[2].id] });
  });

  it('keeps history for sessions and steps that survive an edit', async () => {
    const { body } = await agent.post('/api/routines').send({ name: 'Walk 7 km', frequency: 'daily', sessions: [{ steps: [] }] }).expect(201);
    const session = body.routine.sessions[0];
    await agent.put(`/api/sessions/${session.id}/done`).send({ done: true }).expect(204);

    await agent
      .put(`/api/routines/${body.routine.id}`)
      .send({ name: 'Walk 8 km', frequency: 'daily', sessions: [{ id: session.id, label: '', steps: [] }] })
      .expect(200);
    const today = (await agent.get('/api/today')).body;
    expect(today.routines[0]).toMatchObject({ done: true, routine: { name: 'Walk 8 km' } });
  });

  it('shows flexible routines until the weekly target is met', async () => {
    const { body } = await agent
      .post('/api/routines')
      .send({ name: 'Gym', frequency: 'weekly', timesPerPeriod: 1, sessions: [{ steps: [] }] })
      .expect(201);
    await agent.put(`/api/sessions/${body.routine.sessions[0].id}/done`).send({ done: true }).expect(204);
    const today = (await agent.get('/api/today')).body;
    expect(today.routines[0]).toMatchObject({ pending: false, sessions: [{ periodCount: 1 }] });
  });

  it('rejects future check-offs and other users’ data', async () => {
    const { body } = await agent.post('/api/routines').send(faceCare).expect(201);
    await agent.put(`/api/sessions/${body.routine.sessions[0].id}/done`).send({ done: true, date: '2999-01-01' }).expect(400);

    db.prepare("INSERT INTO users (email, name, password_hash) VALUES ('other@example.com', 'O', 'x')").run();
    const otherId = (db.prepare("SELECT id FROM users WHERE email = 'other@example.com'").get() as { id: number }).id;
    db.prepare('UPDATE routines SET user_id = ?').run(otherId);
    await agent.get(`/api/routines/${body.routine.id}`).expect(404);
    await agent.put(`/api/sessions/${body.routine.sessions[0].id}/done`).send({ done: true }).expect(404);
  });

  it('validates input', async () => {
    const res = await agent.post('/api/routines').send({ name: '', frequency: 'days', daysOfWeek: [], sessions: [] }).expect(400);
    expect(res.body.error).toMatch(/name/i);
  });
});

describe('reminders', () => {
  it('sends the daily summary and per-session nudges once', async () => {
    await agent.post('/api/routines').send(faceCare).expect(201);
    await agent.post('/api/routines').send({ name: 'Walk 7 km', icon: '🚶', frequency: 'daily', sessions: [{ steps: [] }] }).expect(201);
    await agent.patch('/api/me').send({ reminderTime: '07:00' }).expect(200);
    db.prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (1, 'https://push.example/1', 'k', 'a')").run();

    const sent: { title: string; body: string }[] = [];
    const send = async (_db: DB, _user: number, p: { title: string; body: string }) => (sent.push(p), 1);
    const date = localNow('UTC').date;

    await runReminderTick(db, new Date(`${date}T06:59:00Z`), send);
    expect(sent).toHaveLength(0);

    await runReminderTick(db, new Date(`${date}T07:45:00Z`), send);
    expect(sent.map((s) => s.title)).toEqual(['2 routines pending today', '🧴 Time for Face care · Morning']);
    expect(sent[1].body).toBe('Cleanser → Vitamin C serum → Sunscreen');

    await runReminderTick(db, new Date(`${date}T07:50:00Z`), send);
    expect(sent).toHaveLength(2);
  });
});
