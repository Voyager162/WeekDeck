import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Block } from '../domain';
import type { Preferences } from './model';

export function nativeNotificationPlan(
  blocks: Block[],
  settings: Preferences['notifications'],
  now = Date.now(),
): LocalNotificationSchema[] {
  const weekly: LocalNotificationSchema[] = [];
  if (settings.planning) {
    const end = settings.advanced ? settings.end : settings.time;
    const interval = Math.max(15, settings.interval);
    for (
      let minute = settings.time;
      minute <= Math.min(end, settings.time + 240);
      minute += interval
    ) {
      weekly.push({
        id: 100 + weekly.length,
        title: 'Plan your week',
        body: 'Your next week starts with a plan.',
        schedule: {
          on: { weekday: settings.day + 1, hour: Math.floor(minute / 60), minute: minute % 60 },
          repeats: true,
        },
      });
    }
  }
  const events: { at: number; title: string; body: string }[] = [];
  if (settings.transitions) {
    const active = blocks.filter((b) => !b.completed);
    for (const block of active) {
      events.push({
        at: block.startAt - settings.lead * 60000,
        title: settings.lead ? `In ${settings.lead} minutes` : 'Time to switch',
        body: block.title,
      });
      if (!active.some((b) => b.startAt === block.endAt))
        events.push({ at: block.endAt, title: 'Block complete', body: block.title });
    }
  }
  // Leave capacity for a test notification; never silently exceed iOS's pending limit.
  return [
    ...weekly,
    ...events
      .filter((e) => e.at > now)
      .sort((a, b) => a.at - b.at)
      .slice(0, 60 - weekly.length)
      .map((event, index) => {
        const date = new Date(event.at);
        return {
          id: 1000 + index,
          title: event.title,
          body: event.body,
          schedule: {
            on: {
              year: date.getFullYear(),
              month: date.getMonth() + 1,
              day: date.getDate(),
              hour: date.getHours(),
              minute: date.getMinutes(),
            },
          },
        };
      }),
  ];
}
