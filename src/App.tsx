import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Cloud,
  CloudOff,
  Coffee,
  LayoutGrid,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { firebase, configurationError } from './firebase';
import { removeBlock, saveBlock, subscribeBlocks } from './blocks';
import {
  categories,
  dateKey,
  dayRange,
  durationLabel,
  localDateTime,
  shiftDate,
  validateBlock,
  type Block,
  type BlockInput,
  type Category,
} from './domain';

const previewKey = 'timeblocker.preview.v1';
function message(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Could not connect. Check your internet connection.',
    'auth/operation-not-allowed': 'Email/password sign-in needs to be enabled in Firebase.',
    'permission-denied': 'Access denied. Check that the Firestore rules have been deployed.',
  };
  return (
    (code && messages[code]) ||
    (error instanceof Error ? error.message : 'Something went wrong. Please try again.')
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <LayoutGrid size={20} />
      </span>
      <span>
        Weekdeck<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function IconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="icon-button" title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}

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
        setError(message(error));
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
  return <Planner key={user?.uid ?? 'preview'} user={user} />;
}

function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError('');
    setNotice('');
  }
  return (
    <main className="auth-shell">
      <Brand />
      <section className="auth-form">
        <span className="eyebrow">MAKE TIME FOR WHAT MATTERS</span>
        <h1>
          {mode === 'signup'
            ? 'Create your account'
            : mode === 'reset'
              ? 'Reset your password'
              : 'Welcome back'}
        </h1>
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
                minLength={mode === 'signup' ? 8 : undefined}
                required
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
        <div className="auth-actions">
          <button
            className="text-button"
            disabled={busy}
            onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
          </button>
          {mode === 'signin' && (
            <button className="text-button" disabled={busy} onClick={() => changeMode('reset')}>
              Forgot password?
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function loadPreview(): Block[] {
  const stored = localStorage.getItem(previewKey);
  if (stored) {
    const parsed: unknown = JSON.parse(stored);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (b) =>
          typeof b?.id === 'string' &&
          typeof b?.title === 'string' &&
          typeof b?.notes === 'string' &&
          typeof b?.completed === 'boolean' &&
          !validateBlock(b),
      )
    ) {
      throw new Error(
        "The local preview data could not be read. Clear this site's storage to reset it.",
      );
    }
    return parsed;
  }
  const day = dateKey(new Date());
  return [
    { title: 'Plan the day', category: 'personal', hour: 8, minute: 30, duration: 30 },
    { title: 'Deep work', category: 'focus', hour: 9, minute: 0, duration: 120 },
    { title: 'Take a breather', category: 'break', hour: 11, minute: 0, duration: 30 },
  ].map((item, index) => {
    const startAt = new Date(
      `${day}T${String(item.hour).padStart(2, '0')}:${item.minute || '00'}:00`,
    ).getTime();
    return {
      id: `sample-${index}`,
      title: item.title,
      notes: '',
      category: item.category as Category,
      startAt,
      endAt: startAt + item.duration * 60_000,
      completed: false,
    };
  });
}

function Planner({ user }: { user: User | null }) {
  const [day, setDay] = useState(dateKey(new Date()));
  const [preview, setPreview] = useState<Block[]>([]);
  const [snapshot, setSnapshot] = useState<{
    day: string;
    blocks: Block[];
    pending: boolean;
    cached: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [editor, setEditor] = useState<Block | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (user) return;
    try {
      const initial = loadPreview();
      localStorage.setItem(previewKey, JSON.stringify(initial));
      setPreview(initial);
      setPreviewReady(true);
    } catch (error) {
      setError(message(error));
    }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    setError('');
    return subscribeBlocks(
      user.uid,
      day,
      (blocks, pending, cached) => setSnapshot({ day, blocks, pending, cached }),
      (error) => setError(message(error)),
    );
  }, [user, day]);
  const [start, end] = dayRange(day);
  const blocks = user
    ? snapshot?.day === day
      ? snapshot.blocks
      : []
    : preview
        .filter((b) => b.startAt >= start && b.startAt < end)
        .sort((a, b) => a.startAt - b.startAt);
  const loading = user ? snapshot?.day !== day : !previewReady;
  const pending = snapshot?.pending ?? false;
  const planned = blocks.reduce((total, b) => total + b.endAt - b.startAt, 0);
  const completed = blocks.filter((b) => b.completed).length;
  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const status = !user
    ? 'This device only'
    : !online
      ? 'Offline'
      : pending
        ? 'Saving changes...'
        : snapshot?.cached || loading
          ? 'Connecting...'
          : 'Synced';
  function persist(next: Block[]) {
    localStorage.setItem(previewKey, JSON.stringify(next));
    setPreview(next);
  }
  async function save(input: BlockInput, id?: string) {
    if (user) await saveBlock(user.uid, input, id);
    else {
      if (!previewReady) throw new Error('Local storage is unavailable.');
      const block = { ...input, title: input.title.trim(), id: id || crypto.randomUUID() };
      persist(id ? preview.map((b) => (b.id === id ? block : b)) : [...preview, block]);
    }
  }
  async function toggle(block: Block) {
    setBusy(true);
    setError('');
    const { id, title, notes, category, startAt, endAt, completed } = block;
    try {
      await save({ title, notes, category, startAt, endAt, completed: !completed }, id);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError('');
    try {
      if (user) await removeBlock(user.uid, deleting.id);
      else persist(preview.filter((b) => b.id !== deleting.id));
      setDeleting(null);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await signOut(firebase!.auth);
    } catch (error) {
      setError(message(error));
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <div className="nav-active">
          <CalendarDays size={18} /> Daily planner
        </div>
        <section className="sidebar-summary">
          <span className="eyebrow">A LITTLE STRUCTURE.</span>
          <h2>
            A little more
            <br />
            room to breathe.
          </h2>
          <div className="mini-schedule" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </section>
        <div className="sidebar-bottom">
          <span className="avatar">{user?.email?.[0].toUpperCase() ?? 'W'}</span>
          <div>
            <strong>{user?.email?.split('@')[0] ?? 'Local preview'}</strong>
            <small>{user ? 'Personal workspace' : 'No account connected'}</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <ChevronRight size={14} /> <strong>Daily planner</strong>
          </span>
          <div className="topbar-actions">
            <span className="sync" role="status">
              {user && online ? <Cloud size={16} /> : <CloudOff size={16} />}
              {status}
            </span>
            {user && (
              <IconButton label="Sign out" disabled={busy || pending} onClick={logout}>
                <LogOut size={18} />
              </IconButton>
            )}
          </div>
        </header>
        <main className="planner">
          {!user && (
            <div className="preview-banner">
              <span className="status-dot" />
              <strong>Local preview</strong>
              <span>Changes stay on this device until Firebase is connected.</span>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR TIME, INTENTIONALLY</span>
              <h1>Daily planner</h1>
              <p>
                {new Date(`${day}T12:00:00`).toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button className="primary" onClick={() => setEditor('new')} disabled={busy || loading}>
              <Plus size={18} /> New block
            </button>
          </div>
          <section className="stats" aria-label="Day summary">
            <div>
              <span>
                <Clock3 size={16} /> Planned
              </span>
              <strong>{durationLabel(planned)}</strong>
            </div>
            <div>
              <span>
                <LayoutGrid size={16} /> Time blocks
              </span>
              <strong>{blocks.length.toString().padStart(2, '0')}</strong>
            </div>
            <div>
              <span>
                <Check size={16} /> Completed
              </span>
              <strong>
                {completed}
                <small> / {blocks.length}</small>
              </strong>
            </div>
            <div className="day-progress">
              <span>Day progress</span>
              <progress value={completed} max={blocks.length || 1} />
              <small>
                {blocks.length ? Math.round((completed / blocks.length) * 100) : 0}% complete
              </small>
            </div>
          </section>
          <div className="agenda-toolbar">
            <h2>Your schedule</h2>
            <div className="date-controls">
              <IconButton label="Previous day" onClick={() => setDay(shiftDate(day, -1))}>
                <ChevronLeft size={18} />
              </IconButton>
              <button className="text-button" onClick={() => setDay(dateKey(new Date()))}>
                Today
              </button>
              <label className="sr-only" htmlFor="planner-date">
                Schedule date
              </label>
              <input
                id="planner-date"
                type="date"
                value={day}
                onChange={(e) => {
                  if (e.target.value) setDay(e.target.value);
                }}
              />
              <IconButton label="Next day" onClick={() => setDay(shiftDate(day, 1))}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>
          <div className="schedule-meta">
            <span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span>
            <span>{blocks.length} blocks</span>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {blocks.length >= 500 && <p role="status">Showing the first 500 blocks for this day.</p>}
          {loading && !error ? (
            <p className="empty" role="status">
              Loading your schedule...
            </p>
          ) : !blocks.length && !error ? (
            <div className="empty">
              <Coffee size={32} />
              <h3>A little open space.</h3>
              <p>What matters today?</p>
              <button className="text-button" onClick={() => setEditor('new')}>
                Add your first block
              </button>
            </div>
          ) : (
            <div className="agenda">
              {blocks.map((block) => (
                <article
                  key={block.id}
                  className={`block ${block.category} ${block.completed ? 'is-complete' : ''}`}
                >
                  <div className="block-time">
                    <strong>{time(block.startAt)}</strong>
                    <span>
                      {time(block.endAt)}
                      {dateKey(new Date(block.endAt)) !== day ? ' (+1 day)' : ''}
                    </span>
                  </div>
                  <div className="block-content">
                    <span className="category">
                      <i style={{ backgroundColor: categories[block.category].color }} />
                      {categories[block.category].label}
                      <span className="duration">{durationLabel(block.endAt - block.startAt)}</span>
                    </span>
                    <h3>{block.title}</h3>
                    {block.notes && <p>{block.notes}</p>}
                  </div>
                  <div className="block-actions">
                    <IconButton
                      label={`${block.completed ? 'Mark incomplete' : 'Complete'}: ${block.title}`}
                      disabled={busy}
                      onClick={() => toggle(block)}
                    >
                      {block.completed ? <Check size={19} /> : <Circle size={19} />}
                    </IconButton>
                    <IconButton
                      label={`Edit: ${block.title}`}
                      disabled={busy}
                      onClick={() => setEditor(block)}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label={`Delete: ${block.title}`}
                      disabled={busy}
                      onClick={() => setDeleting(block)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </article>
              ))}
            </div>
          )}
          <footer className="planner-footer">
            <span className="status-dot" /> Make room for a good day.
          </footer>
        </main>
      </div>
      {editor && (
        <Editor
          day={day}
          block={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={async (input, id) => {
            await save(input, id);
            setDay(dateKey(new Date(input.startAt)));
            setEditor(null);
          }}
        />
      )}
      {deleting && (
        <Modal title="Delete this block?" onClose={() => setDeleting(null)} busy={busy}>
          <p className="delete-copy">
            {deleting.title} will be removed from{' '}
            {user ? 'your account on all devices' : 'this device'}.
          </p>
          <div className="modal-actions">
            <button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button className="danger" disabled={busy} onClick={confirmDelete}>
              {busy ? 'Deleting...' : 'Delete block'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <IconButton label="Close" disabled={busy} onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

function Editor({
  day,
  block,
  onClose,
  onSave,
}: {
  day: string;
  block?: Block;
  onClose: () => void;
  onSave: (input: BlockInput, id?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(block?.title ?? '');
  const [notes, setNotes] = useState(block?.notes ?? '');
  const [category, setCategory] = useState<Category>(block?.category ?? 'focus');
  const [start, setStart] = useState(block ? localDateTime(block.startAt) : `${day}T09:00`);
  const [end, setEnd] = useState(block ? localDateTime(block.endAt) : `${day}T10:00`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input: BlockInput = {
      title,
      notes,
      category,
      startAt: new Date(start).getTime(),
      endAt: new Date(end).getTime(),
      completed: block?.completed ?? false,
    };
    const invalid = validateBlock(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(input, block?.id);
    } catch (error) {
      setError(message(error));
      setBusy(false);
    }
  }
  return (
    <Modal title={block ? 'Edit block' : 'New time block'} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Title
            <input
              autoFocus
              required
              maxLength={120}
              placeholder="What are you making time for?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="time-fields">
            <label>
              Start
              <input
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              End
              <input
                type="datetime-local"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {Object.entries(categories).map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes <span className="optional">(optional)</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p role="status">Saving... Keep this window open until the change is confirmed.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save block'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
