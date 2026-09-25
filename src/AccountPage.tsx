import { useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { ArrowLeft, LogOut, Trash2 } from 'lucide-react';
import { deleteAccount } from './account';
import { firebase } from './firebase';
import { Brand, IconButton } from './planner/ui';

export function AccountPage({
  user,
  locked,
  onBack,
  onPrivacy,
  onSupport,
}: {
  user: User;
  locked: boolean;
  onBack: () => void;
  onPrivacy: () => void;
  onSupport: () => void;
}) {
  const [confirm, setConfirm] = useState(locked);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const deleting = locked || started;
  return (
    <main className="account-page">
      <header>
        <Brand />
        {!deleting && (
          <IconButton label="Back to planner" onClick={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
        )}
      </header>
      <section>
        <h1>{deleting ? 'Finish deleting your account' : 'Account'}</h1>
        <p className="account-email">{user.email}</p>
        <div className="account-links">
          <button className="text-button" disabled={busy} onClick={onPrivacy}>
            Privacy
          </button>
          <button className="text-button" disabled={busy} onClick={onSupport}>
            Support
          </button>
        </div>
        <div className="account-danger">
          <h2>Delete account</h2>
          <p>
            Your account, blocks, presets, and settings will be permanently deleted across all
            weeks. This cannot be undone.
          </p>
          <p>
            A minimal security record prevents other signed-in devices from recreating deleted data.
            It contains no email or planning content.
          </p>
          {deleting && (
            <p>
              Deletion has started. Sign in here again to retry if your connection is interrupted.
            </p>
          )}
          {confirm || deleting ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await deleteAccount(user, password, () => setStarted(true));
                } catch (error) {
                  const code = (error as { code?: string }).code;
                  setError(
                    code === 'auth/invalid-credential' || code === 'auth/wrong-password'
                      ? 'The password is incorrect.'
                      : 'Deletion did not finish. Check your connection and try again.',
                  );
                  setBusy(false);
                }
              }}
            >
              <label>
                Confirm your password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="account-actions">
                {!deleting && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setConfirm(false);
                      setPassword('');
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button className="danger" disabled={busy}>
                  <Trash2 size={17} />
                  {busy
                    ? 'Deleting...'
                    : deleting
                      ? 'Finish deletion'
                      : 'Permanently delete account'}
                </button>
              </div>
            </form>
          ) : (
            <button className="danger" onClick={() => setConfirm(true)}>
              <Trash2 size={17} />
              Delete account
            </button>
          )}
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void signOut(firebase!.auth).catch(() => setError('Could not sign out.'))}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </section>
    </main>
  );
}
