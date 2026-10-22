import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth, type User } from '../lib/auth';
import { browserTimezone } from '../lib/dates';

export function LoginPage() {
  const { setUser } = useAuth();
  const [status, setStatus] = useState<{ needsSetup: boolean; signupOpen: boolean }>();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean; signupOpen: boolean }>('/auth/status').then((s) => {
      setStatus(s);
      if (s.needsSetup) setMode('signup');
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = mode === 'signup' ? { ...form, timezone: browserTimezone() } : { email: form.email, password: form.password };
      const { user } = await api<{ user: User }>(`/auth/${mode}`, { body });
      setUser(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
  });

  const signup = mode === 'signup';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/icon.svg" alt="" width={48} height={48} />
        <h1>{status?.needsSetup ? 'Welcome to Seicore' : signup ? 'Create account' : 'Welcome back'}</h1>
        <p className="muted">
          {status?.needsSetup ? 'Create your account to get started. This becomes the owner account.' : signup ? 'Set up a new account.' : 'Sign in to see what’s on today.'}
        </p>
        <form onSubmit={submit} className="stack">
          {signup && (
            <label className="field">
              <span>Name</span>
              <input autoComplete="name" required {...field('name')} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required autoFocus {...field('email')} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} {...field('password')} />
            {signup && <small className="muted">At least 8 characters.</small>}
          </label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="btn primary block" disabled={busy || !status}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {status && !status.needsSetup && status.signupOpen && (
          <button className="link-btn" onClick={() => setMode(signup ? 'login' : 'signup')}>
            {signup ? 'Have an account? Sign in' : 'New here? Create an account'}
          </button>
        )}
      </div>
    </div>
  );
}
