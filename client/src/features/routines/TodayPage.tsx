import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, formatDay, formatLongDate, greeting } from '../../lib/dates';
import { enablePush, pushState, type PushState } from '../../lib/push';
import { RoutineCard } from './RoutineCard';
import type { DayResponse, DaySession } from './types';

export function TodayPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>();
  const [day, setDay] = useState<DayResponse>();
  const [error, setError] = useState('');
  const [push, setPush] = useState<PushState>();
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try {
      setDay(await api<DayResponse>(`/today${date ? `?date=${date}` : ''}`));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [date]);

  useEffect(() => {
    void load();
    const refresh = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [load]);

  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  // Surface the pending count on the tab title and (installed) app icon.
  useEffect(() => {
    if (!day || day.date !== day.today) return;
    const n = day.summary.pending;
    document.title = n ? `(${n}) Seicore` : 'Seicore';
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
    return () => {
      document.title = 'Seicore';
    };
  }, [day]);

  const patchSession = (sessionId: number, fn: (s: DaySession) => DaySession) =>
    setDay((d) =>
      d && {
        ...d,
        routines: d.routines.map((r) => ({ ...r, sessions: r.sessions.map((s) => (s.id === sessionId ? fn(s) : s)) })),
      },
    );

  const run = async (optimistic: () => void, request: Promise<unknown>) => {
    optimistic();
    try {
      await request;
    } catch (err) {
      setError((err as Error).message);
    }
    void load();
  };

  const onSession = (s: DaySession, done: boolean) =>
    run(
      () => patchSession(s.id, (x) => ({ ...x, done, checkedStepIds: done ? x.steps.map((st) => st.id) : [] })),
      api(`/sessions/${s.id}/done`, { method: 'PUT', body: { date: day!.date, done } }),
    );

  const onStep = (s: DaySession, stepId: number, checked: boolean) =>
    run(
      () =>
        patchSession(s.id, (x) => {
          const ids = checked ? [...x.checkedStepIds, stepId] : x.checkedStepIds.filter((id) => id !== stepId);
          return { ...x, checkedStepIds: ids, done: ids.length === x.steps.length };
        }),
      api(`/steps/${stepId}/checked`, { method: 'PUT', body: { date: day!.date, checked } }),
    );

  if (!day) return <div className="page">{error ? <div className="alert error">{error}</div> : <div className="skeleton" />}</div>;

  const isToday = day.date === day.today;
  const open = day.routines.filter((r) => r.pending);
  const finished = day.routines.filter((r) => !r.pending);
  const { sessions, sessionsDone } = day.summary;
  const pct = sessions ? Math.round((sessionsDone / sessions) * 100) : 0;

  return (
    <div className="page">
      <header className="today-head">
        <div>
          <p className="eyebrow">{formatLongDate(day.date)}</p>
          <h1>{isToday ? `${greeting()}, ${user!.name.split(' ')[0]}` : formatDay(day.date, day.today)}</h1>
          <p className="muted">
            {day.routines.length === 0
              ? 'Nothing scheduled.'
              : open.length === 0
                ? 'Everything is done. Nice work! 🎉'
                : `${open.length} ${open.length === 1 ? 'routine' : 'routines'} still pending.`}
          </p>
        </div>
        {sessions > 0 && <ProgressRing pct={pct} label={`${sessionsDone}/${sessions}`} />}
      </header>

      <div className="day-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(day.date, -1))} aria-label="Previous day">
          <Icon name="chevronLeft" />
        </button>
        <span>{formatDay(day.date, day.today)}</span>
        <button className="icon-btn" onClick={() => setDate(addDays(day.date, 1))} disabled={isToday} aria-label="Next day">
          <Icon name="chevronRight" />
        </button>
        {!isToday && (
          <button className="btn ghost small" onClick={() => setDate(undefined)}>
            Back to today
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {push === 'off' && day.routines.length > 0 && (
        <div className="banner">
          <Icon name="bell" />
          <div>
            <strong>Get reminded</strong>
            <p>Receive a daily summary at {user!.reminderTime} and a nudge at each routine’s time.</p>
          </div>
          <button className="btn primary small" onClick={async () => setPush(await enablePush().catch(() => 'off' as const))}>
            Turn on
          </button>
        </div>
      )}

      {day.routines.length === 0 ? (
        <div className="empty">
          <div className="empty-art">🌱</div>
          <h2>No routines yet</h2>
          <p className="muted">Create your first routine — a daily walk, a skincare ritual, anything you want to keep up with.</p>
          <Link to="/routines/new" className="btn primary">
            <Icon name="plus" /> New routine
          </Link>
        </div>
      ) : (
        <>
          <section className="card-list">
            {open.map((item) => (
              <RoutineCard key={item.routine.id} item={item} onSession={onSession} onStep={onStep} />
            ))}
          </section>

          {finished.length > 0 && (
            <section className="done-section">
              <button className="section-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone || open.length === 0}>
                <span className={`chev ${showDone || open.length === 0 ? 'open' : ''}`}><Icon name="chevronDown" size={16} /></span>
                Completed · {finished.length}
              </button>
              {(showDone || open.length === 0) && (
                <div className="card-list">
                  {finished.map((item) => (
                    <RoutineCard key={item.routine.id} item={item} onSession={onSession} onStep={onStep} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${pct}% complete`}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} className="ring-track" />
        <circle cx="38" cy="38" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span>{label}</span>
    </div>
  );
}
