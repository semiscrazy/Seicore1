import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { WEEKDAYS } from '../../lib/dates';
import { blankDraft, key, templates } from './templates';
import type { Frequency, Routine, RoutineDraft } from './types';

const ICONS = ['✅', '🚶', '🏃', '🧴', '💧', '🧘', '🏋️', '📚', '🦷', '💊', '🥗', '😴', '🧹', '🗂️', '✍️', '🎸', '🌱', '💰'];
const COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed', '#475569'];
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'days', label: 'Specific days' },
  { value: 'weekly', label: 'Per week' },
  { value: 'monthly', label: 'Per month' },
];

function toDraft(r: Routine): RoutineDraft {
  return {
    name: r.name,
    description: r.description,
    icon: r.icon,
    color: r.color,
    frequency: r.frequency,
    daysOfWeek: r.daysOfWeek.length ? r.daysOfWeek : [1, 2, 3, 4, 5],
    timesPerPeriod: r.timesPerPeriod,
    startDate: r.startDate,
    sessions: r.sessions.map((s) => ({ id: s.id, key: key(), label: s.label, time: s.time ?? '', steps: s.steps.map((st) => ({ id: st.id, key: key(), label: st.label })) })),
  };
}

function toPayload(d: RoutineDraft) {
  return {
    ...d,
    daysOfWeek: d.frequency === 'days' ? d.daysOfWeek : [],
    timesPerPeriod: d.frequency === 'weekly' || d.frequency === 'monthly' ? d.timesPerPeriod : 1,
    sessions: d.sessions.map((s) => ({
      id: s.id,
      label: s.label.trim(),
      time: s.time || null,
      steps: s.steps.filter((st) => st.label.trim()).map((st) => ({ id: st.id, label: st.label.trim() })),
    })),
  };
}

export function RoutineEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<RoutineDraft | undefined>(id ? undefined : blankDraft());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) api<{ routine: Routine }>(`/routines/${id}`).then((r) => setDraft(toDraft(r.routine)), (e) => setError(e.message));
  }, [id]);

  if (!draft) return <div className="page">{error ? <div className="alert error">{error}</div> : <div className="skeleton" />}</div>;

  const set = (patch: Partial<RoutineDraft>) => setDraft({ ...draft, ...patch });
  type DraftSession = RoutineDraft['sessions'][number];
  const setSession = (i: number, patch: Partial<DraftSession>) => set({ sessions: draft.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveItem = <T,>(list: T[], i: number, delta: number) => {
    const next = [...list];
    const j = i + delta;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { routine } = await api<{ routine: Routine }>(id ? `/routines/${id}` : '/routines', { method: id ? 'PUT' : 'POST', body: toPayload(draft) });
      navigate(`/routines/${routine.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const flexible = draft.frequency === 'weekly' || draft.frequency === 'monthly';

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <Link to={id ? `/routines/${id}` : '/routines'} className="back-link">
            <Icon name="chevronLeft" size={16} /> {id ? 'Back to routine' : 'Routines'}
          </Link>
          <h1>{id ? 'Edit routine' : 'New routine'}</h1>
        </div>
      </header>

      {!id && (
        <div className="templates">
          <span className="muted small">Start from a template:</span>
          {templates.map((t) => (
            <button key={t.title} type="button" className="chip" onClick={() => setDraft(t.draft())}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="stack">
        <section className="panel stack">
          <div className="name-row">
            <details className="icon-picker">
              <summary className="routine-icon big" style={{ '--routine-color': draft.color } as React.CSSProperties} aria-label="Choose icon">
                {draft.icon}
              </summary>
              <div className="icon-grid">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" className={ic === draft.icon ? 'on' : ''} onClick={(e) => { set({ icon: ic }); (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; }}>
                    {ic}
                  </button>
                ))}
                <input aria-label="Custom emoji" placeholder="Other…" maxLength={4} onChange={(e) => e.target.value && set({ icon: e.target.value })} />
              </div>
            </details>
            <label className="field grow">
              <span>Name</span>
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Walk 7 km" required maxLength={100} autoFocus={!id} />
            </label>
          </div>
          <label className="field">
            <span>Notes <small className="muted">(optional)</small></span>
            <textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Why it matters, how to do it…" maxLength={1000} />
          </label>
          <div className="field">
            <span>Color</span>
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`swatch ${c === draft.color ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
        </section>

        <section className="panel stack">
          <h2 className="panel-title">How often</h2>
          <div className="segmented" role="radiogroup">
            {FREQUENCIES.map((f) => (
              <button key={f.value} type="button" role="radio" aria-checked={draft.frequency === f.value} className={draft.frequency === f.value ? 'on' : ''} onClick={() => set({ frequency: f.value })}>
                {f.label}
              </button>
            ))}
          </div>
          {draft.frequency === 'days' && (
            <div className="day-chips">
              {WEEKDAYS.map((w) => {
                const on = draft.daysOfWeek.includes(w.day);
                return (
                  <button key={w.day} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ daysOfWeek: on ? draft.daysOfWeek.filter((d) => d !== w.day) : [...draft.daysOfWeek, w.day] })}>
                    {w.short}
                  </button>
                );
              })}
            </div>
          )}
          {flexible && (
            <div className="stepper-row">
              <div className="stepper">
                <button type="button" className="icon-btn small" onClick={() => set({ timesPerPeriod: Math.max(1, draft.timesPerPeriod - 1) })} aria-label="Fewer">−</button>
                <strong>{draft.timesPerPeriod}</strong>
                <button type="button" className="icon-btn small" onClick={() => set({ timesPerPeriod: Math.min(draft.frequency === 'weekly' ? 7 : 31, draft.timesPerPeriod + 1) })} aria-label="More">+</button>
              </div>
              <span className="muted">times {draft.frequency === 'weekly' ? 'a week' : 'a month'}, on any day</span>
            </div>
          )}
        </section>

        <section className="panel stack">
          <div>
            <h2 className="panel-title">Sessions & steps</h2>
            <p className="muted small">
              Split a routine into sessions when it happens more than once a day (e.g. Morning and Evening), and list steps to check off one by one. Add a time to get a reminder.
            </p>
          </div>
          {draft.sessions.map((s, i) => (
            <div key={s.key} className="session-editor">
              <div className="session-editor-head">
                <label className="field grow">
                  <span>Session name {draft.sessions.length === 1 && <small className="muted">(optional)</small>}</span>
                  <input value={s.label} onChange={(e) => setSession(i, { label: e.target.value })} placeholder={draft.sessions.length > 1 ? (i === 0 ? 'Morning' : 'Evening') : 'e.g. Morning'} maxLength={60} required={draft.sessions.length > 1} />
                </label>
                <label className="field">
                  <span>Remind at</span>
                  <input type="time" value={s.time} onChange={(e) => setSession(i, { time: e.target.value })} />
                </label>
                {draft.sessions.length > 1 && (
                  <div className="row-actions">
                    <button type="button" className="icon-btn small" onClick={() => set({ sessions: moveItem(draft.sessions, i, -1) })} disabled={i === 0} aria-label="Move session up"><Icon name="up" size={16} /></button>
                    <button type="button" className="icon-btn small" onClick={() => set({ sessions: draft.sessions.filter((_, j) => j !== i) })} aria-label="Remove session"><Icon name="x" size={16} /></button>
                  </div>
                )}
              </div>

              <ol className="step-editor">
                {s.steps.map((st, j) => (
                  <li key={st.key}>
                    <span className="step-num">{j + 1}</span>
                    <input
                      value={st.label}
                      placeholder="Step, e.g. Vitamin C serum"
                      maxLength={120}
                      onChange={(e) => setSession(i, { steps: s.steps.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setSession(i, { steps: [...s.steps.slice(0, j + 1), { key: key(), label: '' }, ...s.steps.slice(j + 1)] });
                          requestAnimationFrame(() => (e.currentTarget.closest('li')?.nextElementSibling?.querySelector('input') as HTMLInputElement | null)?.focus());
                        }
                      }}
                    />
                    <button type="button" className="icon-btn small" onClick={() => setSession(i, { steps: moveItem(s.steps, j, -1) })} disabled={j === 0} aria-label="Move step up"><Icon name="up" size={14} /></button>
                    <button type="button" className="icon-btn small" onClick={() => setSession(i, { steps: moveItem(s.steps, j, 1) })} disabled={j === s.steps.length - 1} aria-label="Move step down"><Icon name="down" size={14} /></button>
                    <button type="button" className="icon-btn small" onClick={() => setSession(i, { steps: s.steps.filter((_, k) => k !== j) })} aria-label="Remove step"><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn ghost small" onClick={() => setSession(i, { steps: [...s.steps, { key: key(), label: '' }] })}>
                <Icon name="plus" size={16} /> Add step
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              set({
                sessions: [
                  ...draft.sessions.map((s, i) => (i === 0 && !s.label ? { ...s, label: 'Morning' } : s)),
                  { key: key(), label: draft.sessions.length === 1 ? 'Evening' : '', time: '', steps: [] },
                ],
              })
            }
            disabled={draft.sessions.length >= 10}
          >
            <Icon name="plus" size={16} /> Add another session
          </button>
        </section>

        {error && <div className="alert error" role="alert">{error}</div>}
        <div className="form-actions">
          <Link to={id ? `/routines/${id}` : '/routines'} className="btn ghost">Cancel</Link>
          <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Create routine'}</button>
        </div>
      </form>
    </div>
  );
}
