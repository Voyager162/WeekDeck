import { dateKey, shiftDate, type Block } from '../domain';
import {
  atMinute,
  dayConfig,
  minuteAt,
  validClockRange,
  weekDates,
  weekOf,
  type PlannerData,
} from './model';
import { displayBlock, storeBlock } from './calendarTime';
import type { Change } from './store';

export function touchedWeeks(changes: Change[], start: 0 | 1): string[] {
  const weeks = new Set<string>();
  for (const change of changes) {
    if (change.kind === 'days') weeks.add(weekOf(change.id, start));
    if (change.kind === 'blocks')
      for (const value of [change.before, change.after])
        if (value) weeks.add(weekOf(dateKey(new Date((value as Block).startAt)), start));
  }
  return [...weeks];
}

// All values here are display-local calendar times, not elapsed UTC durations.
export function copyWeek(data: PlannerData, source: string, target: string) {
  const from = weekDates(source),
    to = weekDates(target);
  const blocks = data.blocks.filter((block) => from.includes(dateKey(new Date(block.startAt))));
  return {
    blocks: blocks.map((block) => {
      const day = dateKey(new Date(block.startAt));
      const next = to[from.indexOf(day)];
      const start = minuteAt(block.startAt, day),
        end = minuteAt(block.endAt, day);
      const unavailable = () =>
        new Error(
          'A time from last week is unavailable on this date. Copy the day manually and adjust that block.',
        );
      if (!validClockRange(next, start, end)) throw unavailable();
      const copy = {
        ...block,
        id: crypto.randomUUID(),
        completed: false,
        startAt: atMinute(next, start),
        endAt: atMinute(next, end),
      };
      if (data.preferences.timeZone) {
        const stored = storeBlock(copy, data.preferences.timeZone);
        const restored = displayBlock(stored, data.preferences.timeZone);
        if (
          restored.startAt !== copy.startAt ||
          restored.endAt !== copy.endAt ||
          stored.endAt <= stored.startAt ||
          stored.endAt - stored.startAt > 86400000
        )
          throw unavailable();
      }
      return copy;
    }),
    days: Object.fromEntries(from.map((day, i) => [to[i], { ...dayConfig(data, day) }])),
  };
}

export function rollLocalWeek(data: PlannerData, week: string): PlannerData {
  if (data.weeks?.[week]) return data;
  const next = { ...data, weeks: { ...data.weeks, [week]: true as const } };
  const end = shiftDate(week, 7);
  const occupied = [
    ...Object.keys(data.days),
    ...data.blocks.map((b) => dateKey(new Date(b.startAt))),
  ];
  if (occupied.some((day) => day >= week && day < end)) return next;
  const source = [
    ...Object.keys(data.weeks ?? {}),
    ...occupied.map((day) => weekOf(day, data.preferences.weekStart)),
  ]
    .filter((day) => day < week)
    .sort()
    .at(-1);
  if (!source) return next;
  const copied = copyWeek(data, source, week);
  return {
    ...next,
    blocks: [...data.blocks, ...copied.blocks],
    days: { ...data.days, ...copied.days },
  };
}
