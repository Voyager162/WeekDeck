import { useState } from 'react';
import { sendEmailVerification, type User } from 'firebase/auth';
import { Share2, UserRound, Trash2 } from 'lucide-react';
import { IconButton, Modal } from './ui';
import { inviteSchedule, removeShare, respondToShare, type useSharing } from './sharing';
import type { Preferences } from './model';

export function Sharing({
  user,
  sharing,
  week,
  preferences,
  selected,
  allowInvitations,
  ready,
  onSelect,
}: {
  user: User | null;
  sharing: ReturnType<typeof useSharing>;
  week: string;
  preferences: Preferences;
  selected: string | null;
  allowInvitations: boolean;
  ready: boolean;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState<'week' | 'all'>('week');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const invitation =
    !open && allowInvitations && sharing.incoming.find((s) => s.status === 'pending');
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sharing could not be updated.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <IconButton
        label="Share schedule"
        disabled={!ready}
        onClick={() => {
          setOpen(true);
          setError('');
          setNotice('');
        }}
      >
        <Share2 size={21} />
      </IconButton>
      <div className="shared-shortcuts" aria-label="Shared schedules">
        {sharing.incoming
          .filter((s) => s.status === 'accepted')
          .map((share) => (
            <IconButton
              key={share.id}
              label={`Schedule from ${share.ownerEmail}`}
              className={selected === share.id ? 'rail-active' : ''}
              aria-pressed={selected === share.id}
              onClick={() => onSelect(share.id)}
            >
              <UserRound size={20} />
              <span className="shared-initial">{share.ownerEmail[0].toUpperCase()}</span>
            </IconButton>
          ))}
      </div>
      {open && (
        <Modal title="Share schedule" onClose={() => setOpen(false)} busy={busy}>
          {!user ? (
            <div className="sharing-body">
              <p>Sign in to share your schedule.</p>
              <a
                className="primary"
                href="https://weekdeck-67e4b.web.app"
                target="_blank"
                rel="noreferrer"
              >
                Open Weekdeck online
              </a>
            </div>
          ) : !sharing.verified ? (
            <div className="sharing-body">
              <p>Verify {user.email} to send and receive schedule invitations.</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await sendEmailVerification(user);
                    setNotice('Verification email sent. Check your inbox.');
                  })
                }
              >
                Send verification email
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await user.reload();
                    await user.getIdToken(true);
                    if (!user.emailVerified) setNotice('Your email is not verified yet.');
                  })
                }
              >
                I have verified my email
              </button>
            </div>
          ) : (
            <>
              <form
                className="sharing-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await inviteSchedule(user, email, scope, week, preferences);
                    setEmail('');
                    setNotice('Invitation sent.');
                  });
                }}
              >
                <label>
                  Recipient email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Access
                  <select
                    aria-label="Access"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'week' | 'all')}
                  >
                    <option value="week">This week only</option>
                    <option value="all">All weeks</option>
                  </select>
                </label>
                <p className="sharing-detail">
                  {scope === 'week' ? `Week of ${week}.` : 'Past and future weeks.'} Read-only
                  access to blocks, notes, and day hours. Updates appear live.
                </p>
                <button className="primary" disabled={busy} type="submit">
                  <Share2 size={16} />
                  Send invitation
                </button>
              </form>
              {!!sharing.outgoing.length && (
                <section className="sharing-list">
                  <h3>Shared by you</h3>
                  {sharing.outgoing.map((s) => (
                    <div className="sharing-row" key={s.id}>
                      <div>
                        <strong>{s.recipientEmail}</strong>
                        <small>
                          {s.scope === 'all' ? 'All weeks' : `Week of ${s.week}`} · {s.status}
                        </small>
                      </div>
                      <IconButton
                        label={`Stop sharing with ${s.recipientEmail}`}
                        disabled={busy}
                        onClick={() => void run(() => removeShare(s))}
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    </div>
                  ))}
                </section>
              )}
              {!!sharing.incoming.filter((s) => s.status === 'accepted').length && (
                <section className="sharing-list">
                  <h3>Shared with you</h3>
                  {sharing.incoming
                    .filter((s) => s.status === 'accepted')
                    .map((s) => (
                      <div className="sharing-row" key={s.id}>
                        <div>
                          <strong>{s.ownerEmail}</strong>
                          <small>{s.scope === 'all' ? 'All weeks' : `Week of ${s.week}`}</small>
                        </div>
                        <IconButton
                          label={`Remove schedule from ${s.ownerEmail}`}
                          disabled={busy}
                          onClick={() => void run(() => removeShare(s))}
                        >
                          <Trash2 size={17} />
                        </IconButton>
                      </div>
                    ))}
                </section>
              )}
            </>
          )}
          {(error || sharing.error) && (
            <p className="sharing-message" role="alert">
              {error || sharing.error}
            </p>
          )}
          {notice && (
            <p className="sharing-message" role="status">
              {notice}
            </p>
          )}
        </Modal>
      )}
      {invitation && user && (
        <Modal
          title="Schedule invitation"
          busy={busy}
          onClose={() => void run(() => respondToShare(invitation, user, false))}
        >
          <div className="sharing-body">
            <p>
              <strong>{invitation.ownerEmail}</strong> is sharing their schedule with you.
            </p>
            <p>
              {invitation.scope === 'all' ? 'All weeks' : `Week of ${invitation.week}`} · Read only
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="sharing-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void run(() => respondToShare(invitation, user, false))}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await respondToShare(invitation, user, true);
                    onSelect(invitation.id);
                  })
                }
              >
                Accept
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
