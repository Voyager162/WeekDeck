import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, Clock3, Monitor, Moon, Palette, Sun, Trash2 } from 'lucide-react';
import { dateKey, type Block } from '../domain';
import {
  atMinute,
  blockColor,
  clockLabel,
  colors,
  dayBlocks,
  defaultDay,
  icons,
  minuteAt,
  parseTime,
  timeInput,
  validSlot,
  type Color,
  type DayConfig,
  type PlannerData,
  type Preferences,
  type Slot,
  type Template,
} from './model';
import { IconButton, Modal, TemplateIcon, Toggle } from './ui';
import { nativeNotifications, type useNotifications } from './notifications';

const dayName = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'long' });
export function ColorPicker({
  value,
  onChange,
}: {
  value: Color;
  onChange: (value: Color) => void;
}) {
  return (
    <fieldset className="color-picker">
      <legend>Color</legend>
      {colors.map((color) => (
        <button
          type="button"
          key={color}
          className={`swatch color-${color}`}
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        >
          {value === color && <Check size={15} />}
        </button>
      ))}
    </fieldset>
  );
}
export function BlockEditor({
  block,
  slot,
  template,
  data,
  dates,
  onSave,
  onDelete,
  onClose,
}: {
  block?: Block;
  slot: Slot;
  template?: Template;
  data: PlannerData;
  dates: string[];
  onSave: (block: Block) => Promise<void>;
  onDelete: (block: Block) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(block?.title ?? template?.title ?? '');
  const [notes, setNotes] = useState(block?.notes ?? '');
  const [color, setColor] = useState<Color>(
    block ? blockColor(block) : (template?.color ?? 'teal'),
  );
  const [day, setDay] = useState(slot.day),
    [start, setStart] = useState(timeInput(slot.start)),
    [end, setEnd] = useState(timeInput(slot.end));
  const [completed, setCompleted] = useState(block?.completed ?? false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const a = parseTime(start),
      b = parseTime(end) || 1440;
    const config = data.days[day] ?? defaultDay;
    if (!title.trim()) {
      setError('Add a block name.');
      return;
    }
    if (!config.enabled || !validSlot(day, a, b, config, data.blocks, block?.id)) {
      setError("Choose a free time inside this day's planning hours.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        id: block?.id ?? crypto.randomUUID(),
        title: title.trim(),
        notes,
        color,
        category: block?.category ?? 'focus',
        completed,
        startAt: atMinute(day, a),
        endAt: atMinute(day, b),
      });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save.');
      setBusy(false);
    }
  }
  return (
    <Modal title={block ? 'Edit block' : 'New block'} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-fields">
          <label>
            Name
            <input
              aria-label="Block name"
              autoFocus
              required
              maxLength={120}
              value={title}
              placeholder="A little time for..."
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Day
            <select aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)}>
              {dates
                .filter((d) => (data.days[d] ?? defaultDay).enabled)
                .map((d) => (
                  <option key={d} value={d}>
                    {dayName(d)}, {new Date(`${d}T12:00`).getDate()}
                  </option>
                ))}
            </select>
          </label>
          <div className="field-pair">
            <label>
              Start
              <input
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              End
              <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <ColorPicker value={color} onChange={setColor} />
          <label>
            Notes <span className="muted">optional</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {block && <Toggle label="Completed" checked={completed} onChange={setCompleted} />}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          {block && (
            <IconButton
              label="Delete block"
              disabled={busy}
              className="danger-icon"
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(block);
                  onClose();
                } catch {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save block'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function TemplateEditor({
  template,
  onSave,
  onDelete,
  onClose,
}: {
  template?: Template;
  onSave: (template: Template) => Promise<void>;
  onDelete: (template: Template) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? ''),
    [duration, setDuration] = useState(template?.duration ?? 60);
  const [color, setColor] = useState<Color>(template?.color ?? 'teal'),
    [icon, setIcon] = useState<Template['icon']>(template?.icon ?? 'sparkles');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={template ? 'Edit preset' : 'New preset'} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setBusy(true);
          try {
            await onSave({
              id: template?.id ?? crypto.randomUUID(),
              title: title.trim(),
              duration,
              color,
              icon,
            });
            onClose();
          } catch (e) {
            setError(String(e));
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="form-fields">
          <label>
            Name
            <input
              autoFocus
              aria-label="Preset name"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Default duration
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 180, 240].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <ColorPicker value={color} onChange={setColor} />
          <fieldset className="icon-picker">
            <legend>Icon</legend>
            {icons.map((name) => (
              <IconButton
                label={name}
                key={name}
                aria-pressed={icon === name}
                className={icon === name ? 'selected' : ''}
                onClick={() => setIcon(name)}
              >
                <TemplateIcon name={name} />
              </IconButton>
            ))}
          </fieldset>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          {template && (
            <IconButton
              label="Delete preset"
              className="danger-icon"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(template);
                  onClose();
                } catch {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save preset
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function DayEditor({
  day,
  config,
  blocks,
  onSave,
  onClose,
}: {
  day: string;
  config: DayConfig;
  blocks: Block[];
  onSave: (config: DayConfig) => Promise<void>;
  onClose: () => void;
}) {
  const [start, setStart] = useState(timeInput(config.start)),
    [end, setEnd] = useState(timeInput(config.end));
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={`${dayName(day)} settings`} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const a = parseTime(start),
            b = parseTime(end) || 1440;
          if (b - a < 15) {
            setError('End time must be at least 15 minutes after start.');
            return;
          }
          if (
            dayBlocks(blocks, day).some(
              (block) => minuteAt(block.startAt, day) < a || minuteAt(block.endAt, day) > b,
            )
          ) {
            setError('Move or resize blocks outside these hours first.');
            return;
          }
          setBusy(true);
          try {
            await onSave({ enabled: true, start: a, end: b });
            onClose();
          } catch {
            setBusy(false);
          }
        }}
      >
        <p className="section-caption">Planning hours</p>
        <div className="field-pair">
          <label>
            Start
            <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            End
            <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save hours
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function CopyDialog({
  source,
  target,
  dates,
  data,
  onCopy,
  onClose,
}: {
  source: string;
  target?: string;
  dates: string[];
  data: PlannerData;
  onCopy: (targets: string[], replace: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(target ? [target] : []),
    [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title={`Copy ${dayName(source)}`} onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onCopy(selected, replace);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not copy.');
            setBusy(false);
          }
        }}
      >
        <p className="section-caption">Copy to</p>
        <div className="copy-days">
          {dates
            .filter((day) => day !== source)
            .map((day) => (
              <label key={day} className="copy-day">
                <input
                  type="checkbox"
                  checked={selected.includes(day)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked ? [...old, day] : old.filter((d) => d !== day),
                    )
                  }
                />
                <span>{dayName(day)}</span>
                <small>{dayBlocks(data.blocks, day).length} blocks</small>
              </label>
            ))}
        </div>
        <Toggle
          label="Replace existing blocks"
          detail="Selected days will use this schedule and planning hours."
          checked={replace}
          onChange={setReplace}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !selected.length}>
            {busy
              ? 'Copying...'
              : `Copy to ${selected.length || ''} ${selected.length === 1 ? 'day' : 'days'}`}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function Settings({
  preferences,
  initialTab,
  notifications,
  onSave,
  onClose,
}: {
  preferences: Preferences;
  initialTab?: string;
  notifications: ReturnType<typeof useNotifications>;
  onSave: (preferences: Preferences) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab ?? 'appearance');
  const [draft, setDraft] = useState(() => structuredClone(preferences));
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const n = draft.notifications;
  const setNotification = (change: Partial<typeof n>) =>
    setDraft((old) => ({ ...old, notifications: { ...old.notifications, ...change } }));
  useEffect(() => {
    const apply = (theme: string) => {
      document.documentElement.dataset.theme =
        theme === 'system'
          ? matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme;
    };
    apply(draft.theme);
    return () => apply(preferences.theme);
  }, [draft.theme, preferences.theme]);
  return (
    <Modal title="Settings" onClose={onClose} wide busy={busy}>
      <div className="settings-tabs" role="tablist">
        {[
          ['appearance', 'Appearance', Palette],
          ['planner', 'Planner', Clock3],
          ['notifications', 'Notifications', Bell],
        ].map(([key, label, Icon]) => {
          const Symbol = Icon as typeof Palette;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={tab === key}
              key={key as string}
              onClick={() => setTab(key as string)}
            >
              <Symbol size={16} />
              <span>{label as string}</span>
            </button>
          );
        })}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (n.advanced && (n.end < n.time || n.end - n.time > 240)) {
            setError('Choose a reminder range up to four hours, ending after its start.');
            return;
          }
          setBusy(true);
          try {
            await onSave(draft);
            onClose();
          } catch {
            setError('Settings could not be saved.');
            setBusy(false);
          }
        }}
      >
        <div className="settings-content">
          {tab === 'appearance' && (
            <>
              <h3>Make it feel like you.</h3>
              <div className="theme-options">
                {(['light', 'dark', 'sage', 'rose', 'system'] as const).map((theme) => (
                  <button
                    type="button"
                    key={theme}
                    aria-label={`${theme} theme`}
                    aria-pressed={draft.theme === theme}
                    className={`theme-option theme-${theme} ${draft.theme === theme ? 'chosen' : ''}`}
                    onClick={() => setDraft({ ...draft, theme })}
                  >
                    <div className="theme-preview">
                      <span />
                      <i />
                      <i />
                      <i />
                    </div>
                    <span>
                      {theme === 'light' ? (
                        <Sun size={14} />
                      ) : theme === 'dark' ? (
                        <Moon size={14} />
                      ) : (
                        <Monitor size={14} />
                      )}
                      {theme[0].toUpperCase() + theme.slice(1)}
                      {draft.theme === theme && <Check size={14} />}
                    </span>
                  </button>
                ))}
              </div>
              <label className="range-label">
                Timeline spacing<span>{draft.hourHeight}px / hour</span>
                <input
                  type="range"
                  min={48}
                  max={100}
                  step={4}
                  value={draft.hourHeight}
                  onChange={(e) => setDraft({ ...draft, hourHeight: +e.target.value })}
                />
              </label>
            </>
          )}
          {tab === 'planner' && (
            <>
              <h3>Planning preferences</h3>
              <div className="field-pair">
                <label>
                  Week starts on
                  <select
                    value={draft.weekStart}
                    onChange={(e) => setDraft({ ...draft, weekStart: +e.target.value as 0 | 1 })}
                  >
                    <option value={1}>Monday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </label>
                <label>
                  Time format
                  <select
                    value={draft.timeFormat}
                    onChange={(e) =>
                      setDraft({ ...draft, timeFormat: e.target.value as '12' | '24' })
                    }
                  >
                    <option value="12">12 hour</option>
                    <option value="24">24 hour</option>
                  </select>
                </label>
              </div>
              <label>
                Snap to
                <select
                  value={draft.snap}
                  onChange={(e) => setDraft({ ...draft, snap: +e.target.value })}
                >
                  {[5, 15, 30].map((v) => (
                    <option key={v} value={v}>
                      {v} minutes
                    </option>
                  ))}
                </select>
              </label>
              <div className="setting-note">
                <Clock3 size={17} />
                <span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span>
              </div>
            </>
          )}
          {tab === 'notifications' && (
            <>
              <div className="notification-status">
                <Bell size={20} />
                <div>
                  <strong>This device</strong>
                  <small>{notifications.status}</small>
                </div>
                {nativeNotifications && !notifications.enabled && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void notifications
                        .request()
                        .catch(() => setError('Permission could not be requested.'))
                    }
                  >
                    Enable
                  </button>
                )}
              </div>
              {notifications.android && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void notifications
                      .exact()
                      .catch(() => setError('Could not open device settings.'))
                  }
                >
                  Exact timing settings
                </button>
              )}
              <Toggle
                label="Weekly planning reminder"
                checked={n.planning}
                onChange={(planning) => setNotification({ planning })}
              />
              {n.planning && (
                <div className="notification-fields">
                  <div className="field-pair">
                    <label>
                      Day
                      <select
                        value={n.day}
                        onChange={(e) => setNotification({ day: +e.target.value })}
                      >
                        {[
                          'Sunday',
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                          'Saturday',
                        ].map((day, i) => (
                          <option key={day} value={i}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {n.advanced ? 'From' : 'At'}
                      <input
                        type="time"
                        required
                        value={timeInput(n.time)}
                        onChange={(e) => setNotification({ time: parseTime(e.target.value) })}
                      />
                    </label>
                  </div>
                  <Toggle
                    label="Advanced reminder schedule"
                    checked={n.advanced}
                    onChange={(advanced) => setNotification({ advanced })}
                  />
                  {n.advanced && (
                    <div className="field-pair">
                      <label>
                        Until
                        <input
                          type="time"
                          required
                          value={timeInput(n.end)}
                          onChange={(e) => setNotification({ end: parseTime(e.target.value) })}
                        />
                      </label>
                      <label>
                        Repeat every
                        <select
                          value={n.interval}
                          onChange={(e) => setNotification({ interval: +e.target.value })}
                        >
                          {[15, 30, 45, 60, 90, 120].map((v) => (
                            <option key={v} value={v}>
                              {v} minutes
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
              <Toggle
                label="Block transitions"
                detail="A reminder when a block starts or finishes."
                checked={n.transitions}
                onChange={(transitions) => setNotification({ transitions })}
              />
              {n.transitions && (
                <label>
                  Start reminder
                  <select
                    value={n.lead}
                    onChange={(e) => setNotification({ lead: +e.target.value })}
                  >
                    <option value={0}>At start time</option>
                    <option value={5}>5 minutes before</option>
                    <option value={10}>10 minutes before</option>
                  </select>
                </label>
              )}
              <p className="setting-footnote">
                Device reminders refresh when the app opens. Up to 60 upcoming reminders are
                scheduled.
              </p>
            </>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save settings'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
