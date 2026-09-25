import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Check, Copy, GripHorizontal, GripVertical, Settings2, Trash2 } from 'lucide-react';
import { dateKey, durationLabel, type Block } from '../domain';
import {
  atMinute,
  blockColor,
  clockLabel,
  dayBlocks,
  dayConfig,
  minuteAt,
  resizeSlot,
  resizeSharedBoundary,
  snapMinute,
  type DayConfig,
  type PlannerData,
  type Slot,
  type Template,
} from './model';
import { IconButton, TemplateIcon } from './ui';

export type DragItem = { kind: 'template'; template: Template } | { kind: 'block'; block: Block };
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
  onCancel,
}: {
  label: string;
  onChange: (delta: number) => void;
  onCommit: () => void;
  children?: ReactNode;
  className?: string;
  step: number;
  onCancel?: () => void;
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
        e.currentTarget.focus({ preventScroll: true });
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
          if (onCancel) onCancel();
          else onCommit();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && origin.current !== null && onCancel) {
          e.preventDefault();
          e.stopPropagation();
          origin.current = null;
          onCancel();
        }
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
  onDelete,
  onResize,
  onCommit,
  touchingStart,
  touchingEnd,
}: {
  block: Block;
  slot: Slot;
  hourHeight: number;
  format: '12' | '24';
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onResize: (edge: 'start' | 'end', delta: number) => void;
  onCommit: () => void;
  touchingStart: boolean;
  touchingEnd: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: { kind: 'block', block } satisfies DragItem,
    disabled,
  });
  const height = ((slot.end - slot.start) * hourHeight) / 60;
  const duration = durationLabel((slot.end - slot.start) * 60_000);
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
        title={`${block.title}, ${clockLabel(slot.start, format)} to ${clockLabel(slot.end, format)}, ${duration}`}
      >
        <span className="block-heading">
          <span className="block-title">
            {block.completed && <Check size={13} />}
            {block.title}
          </span>
          <span className="block-duration">{duration}</span>
        </span>
        <span className="block-time">
          {clockLabel(slot.start, format)} - {clockLabel(slot.end, format)}
        </span>
      </button>
      <IconButton
        label={`Delete ${block.title}`}
        className="block-delete"
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={13} />
      </IconButton>
      {!disabled && (
        <>
          <Edge
            label={`Resize start of ${block.title}`}
            className={`block-edge start-edge ${touchingStart ? 'touching-start' : ''}`}
            onChange={(d) => onResize('start', d)}
            onCommit={onCommit}
            step={hourHeight / 4}
          />
          <Edge
            label={`Resize end of ${block.title}`}
            className={`block-edge end-edge ${touchingEnd ? 'touching-end' : ''}`}
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
  onRemove,
  onCopy,
  onSelect,
}: {
  day: string;
  config: DayConfig;
  blocks: Block[];
  selected: boolean;
  disabled: boolean;
  onRemove: () => void;
  onCopy: () => void;
  onSelect: () => void;
}) {
  const date = new Date(`${day}T12:00:00`),
    today = dateKey(new Date()) === day;
  const total = blocks.reduce((sum, b) => sum + (b.endAt - b.startAt) / 3600000, 0);
  return (
    <div
      className={`day-heading ${selected ? 'selected-day' : ''} ${today ? 'today' : ''}`}
      data-day-heading={day}
      onClick={(event) => {
        if (!disabled && !(event.target as HTMLElement).closest('button')) onSelect();
      }}
    >
      <div className="day-title">
        <button
          className="day-select"
          aria-label={`Select ${date.toLocaleDateString([], { weekday: 'long' })}`}
          aria-pressed={selected}
          disabled={disabled}
          onClick={onSelect}
        >
          <span>{date.toLocaleDateString([], { weekday: 'short' })}</span>
          <strong>{date.getDate()}</strong>
        </button>
        <button
          className="day-copy-button icon-button"
          onClick={onCopy}
          title="Copy day"
          aria-label={`Copy ${date.toLocaleDateString([], { weekday: 'long' })}`}
          disabled={disabled}
        >
          <Copy size={14} />
        </button>
      </div>
      <div className="day-meta">
        <span>{total ? `${Number(total.toFixed(1))}h planned` : ''}</span>
        <div>
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
  onPointerMove,
  onPointerLeave,
}: {
  day: string;
  children: ReactNode;
  onClick: (e: PointerEvent | React.MouseEvent<HTMLDivElement>) => void;
  selected: boolean;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: `lane-${day}`, data: { day } });
  return (
    <div
      ref={setNodeRef}
      data-lane={day}
      className={`day-lane ${selected ? 'selected-day' : ''}`}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
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
  onSelect,
  onPlace,
  onEdit,
  onBlockSave,
  onBlocksSave,
  onBlockDelete,
  onDaySave,
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
  onSelect: (day: string) => void;
  onPlace: (day: string, minute: number) => void;
  onEdit: (block: Block) => void;
  onBlockSave: (block: Block) => void;
  onBlocksSave: (blocks: Block[]) => void;
  onBlockDelete: (block: Block) => void;
  onDaySave: (day: string, config: DayConfig) => void;
  onRemove: (day: string) => void;
  onCopy: (day: string) => void;
  onScroll: () => void;
}) {
  const { hourHeight, snap, timeFormat } = data.preferences;
  const [nearBoundary, setNearBoundary] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null),
    header = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<
    | { block: string; slot: Slot }
    | { day: string; config: DayConfig }
    | { pair: [Block, Block] }
    | null
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
    } else if (value && 'pair' in value) {
      if (
        value.pair.some((block) => {
          const original = data.blocks.find((b) => b.id === block.id);
          return original && (original.startAt !== block.startAt || original.endAt !== block.endAt);
        })
      )
        onBlocksSave(value.pair);
    } else if (value) onDaySave(value.day, value.config);
    update(null);
  }
  function resizeDay(day: string, edge: 'start' | 'end', delta: number) {
    const config = dayConfig(data, day);
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
                config={dayConfig(data, day)}
                blocks={dayBlocks(data.blocks, day)}
                selected={day === selectedDay}
                disabled={disabled}
                onRemove={() => onRemove(day)}
                onCopy={() => onCopy(day)}
                onSelect={() => onSelect(day)}
              />
            ))}
          </div>
        </div>
      </div>
      <div
        className="timeline-scroll"
        ref={scroll}
        onScroll={(e) => {
          setNearBoundary(null);
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
              const blocks = dayBlocks(data.blocks, day);
              const config =
                preview && 'day' in preview && preview.day === day
                  ? preview.config
                  : dayConfig(data, day);
              const today = day === dateKey(now);
              return (
                <Lane
                  key={day}
                  day={day}
                  selected={selectedDay === day}
                  onPointerMove={(event) => {
                    if (drag || disabled) return;
                    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
                    const top = blocks.find(
                      (block, index) =>
                        blocks[index + 1]?.startAt === block.endAt &&
                        Math.abs(y - (minuteAt(block.endAt, day) * hourHeight) / 60) <= 12,
                    );
                    setNearBoundary(top?.id ?? null);
                  }}
                  onPointerLeave={() => setNearBoundary(null)}
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
                  {blocks.map((block, index) => {
                    const paired =
                      preview && 'pair' in preview && preview.pair.find((b) => b.id === block.id);
                    const slot =
                      preview && 'block' in preview && preview.block === block.id
                        ? preview.slot
                        : {
                            day,
                            start: minuteAt(paired ? paired.startAt : block.startAt, day),
                            end: minuteAt(paired ? paired.endAt : block.endAt, day),
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
                        onDelete={() => onBlockDelete(block)}
                        onResize={(edge, delta) =>
                          update({
                            block: block.id,
                            slot: resizeSlot(
                              block,
                              edge,
                              minuteAt(edge === 'start' ? block.startAt : block.endAt, day) +
                                (delta * 60) / hourHeight,
                              dayConfig(data, day),
                              data.blocks,
                              snap,
                            ),
                          })
                        }
                        onCommit={finish}
                        touchingStart={blocks[index - 1]?.endAt === block.startAt}
                        touchingEnd={blocks[index + 1]?.startAt === block.endAt}
                      />
                    );
                  })}
                  {!disabled &&
                    !drag &&
                    (!preview || 'pair' in preview) &&
                    blocks.slice(0, -1).map((top, index) => {
                      const bottom = blocks[index + 1];
                      if (top.endAt !== bottom.startAt) return null;
                      const active = preview && 'pair' in preview && preview.pair[0].id === top.id;
                      const boundary = active ? preview.pair[0].endAt : top.endAt;
                      return (
                        <div
                          key={`${top.id}-${bottom.id}`}
                          className={`shared-edge-position ${active ? 'resizing' : ''} ${nearBoundary === top.id ? 'nearby' : ''}`}
                          style={{ top: (minuteAt(boundary, day) * hourHeight) / 60 }}
                        >
                          <Edge
                            label={`Resize boundary between ${top.title} and ${bottom.title}`}
                            className="shared-block-edge"
                            step={(hourHeight * snap) / 60}
                            onChange={(delta) => {
                              const pair = resizeSharedBoundary(
                                top,
                                bottom,
                                minuteAt(top.endAt, day) + (delta * 60) / hourHeight,
                                snap,
                              );
                              if (pair) update({ pair });
                            }}
                            onCommit={finish}
                            onCancel={() => update(null)}
                          >
                            <GripHorizontal size={18} />
                          </Edge>
                        </div>
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
