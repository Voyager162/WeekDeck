import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Copy,
  Layers2,
  LogOut,
  PanelLeftClose,
  Plus,
  Redo2,
  Settings2,
  Undo2,
  X,
} from 'lucide-react';
import { signOut, type User } from 'firebase/auth';
import { firebase } from '../firebase';
import { dateKey, shiftDate, type Block } from '../domain';
import {
  atMinute,
  blockColor,
  blockFromSlot,
  clockLabel,
  dayBlocks,
  defaultDay,
  fitSlot,
  minuteAt,
  validSlot,
  validClockRange,
  weekDates,
  weekOf,
  type DayConfig,
  type Slot,
  type Template,
} from './model';
import { usePlanner, type Change } from './store';
import { useNotifications } from './notifications';
import { Board, Preset, type DragItem } from './Board';
import { BlockEditor, CopyDialog, DayEditor, Settings, TemplateEditor } from './Dialogs';
import { Brand, IconButton, Modal, TemplateIcon } from './ui';

type Dialog =
  | { kind: 'block'; slot: Slot; block?: Block; template?: Template }
  | { kind: 'preset'; template?: Template }
  | { kind: 'day'; day: string }
  | { kind: 'copy'; day: string; target?: string }
  | { kind: 'remove'; day: string }
  | { kind: 'settings'; tab?: string }
  | null;
export function WeekPlanner({ user }: { user: User | null }) {
  const today = dateKey(new Date());
  const [anchor, setAnchor] = useState(today),
    [weekStart, setWeekStart] = useState<0 | 1>(1);
  const week = weekOf(anchor, weekStart),
    dates = weekDates(week);
  const store = usePlanner(user, week),
    { data, busy, ready, error } = store;
  const [selectedDay, setSelectedDay] = useState(today),
    [library, setLibrary] = useState(() => window.innerWidth > 900);
  const libraryGesture = useRef<{ x: number; dragged: boolean } | null>(null);
  const libraryControl = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      libraryGesture.current = { x: event.clientX, dragged: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = libraryGesture.current;
      if (gesture && Math.abs(event.clientX - gesture.x) > 24) {
        gesture.dragged = true;
        setLibrary(event.clientX > gesture.x);
      }
    },
    onPointerCancel: () => {
      libraryGesture.current = null;
    },
    onClick: () => {
      if (!libraryGesture.current?.dragged) setLibrary(!library);
      libraryGesture.current = null;
    },
  };
  const [armed, setArmed] = useState<Template | null>(null),
    [dialog, setDialog] = useState<Dialog>(null);
  const [drag, setDrag] = useState<DragItem | null>(null),
    [ghost, setGhost] = useState<Slot | null>(null),
    [copyTarget, setCopyTarget] = useState<string | null>(null);
  const dragRef = useRef<DragItem | null>(null),
    ghostRef = useRef<Slot | null>(null),
    targetRef = useRef<string | null>(null),
    point = useRef<{ x: number; y: number } | null>(null);
  const notifications = useNotifications(
    user?.uid,
    data.blocks,
    data.preferences.notifications,
    ready,
  );
  const visible = dates.filter((day) => (data.days[day] ?? defaultDay).enabled);
  const activeDay = visible.includes(selectedDay) ? selectedDay : visible[0];
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  // Screen coordinates stay stable when a drag scrolls the timeline or closes the drawer.
  useEffect(() => {
    const track = (event: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const pointer = 'touches' in event ? event.touches[0] : event;
      if (pointer) point.current = { x: pointer.clientX, y: pointer.clientY };
    };
    document.addEventListener('mousemove', track, true);
    document.addEventListener('touchmove', track, true);
    return () => {
      document.removeEventListener('mousemove', track, true);
      document.removeEventListener('touchmove', track, true);
    };
  }, []);
  useEffect(() => setWeekStart(data.preferences.weekStart), [data.preferences.weekStart]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        data.preferences.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : data.preferences.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [data.preferences.theme]);
  async function commit(changes: Change[]) {
    await store.commit(changes);
  }
  function perform(action: Promise<unknown>) {
    void action.catch(() => undefined);
  }
  const saveBlock = (block: Block) =>
    commit([
      {
        kind: 'blocks',
        id: block.id,
        before: data.blocks.find((b) => b.id === block.id),
        after: block,
      },
    ]);
  const removeBlock = (block: Block) => commit([{ kind: 'blocks', id: block.id, before: block }]);
  const saveDay = (day: string, config: DayConfig) =>
    commit([{ kind: 'days', id: day, before: data.days[day], after: config }]);
  function place(day: string, minute: number) {
    const slot = fitSlot(
      day,
      minute,
      armed?.duration ?? 60,
      data.days[day] ?? defaultDay,
      data.blocks,
      data.preferences.snap,
    );
    if (!slot) {
      store.setError('There is no free space here. Choose another time.');
      return;
    }
    if (armed) {
      perform(saveBlock(blockFromSlot(armed.title, armed.color, slot)));
      setArmed(null);
    } else setDialog({ kind: 'block', slot });
  }
  function newBlock() {
    const day = activeDay;
    if (!day) return;
    const config = data.days[day] ?? defaultDay;
    for (let minute = config.start; minute < config.end; minute += 5) {
      const slot = fitSlot(day, minute, 60, config, data.blocks, data.preferences.snap);
      if (slot) {
        setDialog({ kind: 'block', slot });
        return;
      }
    }
    store.setError('This day is full. Extend its hours or choose another day.');
  }
  function moveWeek(offset: number) {
    const day = shiftDate(week, offset * 7);
    setAnchor(day);
    setSelectedDay(day);
    setArmed(null);
  }
  function updateGhost() {
    const p = point.current,
      item = dragRef.current;
    if (!p || !item) return;
    let slot: Slot | null = null,
      target: string | null = null;
    const timeline = document.querySelector('.timeline-scroll')?.getBoundingClientRect();
    const viewport = document.querySelector('.day-head-scroll')?.getBoundingClientRect();
    for (const element of document.querySelectorAll<HTMLElement>(
      item.kind === 'day' ? '[data-day-heading], [data-lane]' : '[data-lane]',
    )) {
      const rect = element.getBoundingClientRect();
      if (
        !rect.width ||
        (viewport && (p.x < viewport.left || p.x >= viewport.right)) ||
        p.x < rect.left ||
        p.x >= rect.right ||
        p.y < (element.dataset.dayHeading ? rect.top : Math.max(rect.top, timeline?.top ?? 0)) ||
        p.y > Math.min(rect.bottom, timeline?.bottom ?? innerHeight)
      )
        continue;
      const day = element.dataset.lane ?? element.dataset.dayHeading!;
      if (item.kind === 'day') {
        if (day !== item.day) target = day;
        break;
      }
      const desired = ((p.y - rect.top) * 60) / data.preferences.hourHeight;
      const duration =
        item.kind === 'template'
          ? item.template.duration
          : (item.block.endAt - item.block.startAt) / 60000;
      slot = fitSlot(
        day,
        desired,
        duration,
        data.days[day] ?? defaultDay,
        data.blocks,
        data.preferences.snap,
        item.kind === 'block' ? item.block.id : undefined,
      );
      break;
    }
    ghostRef.current = slot;
    targetRef.current = target;
    setGhost(slot);
    setCopyTarget(target);
  }
  function startDrag(event: DragStartEvent) {
    const item = event.active.data.current as DragItem;
    dragRef.current = item;
    setDrag(item);
    setArmed(null);
    if (innerWidth <= 900) setLibrary(false);
  }
  function moveDrag(event: DragMoveEvent) {
    const activator = event.activatorEvent as MouseEvent & TouchEvent;
    const origin = activator.touches?.[0] ?? activator;
    if (!point.current)
      point.current = { x: origin.clientX + event.delta.x, y: origin.clientY + event.delta.y };
    updateGhost();
  }
  function clearDrag() {
    setDrag(null);
    dragRef.current = null;
    point.current = null;
    setGhost(null);
    ghostRef.current = null;
    setCopyTarget(null);
    targetRef.current = null;
  }
  function endDrag() {
    updateGhost();
    const item = dragRef.current,
      slot = ghostRef.current;
    if (item?.kind === 'day' && targetRef.current)
      setDialog({ kind: 'copy', day: item.day, target: targetRef.current });
    else if (slot && item?.kind === 'template')
      perform(saveBlock(blockFromSlot(item.template.title, item.template.color, slot)));
    else if (slot && item?.kind === 'block')
      perform(
        saveBlock({
          ...item.block,
          startAt: atMinute(slot.day, slot.start),
          endAt: atMinute(slot.day, slot.end),
        }),
      );
    clearDrag();
  }
  async function copyDay(source: string, targets: string[], replace: boolean) {
    const changes: Change[] = [],
      sourceConfig = data.days[source] ?? defaultDay;
    for (const target of targets) {
      const existing = dayBlocks(data.blocks, target);
      const config = replace
        ? sourceConfig
        : {
            enabled: true,
            start: Math.min(sourceConfig.start, (data.days[target] ?? defaultDay).start),
            end: Math.max(sourceConfig.end, (data.days[target] ?? defaultDay).end),
          };
      const sourceBlocks = dayBlocks(data.blocks, source);
      if (
        sourceBlocks.some(
          (b) => !validClockRange(target, minuteAt(b.startAt, source), minuteAt(b.endAt, source)),
        )
      )
        throw new Error('A copied time is unavailable on this date. Adjust that block first.');
      const copied = sourceBlocks.map((b) => ({
        ...b,
        id: crypto.randomUUID(),
        completed: false,
        startAt: atMinute(target, minuteAt(b.startAt, source)),
        endAt: atMinute(target, minuteAt(b.endAt, source)),
      }));
      if (
        !replace &&
        copied.some(
          (b) =>
            !validSlot(
              target,
              minuteAt(b.startAt, target),
              minuteAt(b.endAt, target),
              config,
              existing,
            ),
        )
      )
        throw new Error('Some blocks overlap. Choose another day or replace existing blocks.');
      if (replace)
        for (const block of existing) changes.push({ kind: 'blocks', id: block.id, before: block });
      for (const block of copied) changes.push({ kind: 'blocks', id: block.id, after: block });
      changes.push({
        kind: 'days',
        id: target,
        before: data.days[target],
        after: { ...config, enabled: true },
      });
    }
    await commit(changes);
  }
  const plannedMinutes = data.blocks
    .filter((b) => dates.includes(dateKey(new Date(b.startAt))))
    .reduce((sum, b) => sum + (b.endAt - b.startAt) / 60000, 0);
  const totalMinutes = visible.reduce((sum, day) => {
    const c = data.days[day] ?? defaultDay;
    return sum + c.end - c.start;
  }, 0);
  const weekLabel = `${new Date(`${week}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${new Date(`${dates[6]}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return (
    <DndContext
      sensors={sensors}
      onDragStart={startDrag}
      onDragMove={moveDrag}
      onDragEnd={endDrag}
      onDragCancel={clearDrag}
    >
      <div className={`app-shell ${library ? 'library-open' : ''}`}>
        <header className="app-header">
          <Brand />
          <div className="header-right">
            <span className="sync-status" role="status">
              {!user ? (
                <>
                  <CloudOff size={14} />
                  On this device
                </>
              ) : busy ? (
                <>
                  <Cloud size={14} />
                  Saving...
                </>
              ) : store.cached ? (
                <>
                  <CloudOff size={14} />
                  Connecting...
                </>
              ) : (
                <>
                  <Check size={14} />
                  All changes saved
                </>
              )}
            </span>
            <IconButton
              label="Notification settings"
              onClick={() => setDialog({ kind: 'settings', tab: 'notifications' })}
            >
              <Bell size={18} />
            </IconButton>
            <IconButton label="Settings" onClick={() => setDialog({ kind: 'settings' })}>
              <Settings2 size={18} />
            </IconButton>
            {user && (
              <IconButton
                label={`Sign out ${user.email}`}
                onClick={() => perform(signOut(firebase!.auth))}
              >
                <LogOut size={18} />
              </IconButton>
            )}
            <span className="avatar" aria-label={user?.email ?? 'Local planner'}>
              {user?.email?.[0].toUpperCase() ?? 'W'}
            </span>
          </div>
        </header>
        <nav className="icon-rail" aria-label="Workspace">
          <IconButton
            label="Block library"
            className={library ? 'rail-active' : ''}
            aria-expanded={library}
            {...libraryControl}
          >
            <Layers2 size={21} />
          </IconButton>
          <IconButton
            label="This week"
            onClick={() => {
              setAnchor(today);
              setSelectedDay(today);
            }}
          >
            <CalendarDays size={21} />
          </IconButton>
          <span className="spacer" />
          <IconButton
            label="Planner settings"
            onClick={() => setDialog({ kind: 'settings', tab: 'planner' })}
          >
            <Settings2 size={21} />
          </IconButton>
        </nav>
        {(library || (drag?.kind === 'template' && innerWidth <= 900)) && (
          <>
            {library && (
              <button
                className="library-backdrop"
                aria-label="Close library"
                onClick={() => setLibrary(false)}
              />
            )}
            <aside className={`library ${!library ? 'drag-hidden' : ''}`} aria-hidden={!library}>
              <header>
                <h2>Your blocks</h2>
                <IconButton label="Close block library" onClick={() => setLibrary(false)}>
                  <PanelLeftClose size={18} />
                </IconButton>
              </header>
              <div className="library-list">
                {data.templates.map((template) => (
                  <Preset
                    key={template.id}
                    template={template}
                    active={armed?.id === template.id}
                    disabled={!ready || busy}
                    onChoose={() => {
                      setArmed(armed?.id === template.id ? null : template);
                      if (innerWidth <= 900) setLibrary(false);
                    }}
                    onEdit={() => setDialog({ kind: 'preset', template })}
                  />
                ))}
                <button
                  className="add-preset"
                  onClick={() => setDialog({ kind: 'preset' })}
                  disabled={!ready || busy || data.templates.length >= 30}
                >
                  <Plus size={16} />
                  New preset
                </button>
              </div>
              <div className="week-summary">
                <span className="section-caption">THIS WEEK</span>
                <div>
                  <strong>
                    {Number((plannedMinutes / 60).toFixed(1))}
                    <small>h planned</small>
                  </strong>
                  <span>
                    {totalMinutes ? Math.round((plannedMinutes / totalMinutes) * 100) : 0}%
                  </span>
                </div>
                <div className="summary-track">
                  <i
                    style={{
                      width: `${Math.min(100, (plannedMinutes / (totalMinutes || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {data.blocks.filter((b) => dates.includes(dateKey(new Date(b.startAt)))).length}{' '}
                  blocks <span>/</span> {visible.length} days
                </small>
              </div>
            </aside>
          </>
        )}
        <main className="planner-main">
          <header className="week-toolbar">
            <div className="week-heading">
              <h1>{weekOf(today, weekStart) === week ? 'This week' : 'Your week'}</h1>
              <div className="week-navigation">
                <IconButton label="Previous week" onClick={() => moveWeek(-1)}>
                  <ChevronLeft size={17} />
                </IconButton>
                <button
                  className="week-date"
                  onClick={() => {
                    setAnchor(today);
                    setSelectedDay(today);
                  }}
                  title="Go to this week"
                >
                  {weekLabel}
                </button>
                <IconButton label="Next week" onClick={() => moveWeek(1)}>
                  <ChevronRight size={17} />
                </IconButton>
              </div>
            </div>
            <div className="toolbar-actions">
              <div className="history-actions">
                <IconButton
                  label="Undo"
                  disabled={busy || !store.canUndo}
                  onClick={() => perform(store.undo())}
                >
                  <Undo2 size={17} />
                </IconButton>
                <IconButton
                  label="Redo"
                  disabled={busy || !store.canRedo}
                  onClick={() => perform(store.redo())}
                >
                  <Redo2 size={17} />
                </IconButton>
              </div>
              {visible.length < 7 && (
                <details className="hidden-days">
                  <summary title="Restore days">
                    <CalendarDays size={17} />
                    <span>Days</span>
                  </summary>
                  <div className="days-menu">
                    {dates
                      .filter((d) => !visible.includes(d))
                      .map((day) => (
                        <button
                          key={day}
                          onClick={() =>
                            perform(
                              saveDay(day, { ...(data.days[day] ?? defaultDay), enabled: true }),
                            )
                          }
                        >
                          <Plus size={14} />
                          {new Date(`${day}T12:00`).toLocaleDateString([], { weekday: 'long' })}
                        </button>
                      ))}
                  </div>
                </details>
              )}
              <button
                className="primary new-block"
                aria-label="New block"
                title="New block"
                disabled={!ready || busy || !activeDay}
                onClick={newBlock}
              >
                <Plus size={17} />
                <span>New block</span>
              </button>
            </div>
          </header>
          <nav className="mobile-days" aria-label="Select day">
            {visible.map((day) => (
              <button
                key={day}
                className={activeDay === day ? 'active' : ''}
                aria-pressed={activeDay === day}
                onClick={() => setSelectedDay(day)}
              >
                <span>
                  {new Date(`${day}T12:00`)
                    .toLocaleDateString([], { weekday: 'short' })
                    .slice(0, 1)}
                </span>
                <strong>{new Date(`${day}T12:00`).getDate()}</strong>
                <i className={dayBlocks(data.blocks, day).length ? 'has-blocks' : ''} />
              </button>
            ))}
          </nav>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <IconButton label="Dismiss error" onClick={() => store.setError('')}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {armed && (
            <div className={`placement-bar color-${armed.color}`}>
              <TemplateIcon name={armed.icon} />
              <strong>{armed.title}</strong>
              <span>{armed.duration} min</span>
              <IconButton label="Cancel placement" onClick={() => setArmed(null)}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {!ready ? (
            <div className="empty-state" role="status">
              <span className="loading-ring" />
              Opening your week...
            </div>
          ) : !visible.length ? (
            <div className="empty-state">
              <CalendarDays size={34} />
              <h2>A fresh start.</h2>
              <button
                className="secondary"
                onClick={() =>
                  perform(
                    commit(
                      dates.map((day) => ({
                        kind: 'days',
                        id: day,
                        before: data.days[day],
                        after: { ...defaultDay },
                      })),
                    ),
                  )
                }
              >
                Restore all days
              </button>
            </div>
          ) : (
            <Board
              dates={visible}
              selectedDay={activeDay}
              data={data}
              disabled={busy || !ready}
              ghost={ghost}
              drag={drag}
              copyTarget={copyTarget}
              onPlace={place}
              onEdit={(block) =>
                setDialog({
                  kind: 'block',
                  block,
                  slot: {
                    day: dateKey(new Date(block.startAt)),
                    start: minuteAt(block.startAt),
                    end: minuteAt(block.endAt, dateKey(new Date(block.startAt))),
                  },
                })
              }
              onBlockSave={(block) => perform(saveBlock(block))}
              onDaySave={(day, config) => perform(saveDay(day, config))}
              onDaySettings={(day) => setDialog({ kind: 'day', day })}
              onRemove={(day) => setDialog({ kind: 'remove', day })}
              onCopy={(day) => setDialog({ kind: 'copy', day })}
              onScroll={updateGhost}
            />
          )}
          <footer className="planner-footer">
            <button {...libraryControl} aria-expanded={library}>
              <Layers2 size={14} />
              <span>Block library</span>
              <ChevronRight size={14} />
            </button>
            <span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span>
            <span>{data.preferences.snap} min snap</span>
          </footer>
        </main>
      </div>
      <DragOverlay dropAnimation={null}>
        {drag && (
          <div
            className={`drag-overlay color-${drag.kind === 'template' ? drag.template.color : drag.kind === 'block' ? blockColor(drag.block) : 'teal'}`}
          >
            {drag.kind === 'day' ? (
              <>
                <Copy size={18} />
                <strong>
                  {new Date(`${drag.day}T12:00`).toLocaleDateString([], { weekday: 'long' })}
                </strong>
              </>
            ) : (
              <>
                {drag.kind === 'template' && <TemplateIcon name={drag.template.icon} />}
                <div>
                  <strong>
                    {drag.kind === 'template' ? drag.template.title : drag.block.title}
                  </strong>
                  <small>
                    {ghost
                      ? `${clockLabel(ghost.start, data.preferences.timeFormat)} - ${clockLabel(ghost.end, data.preferences.timeFormat)}`
                      : ' '}
                  </small>
                </div>
              </>
            )}
          </div>
        )}
      </DragOverlay>
      {dialog?.kind === 'block' && (
        <BlockEditor
          {...dialog}
          data={data}
          dates={dates}
          onSave={saveBlock}
          onDelete={removeBlock}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'preset' && (
        <TemplateEditor
          template={dialog.template}
          onSave={(template) =>
            commit([
              {
                kind: 'templates',
                id: template.id,
                before: data.templates.find((t) => t.id === template.id),
                after: template,
              },
            ])
          }
          onDelete={(template) =>
            commit([{ kind: 'templates', id: template.id, before: template }])
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'day' && (
        <DayEditor
          day={dialog.day}
          config={data.days[dialog.day] ?? defaultDay}
          blocks={data.blocks}
          onSave={(config) => saveDay(dialog.day, config)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'copy' && (
        <CopyDialog
          source={dialog.day}
          target={dialog.target}
          data={data}
          dates={dates}
          onCopy={(targets, replace) => copyDay(dialog.day, targets, replace)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'settings' && (
        <Settings
          preferences={data.preferences}
          initialTab={dialog.tab}
          notifications={notifications}
          onSave={(preferences) =>
            commit([
              { kind: 'settings', id: 'planner', before: data.preferences, after: preferences },
            ])
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <Modal
          title={`Remove ${new Date(`${dialog.day}T12:00`).toLocaleDateString([], { weekday: 'long' })}?`}
          onClose={() => setDialog(null)}
          busy={busy}
        >
          <p className="confirm-copy">
            This removes the day and its {dayBlocks(data.blocks, dialog.day).length} blocks from
            this week. You can undo this change.
          </p>
          <footer className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                const day = dialog.day;
                perform(
                  commit([
                    ...dayBlocks(data.blocks, day).map((block) => ({
                      kind: 'blocks' as const,
                      id: block.id,
                      before: block,
                    })),
                    {
                      kind: 'days',
                      id: day,
                      before: data.days[day],
                      after: { ...(data.days[day] ?? defaultDay), enabled: false },
                    },
                  ]).then(() => setDialog(null)),
                );
              }}
            >
              Remove day
            </button>
          </footer>
        </Modal>
      )}
    </DndContext>
  );
}
