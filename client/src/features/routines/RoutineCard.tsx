import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { describeSchedule, periodWord } from './format';
import type { DayRoutine, DaySession } from './types';

interface Props {
  item: DayRoutine;
  onSession: (session: DaySession, done: boolean) => void;
  onStep: (session: DaySession, stepId: number, checked: boolean) => void;
}

export function RoutineCard({ item, onSession, onStep }: Props) {
  const { routine, sessions } = item;
  const flexible = routine.frequency === 'weekly' || routine.frequency === 'monthly';
  const simple = sessions.length === 1 && !sessions[0].label && sessions[0].steps.length === 0;

  return (
    <article className={`routine-card ${item.done ? 'is-done' : ''}`} style={{ '--routine-color': routine.color } as React.CSSProperties}>
      <header className="routine-card-head">
        <span className="routine-icon" aria-hidden="true">{routine.icon}</span>
        <div className="routine-card-title">
          <Link to={`/routines/${routine.id}`} className="routine-name">{routine.name}</Link>
          <div className="routine-meta">
            <span>{describeSchedule(routine)}</span>
            {flexible && (
              <span className="pill">
                {Math.min(...sessions.map((s) => s.periodCount))}/{item.target} {periodWord(routine)}
              </span>
            )}
            {item.streak > 0 && (
              <span className="streak" title="Current streak">
                <Icon name="flame" size={14} /> {item.streak}
              </span>
            )}
          </div>
        </div>
        {simple && <CheckButton done={sessions[0].done} label={routine.name} onClick={() => onSession(sessions[0], !sessions[0].done)} large />}
      </header>

      {!simple && (
        <div className="sessions">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} fallbackLabel={routine.name} onSession={onSession} onStep={onStep} />
          ))}
        </div>
      )}
    </article>
  );
}

function SessionRow({ session, fallbackLabel, onSession, onStep }: { session: DaySession; fallbackLabel: string } & Omit<Props, 'item'>) {
  const [open, setOpen] = useState(!session.done);
  const label = session.label || fallbackLabel;
  const checked = session.checkedStepIds.length;

  return (
    <div className={`session ${session.done ? 'is-done' : ''}`}>
      <div className="session-head">
        <CheckButton done={session.done} label={label} onClick={() => onSession(session, !session.done)} />
        <button className="session-title" onClick={() => setOpen(!open)} disabled={!session.steps.length} aria-expanded={open}>
          <span className="session-label">{label}</span>
          {session.time && (
            <span className="session-time">
              <Icon name="clock" size={13} /> {session.time}
            </span>
          )}
          {session.steps.length > 0 && (
            <>
              <span className="session-progress">{checked}/{session.steps.length}</span>
              <span className={`chev ${open ? 'open' : ''}`}><Icon name="chevronDown" size={16} /></span>
            </>
          )}
        </button>
      </div>
      {open && session.steps.length > 0 && (
        <ul className="steps">
          {session.steps.map((st) => {
            const on = session.checkedStepIds.includes(st.id);
            return (
              <li key={st.id}>
                <label className={`step ${on ? 'is-checked' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => onStep(session, st.id, !on)} />
                  <span className="step-box"><Icon name="check" size={13} /></span>
                  <span>{st.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CheckButton({ done, label, onClick, large }: { done: boolean; label: string; onClick: () => void; large?: boolean }) {
  return (
    <button
      className={`check-btn ${done ? 'on' : ''} ${large ? 'large' : ''}`}
      onClick={onClick}
      aria-pressed={done}
      aria-label={done ? `Mark ${label} as not done` : `Mark ${label} as done`}
    >
      <Icon name="check" size={large ? 22 : 16} />
    </button>
  );
}
