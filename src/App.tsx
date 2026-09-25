import { useEffect, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { firebase, configurationError } from './firebase';
import { Brand } from './planner/ui';
import { WeekPlanner } from './planner/WeekPlanner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!firebase);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(
      firebase.auth,
      (current) => {
        setUser(current);
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
    );
  }, []);
  if (configurationError || error)
    return (
      <main className="auth-shell">
        <Brand />
        <p role="alert">{configurationError || error}</p>
      </main>
    );
  if (loading)
    return (
      <main className="auth-shell">
        <Brand />
        <p role="status">Opening your planner...</p>
      </main>
    );
  if (firebase && !user) return <Auth />;
  return <WeekPlanner key={user?.uid ?? 'preview'} user={user} />;
}
function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup')
        await createUserWithEmailAndPassword(firebase!.auth, email.trim(), password);
      else if (mode === 'signin')
        await signInWithEmailAndPassword(firebase!.auth, email.trim(), password);
      else {
        await sendPasswordResetEmail(firebase!.auth, email.trim());
        setNotice('If this email has an account, a reset link is on its way.');
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      setError(
        code === 'auth/invalid-credential'
          ? 'The email or password is incorrect.'
          : code === 'auth/email-already-in-use'
            ? 'An account already exists with this email.'
            : code === 'auth/too-many-requests'
              ? 'Too many attempts. Please try again later.'
              : error instanceof Error
                ? error.message
                : 'Unable to sign in.',
      );
    } finally {
      setBusy(false);
    }
  }
  function change(next: typeof mode) {
    setMode(next);
    setError('');
    setNotice('');
  }
  return (
    <main className="auth-shell">
      <Brand />
      <section className="auth-form">
        <h1>
          {mode === 'signup'
            ? 'Create your account'
            : mode === 'reset'
              ? 'Reset your password'
              : 'Welcome back'}
        </h1>
        <p className="auth-subtitle">A little space for everything that matters.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <button className="primary" disabled={busy}>
            {busy
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Send reset link'
                  : 'Sign in'}
          </button>
        </form>
        <div className="auth-links">
          <button
            className="text-button"
            disabled={busy}
            onClick={() => change(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
          </button>
          {mode === 'signin' && (
            <button className="text-button" disabled={busy} onClick={() => change('reset')}>
              Forgot password?
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
