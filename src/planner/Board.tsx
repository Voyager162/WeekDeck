import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Check,
  Copy,
  GripHorizontal,
  GripVertical,
  Settings2,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react';
import { dateKey, type Block } from '../domain';
import {
  atMinute,
  blockColor,
  clockLabel,
  dayBlocks,
  defaultDay,
  minuteAt,
  resizeSlot,
  snapMinute,
  type DayConfig,
  type PlannerData,
  type Slot,
  type Template,
} from './model';
import { IconButton, TemplateIcon } from './ui';

export type DragItem =
  | { kind: 'template'; template: Template }
  | { kind: 'block'; block: Block }
  | { kind: 'day'; day: string };
export function Preset({
  template,
  active,
  disabled,
  onChoose,
  onEdit,
}: {
  template: Template;
  active: boolean;
  disabled: boolean;
  onChoose: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `preset-${template.id}`,
    data: { kind: 'template', template } satisfies DragItem,
    disabled,
  });
  return (
    <div
      className={`preset color-${template.color} ${active ? 'armed' : ''} ${isDragging ? 'drag-source' : ''}`}
    >
      <button
        ref={setNodeRef}
        className="preset-main"
        {...attributes}
        {...listeners}
        disabled={disabled}
        onClick={onChoose}
        aria-label={`Place ${template.title}`}
        title={template.title}
        aria-pressed={active}
      >
        <span className="preset-symbol">
          <TemplateIcon name={template.icon} />
        </span>
        <span className="preset-info">
          <strong>{template.title}</strong>
          <small>{template.duration} min</small>
        </span>
        <GripVertical className="preset-grip" size={15} />
      </button>
      <IconButton label={`Edit ${template.title} preset`} onClick={onEdit}>
        <Settings2 size={15} />
      </IconButton>
    </div>
  );
}
function Edge({
  label,
  onChange,
  onCommit,
  children,
  className = '',
  step,
}: {
  label: string;
  onChange: (delta: number) => void;
  onCommit: () => void;
  children?: ReactNode;
  className?: string;
  step: number;
}) {
  const origin = useRef<number | null>(null);
  return (
    <button
      type="button"
      className={`edge-handle ${className}`}
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        origin.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (origin.current !== null) {
          e.preventDefault();
          e.stopPropagation();
          onChange(e.clientY - origin.current);
        }
      }}
      onPointerUp={(e) => {
        if (origin.current === null) return;
        e.stopPropagation();
        origin.current = null;
        onCommit();
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        if (origin.current !== null) {
          origin.current = null;
          onCommit();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          onChange(e.key === 'ArrowUp' ? -step : step);
          onCommit();
        }
      }}
    >
      {children}
    </button>
  );
}
function ScheduledBlock({
  block,
  slot,
  hourHeight,
  format,
  disabled,
  onEdit,
  onResize,
  onCommit,
}: {
  block: Block;
  slot: Slot;
  hourHeight: number;
  format: '12' | '24';
  disabled: boolean;
  onEdit: () => void;
  onResize: (edge: 'start' | 'end', delta: number) => void;
  onCommit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: { kind: 'block', block } satisfies DragItem,
    disabled,
  });
  const height = ((slot.end - slot.start) * hourHeight) / 60;
  return (
    <div
      className={`scheduled-block color-${blockColor(block)} ${isDragging ? 'drag-source' : ''} ${block.completed ? 'completed' : ''} ${height < 46 ? 'compact' : ''} ${height < 72 ? 'short' : ''} ${height < 18 ? 'tiny' : ''}`}
      data-block-id={block.id}
      style={{ top: (slot.start * hourHeight) / 60, height }}
    >
      <button
        ref={setNodeRef}
        className="block-body"
        {...attributes}
        {...listeners}
        disabled={disabled}
        onClick={onEdit}
        aria-label={`${block.title}, ${clockLabel(slot.start, format)} to ${clockLabel(slot.end, format)}`}
        title={`${block.title}, ${clockLabel(slot.start, format)} to ${clockLabel(slot.end, format)}`}
      >
        <span className="block-title">
          {block.completed && <Check size={13} />}
          {block.title}
        </span>
        <span className="block-time">
          {clockLabel(slot.start, format)} - {clockLabel(slot.end, format)}
        </span>
      </button>
      {!disabled && (
        <>
          <Edge
            label={`Resize start of ${block.title}`}
            className="block-edge start-edge"
            onChange={(d) => onResize('start', d)}
            onCommit={onCommit}
            step={hourHeight / 4}
          />
          <Edge
            label={`Resize end of ${block.title}`}
            className="block-edge end-edge"
            onChange={(d) => onResize('end', d)}
            onCommit={onCommit}
            step={hourHeight / 4}
          />
        </>
      )}
    </div>
  );
}
function DayHeading({
  day,
  config,
  blocks,
  selected,
  disabled,
  onSettings,
  onRemove,
  onCopy,
}: {
  day: string;
  config: DayConfig;
  blocks: Block[];
  selected: boolean;
  disabled: boolean;
  onSettings: () => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `day-${day}`,
    data: { kind: 'day', day } satisfies DragItem,
    disabled,
  });
  const { setNodeRef: dropRef } = useDroppable({ id: `heading-${day}`, data: { day }, disabled });
  const date = new Date(`${day}T12:00:00`),
    today = dateKey(new Date()) === day;
  const total = blocks.reduce((sum, b) => sum + (b.endAt - b.startAt) / 3600000, 0);
  return (
    <div
      ref={dropRef}
      className={`day-heading ${selected ? 'selected-day' : ''} ${today ? 'today' : ''} ${isDragging ? 'drag-source' : ''}`}
      data-day-heading={day}
    >
      <div className="day-title">
        <span>{date.toLocaleDateString([], { weekday: 'short' })}</span>
        <strong>{date.getDate()}</strong>
        <button
          className="day-copy-grip icon-button"
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onClick={onCopy}
          title="Copy day"
          aria-label={`Copy ${date.toLocaleDateString([], { weekday: 'long' })}`}
          disabled={disabled}
        >
          <GripVertical size={17} />
        </button>
      </div>
      <div className="day-meta">
        <span>{total ? `${Number(total.toFixed(1))}h planned` : 'Unplanned'}</span>
        <div>
          <IconButton
            label={`${date.toLocaleDateString([], { weekday: 'long' })} settings`}
            disabled={disabled}
            onClick={onSettings}
          >
            <SettingsIcon size={13} />
          </IconButton>
          <IconButton
            label={`Remove ${date.toLocaleDateString([], { weekday: 'long' })}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
      <div className="day-progress">
        <i
          style={{ width: `${Math.min(100, ((total * 60) / (config.end - config.start)) * 100)}%` }}
        />
      </div>
    </div>
  );
}
function Lane({
  day,
  children,
  onClick,
  selected,
}: {
  day: string;
  children: ReactNode;
  onClick: (e: PointerEvent | React.MouseEvent<HTMLDivElement>) => void;
  selected: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `lane-${day}`, data: { day } });
  return (
    <div
      ref={setNodeRef}
      data-lane={day}
      className={`day-lane ${selected ? 'selected-day' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
export function Board({
  dates,
  selectedDay,
  data,
  disabled,
  ghost,
  drag,
  copyTarget,
  onPlace,
  onEdit,
  onBlockSave,
  onDaySave,
  onDaySettings,
  onRemove,
  onCopy,
  onScroll,
}: {
  dates: string[];
  selectedDay: string;
  data: PlannerData;
  disabled: boolean;
  ghost: Slot | null;
  drag: DragItem | null;
  copyTarget: string | null;
  onPlace: (day: string, minute: number) => void;
  onEdit: (block: Block) => void;
  onBlockSave: (block: Block) => void;
  onDaySave: (day: string, config: DayConfig) => void;
  onDaySettings: (day: string) => void;
  onRemove: (day: string) => void;
  onCopy: (day: string) => void;
  onScroll: () => void;
}) {
  const { hourHeight, snap, timeFormat } = data.preferences;
  const scroll = useRef<HTMLDivElement>(null),
    header = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<
    { block: string; slot: Slot } | { day: string; config: DayConfig } | null
  >(null);
  const latest = useRef(preview);
  const update = (value: typeof preview) => {
    latest.current = value;
    setPreview(value);
  };
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 8 * hourHeight;
  }, [hourHeight]);
  function finish() {
    const value = latest.current;
    if (value && 'block' in value) {
      const block = data.blocks.find((b) => b.id === value.block);
      if (block)
        onBlockSave({
          ...block,
          startAt: atMinute(value.slot.day, value.slot.start),
          endAt: atMinute(value.slot.day, value.slot.end),
        });
    } else if (value) onDaySave(value.day, value.config);
    update(null);
  }
  function resizeDay(day: string, edge: 'start' | 'end', delta: number) {
    const config = data.days[day] ?? defaultDay;
    const blocks = dayBlocks(data.blocks, day);
    const minEnd = Math.max(config.start + 15, ...blocks.map((b) => minuteAt(b.endAt, day)));
    const maxStart = Math.min(config.end - 15, ...blocks.map((b) => minuteAt(b.startAt, day)));
    const minute = snapMinute(config[edge] + (delta * 60) / hourHeight, snap);
    update({
      day,
      config: {
        ...config,
        [edge]:
          edge === 'start'
            ? Math.max(0, Math.min(maxStart, minute))
            : Math.max(minEnd, Math.min(1440, minute)),
      },
    });
  }
  const style = {
    '--day-count': dates.length,
    '--hour-height': `${hourHeight}px`,
  } as CSSProperties;
  return (
    <section
      className={`board ${drag ? 'dragging' : ''}`}
      aria-label="Weekly planner"
      style={style}
    >
      <div className="board-head">
        <div className="timezone-label">
          GMT{-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}
          {-new Date().getTimezoneOffset() / 60}
        </div>
        <div className="day-head-scroll" ref={header}>
          <div className="day-headings">
            {dates.map((day) => (
              <DayHeading
                key={day}
                day={day}
                config={data.days[day] ?? defaultDay}
                blocks={dayBlocks(data.blocks, day)}
                selected={day === selectedDay}
                disabled={disabled}
                onSettings={() => onDaySettings(day)}
                onRemove={() => onRemove(day)}
                onCopy={() => onCopy(day)}
              />
            ))}
          </div>
        </div>
      </div>
      <div
        className="timeline-scroll"
        ref={scroll}
        onScroll={(e) => {
          if (header.current) header.current.scrollLeft = e.currentTarget.scrollLeft;
          onScroll();
        }}
      >
        <div className="timeline" style={{ height: 24 * hourHeight }}>
          <div className="time-axis">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * hourHeight }}>
                {clockLabel(h * 60, timeFormat)}
              </span>
            ))}
          </div>
          <div className="day-lanes">
            {dates.map((day) => {
              const config =
                preview && 'day' in preview && preview.day === day
                  ? preview.config
                  : (data.days[day] ?? defaultDay);
              const today = day === dateKey(now);
              return (
                <Lane
                  key={day}
                  day={day}
                  selected={selectedDay === day}
                  onClick={(e) => {
                    if (disabled || drag || (e.target as HTMLElement).closest('button')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    onPlace(day, ((e.clientY - rect.top) * 60) / hourHeight);
                  }}
                >
                  <div
                    className="inactive-time"
                    style={{ top: 0, height: (config.start * hourHeight) / 60 }}
                  />
                  <div
                    className="inactive-time after"
                    style={{ top: (config.end * hourHeight) / 60, bottom: 0 }}
                  />
                  <div
                    className="planning-range"
                    style={{
                      top: (config.start * hourHeight) / 60,
                      height: ((config.end - config.start) * hourHeight) / 60,
                    }}
                  />
                  {!disabled && (
                    <div
                      className="day-edge-position"
                      style={{ top: (config.start * hourHeight) / 60 }}
                    >
                      <Edge
                        label={`Start hours ${day}`}
                        className="day-boundary"
                        onChange={(d) => resizeDay(day, 'start', d)}
                        onCommit={finish}
                        step={(hourHeight * snap) / 60}
                      >
                        <GripHorizontal size={14} />
                        <span>{clockLabel(config.start, timeFormat)}</span>
                      </Edge>
                    </div>
                  )}
                  {dayBlocks(data.blocks, day).map((block) => {
                    const slot =
                      preview && 'block' in preview && preview.block === block.id
                        ? preview.slot
                        : {
                            day,
                            start: minuteAt(block.startAt, day),
                            end: minuteAt(block.endAt, day),
                          };
                    return (
                      <ScheduledBlock
                        key={block.id}
                        block={block}
                        slot={slot}
                        hourHeight={hourHeight}
                        format={timeFormat}
                        disabled={disabled}
                        onEdit={() => onEdit(block)}
                        onResize={(edge, delta) =>
                          update({
                            block: block.id,
                            slot: resizeSlot(
                              block,
                              edge,
                              minuteAt(edge === 'start' ? block.startAt : block.endAt, day) +
                                (delta * 60) / hourHeight,
                              data.days[day] ?? defaultDay,
                              data.blocks,
                              snap,
                            ),
                          })
                        }
                        onCommit={finish}
                      />
                    );
                  })}
                  {!disabled && (
                    <div
                      className="day-edge-position"
                      style={{ top: (config.end * hourHeight) / 60 }}
                    >
                      <Edge
                        label={`End hours ${day}`}
                        className="day-boundary bottom-boundary"
                        onChange={(d) => resizeDay(day, 'end', d)}
                        onCommit={finish}
                        step={(hourHeight * snap) / 60}
                      >
                        <GripHorizontal size={14} />
                        <span>{clockLabel(config.end, timeFormat)}</span>
                      </Edge>
                    </div>
                  )}
                  {ghost?.day === day && (
                    <div
                      data-testid="drop-ghost"
                      className={`drop-ghost color-${drag?.kind === 'template' ? drag.template.color : drag?.kind === 'block' ? blockColor(drag.block) : 'teal'}`}
                      style={{
                        top: (ghost.start * hourHeight) / 60,
                        height: ((ghost.end - ghost.start) * hourHeight) / 60,
                      }}
                    >
                      <strong>
                        {clockLabel(ghost.start, timeFormat)} - {clockLabel(ghost.end, timeFormat)}
                      </strong>
                    </div>
                  )}
                  {copyTarget === day && (
                    <div className="copy-drop">
                      <Copy size={24} />
                      <span>Copy here</span>
                    </div>
                  )}
                  {today && (
                    <div
                      className="now-line"
                      style={{ top: (now.getHours() + now.getMinutes() / 60) * hourHeight }}
                    >
                      <i />
                    </div>
                  )}
                </Lane>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
