import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { useAuth, type User } from '../lib/auth';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

export function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const [push, setPush] = useState<PushState>();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [name, setName] = useState(user!.name);

  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  const flash = (kind: 'ok' | 'error', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(undefined), 4000);
  };

  const update = async (patch: Partial<User>) => {
    try {
      const { user } = await api<{ user: User }>('/me', { method: 'PATCH', body: patch });
      setUser(user);
      flash('ok', 'Saved');
    } catch (err) {
      flash('error', (err as Error).message);
    }
  };

  const togglePush = async () => {
    try {
      setPush(push === 'on' ? await disablePush() : await enablePush());
    } catch (err) {
      flash('error', (err as Error).message);
    }
  };

  const test = async () => {
    try {
      await api('/push/test', { method: 'POST' });
      flash('ok', 'Test notification sent');
    } catch (err) {
      flash('error', (err as Error).message);
    }
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      {msg && <div className={`toast ${msg.kind}`} role="status">{msg.text}</div>}

      <section className="panel stack">
        <h2 className="panel-title"><Icon name="bell" size={18} /> Reminders</h2>
        <label className="toggle-row">
          <div>
            <strong>Daily reminders</strong>
            <p className="muted small">A summary of what’s pending, plus a nudge at each session’s time.</p>
          </div>
          <input type="checkbox" className="switch" checked={user!.remindersEnabled} onChange={(e) => update({ remindersEnabled: e.target.checked })} />
        </label>
        <label className="toggle-row">
          <div>
            <strong>Daily summary time</strong>
            <p className="muted small">When to send the “what’s pending today” notification.</p>
          </div>
          <input type="time" value={user!.reminderTime} onChange={(e) => e.target.value && update({ reminderTime: e.target.value })} disabled={!user!.remindersEnabled} />
        </label>
        <div className="toggle-row">
          <div>
            <strong>Notifications on this device</strong>
            <p className="muted small">
              {push === 'unsupported'
                ? isIOS && !isStandalone
                  ? 'On iPhone/iPad, first add Seicore to your Home Screen (Share → Add to Home Screen), then open it from there.'
                  : 'This browser doesn’t support push notifications.'
                : push === 'denied'
                  ? 'Notifications are blocked. Allow them for this site in your browser settings.'
                  : push === 'on'
                    ? 'This device will receive reminders.'
                    : 'Turn on to receive reminders here. Enable on each device you use.'}
            </p>
          </div>
          {(push === 'on' || push === 'off') && (
            <button className={`btn small ${push === 'on' ? 'secondary' : 'primary'}`} onClick={togglePush}>
              {push === 'on' ? 'Turn off' : 'Turn on'}
            </button>
          )}
        </div>
        {push === 'on' && (
          <button className="btn ghost small align-start" onClick={test}>Send a test notification</button>
        )}
      </section>

      <section className="panel stack">
        <h2 className="panel-title">Profile</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void update({ name });
          }}
        >
          <label className="field grow">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </label>
          <button className="btn secondary" disabled={name === user!.name}>Save</button>
        </form>
        <div className="field">
          <span>Email</span>
          <p>{user!.email}</p>
        </div>
        <div className="field">
          <span>Timezone</span>
          <p>{user!.timezone} <small className="muted">· follows this device</small></p>
        </div>
      </section>

      <PasswordForm onDone={(ok, text) => flash(ok ? 'ok' : 'error', text)} />

      <button className="btn ghost align-start" onClick={logout}>
        <Icon name="logout" size={16} /> Sign out
      </button>
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: (ok: boolean, text: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/me/password', { body: { currentPassword: current, newPassword: next } });
      setCurrent('');
      setNext('');
      onDone(true, 'Password changed');
    } catch (err) {
      onDone(false, (err as Error).message);
    }
  };
  return (
    <section className="panel">
      <h2 className="panel-title">Change password</h2>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Current password</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
        </label>
        <button className="btn secondary align-start" disabled={!current || next.length < 8}>Update password</button>
      </form>
    </section>
  );
}
