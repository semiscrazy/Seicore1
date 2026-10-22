import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { parseISODate } from '../../lib/dates';
import { describeSchedule } from './format';
import type { HistoryResponse } from './types';

export function RoutineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<HistoryResponse>();
  const [error, setError] = useState('');

  const load = () => {
    api<HistoryResponse>(`/routines/${id}/history`).then(setData, (e) => setError(e.message));
  };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="page">{error ? <div className="alert error">{error}</div> : <div className="skeleton" />}</div>;
  const { routine, days, streak } = data;

  const archive = async () => {
    await api(`/routines/${id}/archive`, { body: { archived: !routine.archived } });
    load();
  };
  const remove = async () => {
    if (!confirm(`Delete “${routine.name}” and all of its history? This can’t be undone.`)) return;
    await api(`/routines/${id}`, { method: 'DELETE' });
    navigate('/routines', { replace: true });
  };

  const total = routine.sessions.length;
  const last30 = days.slice(-30);
  const fullDays = (list: typeof days) => list.filter((d) => total > 0 && d.completedSessionIds.length === total).length;
  const scheduled30 = last30.filter((d) => d.scheduled && d.date >= routine.startDate).length;
  const flexible = routine.frequency === 'weekly' || routine.frequency === 'monthly';
  const rate = !flexible && scheduled30 ? Math.round((fullDays(last30.filter((d) => d.scheduled)) / scheduled30) * 100) : undefined;

  return (
    <div className="page narrow">
      <Link to="/routines" className="back-link">
        <Icon name="chevronLeft" size={16} /> Routines
      </Link>
      <header className="detail-head" style={{ '--routine-color': routine.color } as React.CSSProperties}>
        <span className="routine-icon big" aria-hidden="true">{routine.icon}</span>
        <div className="grow">
          <h1>{routine.name}</h1>
          <p className="muted">
            {describeSchedule(routine)}
            {routine.archived && ' · Archived'}
          </p>
        </div>
        <Link to={`/routines/${id}/edit`} className="btn secondary">
          <Icon name="edit" size={16} /> Edit
        </Link>
      </header>

      {routine.description && <p className="description">{routine.description}</p>}

      <div className="stats">
        <Stat label="Current streak" value={streak} unit={flexible ? (routine.frequency === 'weekly' ? 'weeks' : 'months') : 'days'} />
        <Stat label="Done in last 30 days" value={fullDays(last30)} unit="days" />
        {rate !== undefined && <Stat label="30-day consistency" value={`${rate}%`} />}
      </div>

      <section className="panel">
        <h2 className="panel-title">Last {Math.round(days.length / 7)} weeks</h2>
        <Heatmap days={days} total={total} startDate={routine.startDate} color={routine.color} />
      </section>

      <section className="panel stack">
        <h2 className="panel-title">{total > 1 ? 'Sessions' : 'Details'}</h2>
        {routine.sessions.map((s) => (
          <div key={s.id} className="detail-session">
            <div className="detail-session-head">
              <strong>{s.label || routine.name}</strong>
              {s.time && <span className="muted"><Icon name="clock" size={13} /> {s.time}</span>}
            </div>
            {s.steps.length > 0 ? (
              <ol className="detail-steps">{s.steps.map((st) => <li key={st.id}>{st.label}</li>)}</ol>
            ) : (
              <p className="muted small">No steps — check it off in one tap.</p>
            )}
          </div>
        ))}
      </section>

      <div className="danger-zone">
        <button className="btn ghost" onClick={archive}>{routine.archived ? 'Restore routine' : 'Archive'}</button>
        <button className="btn danger-ghost" onClick={remove}>Delete</button>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}{unit && <small> {unit}</small>}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** GitHub-style calendar: columns are weeks (Mon–Sun), cell intensity is the share of sessions done. */
function Heatmap({ days, total, startDate, color }: { days: HistoryResponse['days']; total: number; startDate: string; color: string }) {
  const firstDow = (parseISODate(days[0].date).getDay() + 6) % 7;
  const cells = [...Array(firstDow).fill(null), ...days];
  const weeks: (HistoryResponse['days'][number] | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="heatmap-wrap">
      <div className="heatmap" style={{ '--routine-color': color } as React.CSSProperties}>
        {weeks.map((week, i) => (
          <div key={i} className="heatmap-col">
            {week.map((d, j) => {
              if (!d) return <span key={j} className="cell blank" />;
              const share = total ? d.completedSessionIds.length / total : 0;
              const inactive = d.date < startDate || !d.scheduled;
              return (
                <span
                  key={j}
                  className={`cell ${inactive ? 'inactive' : ''}`}
                  style={share ? { opacity: 0.35 + share * 0.65, background: color } : undefined}
                  title={`${parseISODate(d.date).toLocaleDateString()}: ${d.completedSessionIds.length}/${total}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-legend muted small">
        <span className="cell" /> missed <span className="cell" style={{ background: color, opacity: 0.6 }} /> partly <span className="cell" style={{ background: color }} /> done
      </div>
    </div>
  );
}
