import { dateKey, shiftDate, type Block } from '../domain';

export const colors = ['teal', 'blue', 'violet', 'rose', 'amber', 'green', 'cyan', 'gray'] as const;
export type Color = (typeof colors)[number];
export const icons = [
  'book',
  'briefcase',
  'coffee',
  'music',
  'pencil',
  'heart',
  'dumbbell',
  'sparkles',
] as const;
export type Template = {
  id: string;
  title: string;
  color: Color;
  icon: (typeof icons)[number];
  duration: number;
};
export type DayConfig = { enabled: boolean; start: number; end: number; hoursVersion?: string };
export type SharedHours = { start: number; end: number; linked: boolean; version: string };
export type Preferences = {
  theme: 'light' | 'dark' | 'sage' | 'rose' | 'system';
  hourHeight: number;
  snap: number;
  timeFormat: '12' | '24';
  weekStart: 0 | 1;
  dayHours?: SharedHours;
  notifications: {
    planning: boolean;
    day: number;
    time: number;
    advanced: boolean;
    end: number;
    interval: number;
    transitions: boolean;
    lead: number;
  };
};
export type PlannerData = {
  blocks: Block[];
  templates: Template[];
  days: Record<string, DayConfig>;
  preferences: Preferences;
};
export const defaultDay: DayConfig = { enabled: true, start: 540, end: 1020 };
export const defaultPreferences: Preferences = {
  theme: 'light',
  hourHeight: 72,
  snap: 15,
  timeFormat: '12',
  weekStart: 1,
  notifications: {
    planning: false,
    day: 0,
    time: 1080,
    advanced: false,
    end: 1200,
    interval: 30,
    transitions: false,
    lead: 0,
  },
};
export const defaultTemplates: Template[] = [
  { id: 'work', title: 'Work', color: 'blue', icon: 'briefcase', duration: 60 },
  { id: 'study', title: 'Study', color: 'violet', icon: 'book', duration: 60 },
  { id: 'homework', title: 'Homework', color: 'amber', icon: 'pencil', duration: 60 },
  { id: 'relax', title: 'Relax', color: 'teal', icon: 'coffee', duration: 60 },
  { id: 'music', title: 'Practice music', color: 'rose', icon: 'music', duration: 60 },
  { id: 'exercise', title: 'Exercise', color: 'green', icon: 'dumbbell', duration: 60 },
];
export function emptyPlanner(): PlannerData {
  return {
    blocks: [],
    templates: structuredClone(defaultTemplates),
    days: {},
    preferences: structuredClone(defaultPreferences),
  };
}
export function dayConfig(data: PlannerData, day: string): DayConfig {
  const config = data.days[day] ?? defaultDay;
  const hours = data.preferences.dayHours;
  // A new shared range supersedes older overrides, even on weeks not loaded yet.
  if (hours && (hours.linked || config.hoursVersion !== hours.version))
    return { ...config, start: hours.start, end: hours.end };
  return config;
}
export function weekOf(key: string, start: 0 | 1 = 1) {
  const weekday = new Date(`${key}T12:00:00`).getDay();
  return shiftDate(key, -((weekday - start + 7) % 7));
}
export function weekDates(key: string) {
  return Array.from({ length: 7 }, (_, i) => shiftDate(key, i));
}
export function atMinute(day: string, minute: number): number {
  const date = new Date(`${day}T00:00:00`);
  date.setHours(0, minute, 0, 0);
  return date.getTime();
}
export function minuteAt(ms: number, day = dateKey(new Date(ms))) {
  if (dateKey(new Date(ms)) > day) return 1440;
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}
export function clockLabel(minute: number, format: '12' | '24' = '12') {
  const h = Math.floor(minute / 60) % 24,
    m = minute % 60;
  return format === '24'
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}
export function timeInput(minute: number) {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
export function parseTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
export function dayBlocks(blocks: Block[], day: string) {
  return blocks
    .filter((b) => dateKey(new Date(b.startAt)) === day)
    .sort((a, b) => a.startAt - b.startAt);
}
export function blockColor(block: Block): Color {
  if (colors.includes(block.color as Color)) return block.color as Color;
  return { focus: 'teal', meeting: 'blue', personal: 'rose', break: 'amber' }[
    block.category
  ] as Color;
}
export function snapMinute(value: number, snap: number) {
  return Math.round(value / snap) * snap;
}
export type Slot = { day: string; start: number; end: number };
export function validClockRange(day: string, start: number, end: number) {
  const a = atMinute(day, start),
    b = atMinute(day, end);
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    b > a &&
    b - a <= 86_400_000 &&
    minuteAt(a, day) === start &&
    minuteAt(b, day) === end
  );
}
// Fit within the free interval under the pointer; never jump across an occupied block.
export function fitSlot(
  day: string,
  desired: number,
  duration: number,
  config: DayConfig,
  blocks: Block[],
  snap = 15,
  exclude?: string,
): Slot | null {
  if (!config.enabled) return null;
  const occupied = dayBlocks(blocks, day)
    .filter((b) => b.id !== exclude)
    .map((b) => ({ start: minuteAt(b.startAt, day), end: minuteAt(b.endAt, day) }));
  const point = Math.max(config.start, Math.min(config.end - 1, desired));
  if (occupied.some((b) => point >= b.start && point < b.end)) return null;
  const previous = Math.max(
    config.start,
    ...occupied.filter((b) => b.end <= point).map((b) => b.end),
  );
  const next = Math.min(config.end, ...occupied.filter((b) => b.start > point).map((b) => b.start));
  const start = Math.max(
    previous,
    Math.min(snapMinute(point, snap), next - Math.min(duration, next - previous)),
  );
  const end = Math.min(next, start + duration);
  return end - start >= 5 && validClockRange(day, start, end) ? { day, start, end } : null;
}
export function resizeSlot(
  block: Block,
  edge: 'start' | 'end',
  desired: number,
  config: DayConfig,
  blocks: Block[],
  snap: number,
): Slot {
  const day = dateKey(new Date(block.startAt));
  let start = minuteAt(block.startAt, day),
    end = minuteAt(block.endAt, day);
  const others = dayBlocks(blocks, day).filter((b) => b.id !== block.id);
  if (edge === 'start') {
    const lower = Math.max(
      config.start,
      ...others.filter((b) => b.endAt <= block.startAt).map((b) => minuteAt(b.endAt, day)),
    );
    start = Math.max(lower, Math.min(end - 5, snapMinute(desired, snap)));
  } else {
    const upper = Math.min(
      config.end,
      ...others.filter((b) => b.startAt >= block.endAt).map((b) => minuteAt(b.startAt, day)),
    );
    end = Math.min(upper, Math.max(start + 5, snapMinute(desired, snap)));
  }
  return validClockRange(day, start, end)
    ? { day, start, end }
    : { day, start: minuteAt(block.startAt, day), end: minuteAt(block.endAt, day) };
}
export function validSlot(
  day: string,
  start: number,
  end: number,
  config: DayConfig,
  blocks: Block[],
  exclude?: string,
) {
  return (
    validClockRange(day, start, end) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= config.start &&
    end <= config.end &&
    end - start >= 5 &&
    !dayBlocks(blocks, day).some(
      (b) => b.id !== exclude && atMinute(day, start) < b.endAt && atMinute(day, end) > b.startAt,
    )
  );
}
export function blockFromSlot(title: string, color: Color, slot: Slot): Block {
  return {
    id: crypto.randomUUID(),
    title,
    color,
    notes: '',
    category: 'focus',
    completed: false,
    startAt: atMinute(slot.day, slot.start),
    endAt: atMinute(slot.day, slot.end),
  };
}
