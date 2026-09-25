import { useEffect, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebase, configurationError } from './firebase';
import { Brand } from './planner/ui';
import { WeekPlanner } from './planner/WeekPlanner';
import { AccountPage } from './AccountPage';
import { PrivacyPage } from './PrivacyPage';
import { SupportPage } from './SupportPage';
import { clearNativeReminders } from './planner/notifications';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!firebase);
  const [error, setError] = useState('');
  const [page, setPage] = useState(
    location.pathname === '/privacy'
      ? 'privacy'
      : location.pathname === '/delete-account'
        ? 'account'
        : location.pathname === '/support'
          ? 'support'
          : 'planner',
  );
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!firebase) return;
    let previousUid = firebase.auth.currentUser?.uid;
    return onAuthStateChanged(
      firebase.auth,
      (current) => {
        if (!current || current.uid !== previousUid) void clearNativeReminders().catch(() => {});
        previousUid = current?.uid;
        setUser(current);
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
    );
  }, []);
  useEffect(() => {
    setDeleting(false);
    if (!firebase || !user) return;
    return onSnapshot(
      doc(firebase.db, 'accountDeletions', user.uid),
      (snapshot) => {
        setDeleting(snapshot.exists());
        if (snapshot.exists()) void clearNativeReminders().catch(() => {});
      },
      () => setError('Account status could not be checked. Please reconnect and reload.'),
    );
  }, [user]);
  if (page === 'privacy')
    return <PrivacyPage onBack={() => setPage('planner')} onDelete={() => setPage('account')} />;
  if (configurationError || error)
    return (
      <main className="auth-shell">
        <Brand />
        <p role="alert">{configurationError || error}</p>
      </main>
    );
  if (page === 'support')
    return (
      <SupportPage
        onBack={() => setPage('planner')}
        onPrivacy={() => setPage('privacy')}
        onDelete={() => setPage('account')}
      />
    );
  if (loading)
    return (
      <main className="auth-shell">
        <Brand />
        <p role="status">Opening your planner...</p>
      </main>
    );
  if (firebase && !user)
    return (
      <Auth
        onPrivacy={() => setPage('privacy')}
        onSupport={() => setPage('support')}
        deleting={page === 'account'}
      />
    );
  if (user && (page === 'account' || deleting))
    return (
      <AccountPage
        key={user.uid}
        user={user}
        locked={deleting}
        onBack={() => setPage('planner')}
        onPrivacy={() => setPage('privacy')}
        onSupport={() => setPage('support')}
      />
    );
  return (
    <WeekPlanner
      key={user?.uid ?? 'preview'}
      user={user}
      onAccount={() => setPage('account')}
      onPrivacy={() => setPage('privacy')}
    />
  );
}
function Auth({
  onPrivacy,
  onSupport,
  deleting,
}: {
  onPrivacy: () => void;
  onSupport: () => void;
  deleting: boolean;
}) {
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
        code === 'auth/invalid-credential' ||
          code === 'auth/user-not-found' ||
          code === 'auth/wrong-password'
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
        <p className="auth-subtitle">
          {deleting
            ? 'Sign in to delete your Weekdeck account and planner data.'
            : 'A little space for everything that matters.'}
        </p>
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
        <div className="account-links auth-privacy">
          <button className="text-button" onClick={onPrivacy}>
            Privacy
          </button>
          <button className="text-button" onClick={onSupport}>
            Support
          </button>
        </div>
      </section>
    </main>
  );
}
