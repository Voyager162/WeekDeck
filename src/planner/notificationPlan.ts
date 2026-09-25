import type { Block } from '../domain';
import { dateKey, shiftDate } from '../domain';
import { atMinute, type Preferences } from './model';

export type Reminder = {
  id: number;
  title: string;
  body: string;
  at: number;
  repeat?: { weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; hour: number; minute: number };
};
export function notificationPlan(
  blocks: Block[],
  settings: Preferences['notifications'],
  now: number,
): Reminder[] {
  const events: Omit<Reminder, 'id'>[] = [];
  const weekly: Omit<Reminder, 'id'>[] = [];
  const today = dateKey(new Date(now));
  const horizon = atMinute(shiftDate(today, 14), 0);
  if (settings.planning) {
    const nextDay = shiftDate(today, (settings.day - new Date(now).getDay() + 7) % 7);
    const end = settings.advanced ? Math.min(settings.end, settings.time + 240) : settings.time;
    for (let minute = settings.time; minute <= end; minute += Math.max(15, settings.interval)) {
      const next = atMinute(nextDay, minute);
      weekly.push({
        at: next > now ? next : atMinute(shiftDate(nextDay, 7), minute),
        title: 'Weekly planning',
        body: 'Plan the week ahead.',
        repeat: {
          weekday: (settings.day + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          hour: Math.floor(minute / 60),
          minute: minute % 60,
        },
      });
    }
  }
  if (settings.transitions) {
    const active = blocks.filter((b) => !b.completed);
    for (const block of active) {
      const at = block.startAt - settings.lead * 60_000;
      if (at > now && at < horizon)
        events.push({
          at,
          title: block.title,
          body: settings.lead ? `Starts in ${settings.lead} minutes.` : 'Time for your next block.',
        });
      if (
        block.endAt > now &&
        block.endAt < horizon &&
        !active.some((next) => next.startAt === block.endAt)
      )
        events.push({
          at: block.endAt,
          title: `${block.title} is finished`,
          body: 'Your scheduled block has ended.',
        });
    }
  }
  // Reserve room for repeating weekly reminders before filling the rolling block queue.
  return [...weekly, ...events.sort((a, b) => a.at - b.at).slice(0, 60 - weekly.length)]
    .sort((a, b) => a.at - b.at)
    .map((event, i) => ({ ...event, id: 700_000 + i }));
}
