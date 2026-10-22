import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { describeSchedule } from './format';
import type { Routine } from './types';

export function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>();
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    api<{ routines: Routine[] }>(`/routines${showArchived ? '?archived=1' : ''}`)
      .then((r) => setRoutines(r.routines))
      .catch((e) => setError(e.message));

  useEffect(() => {
    void load();
  }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = async (index: number, delta: number) => {
    if (!routines) return;
    const active = routines.filter((r) => !r.archived);
    const target = index + delta;
    if (target < 0 || target >= active.length) return;
    const next = [...active];
    [next[index], next[target]] = [next[target], next[index]];
    setRoutines([...next, ...routines.filter((r) => r.archived)]);
    await api('/routines/reorder', { body: { ids: next.map((r) => r.id) } }).catch((e) => setError(e.message));
  };

  const active = routines?.filter((r) => !r.archived) ?? [];
  const archived = routines?.filter((r) => r.archived) ?? [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Routines</h1>
          <p className="muted">Define what you want to keep doing, and how often.</p>
        </div>
        <Link to="/routines/new" className="btn primary">
          <Icon name="plus" /> New
        </Link>
      </header>

      {error && <div className="alert error">{error}</div>}
      {!routines ? (
        <div className="skeleton" />
      ) : active.length === 0 ? (
        <div className="empty">
          <div className="empty-art">🗓️</div>
          <h2>No routines yet</h2>
          <p className="muted">Start from scratch or from a template.</p>
          <Link to="/routines/new" className="btn primary">
            <Icon name="plus" /> New routine
          </Link>
        </div>
      ) : (
        <ul className="routine-list">
          {active.map((r, i) => (
            <RoutineRow key={r.id} routine={r} onUp={i > 0 ? () => move(i, -1) : undefined} onDown={i < active.length - 1 ? () => move(i, 1) : undefined} />
          ))}
        </ul>
      )}

      <button className="link-btn" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? 'Hide archived' : 'Show archived'}
      </button>
      {showArchived && (archived.length ? <ul className="routine-list archived">{archived.map((r) => <RoutineRow key={r.id} routine={r} />)}</ul> : <p className="muted">No archived routines.</p>)}
    </div>
  );
}

function RoutineRow({ routine: r, onUp, onDown }: { routine: Routine; onUp?: () => void; onDown?: () => void }) {
  const stepCount = r.sessions.reduce((n, s) => n + s.steps.length, 0);
  const times = r.sessions.map((s) => s.time).filter(Boolean);
  return (
    <li className="routine-row" style={{ '--routine-color': r.color } as React.CSSProperties}>
      <Link to={`/routines/${r.id}`} className="routine-row-main">
        <span className="routine-icon" aria-hidden="true">{r.icon}</span>
        <div>
          <strong>{r.name}</strong>
          <div className="routine-meta">
            <span>{describeSchedule(r)}</span>
            {r.sessions.length > 1 && <span>{r.sessions.map((s) => s.label || 'Session').join(' & ')}</span>}
            {stepCount > 0 && <span>{stepCount} steps</span>}
            {times.length > 0 && <span>⏰ {times.join(', ')}</span>}
          </div>
        </div>
      </Link>
      {(onUp || onDown) && (
        <div className="reorder">
          <button className="icon-btn small" onClick={onUp} disabled={!onUp} aria-label="Move up"><Icon name="up" size={16} /></button>
          <button className="icon-btn small" onClick={onDown} disabled={!onDown} aria-label="Move down"><Icon name="down" size={16} /></button>
        </div>
      )}
    </li>
  );
}
