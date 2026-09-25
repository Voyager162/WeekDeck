import { CronExpressionParser } from 'cron-parser';

export type Settings = {
  planning: boolean;
  day: number;
  time: number;
  advanced: boolean;
  end: number;
  interval: number;
  transitions: boolean;
  lead: number;
};
export type Block = {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  completed: boolean;
};
export type Event = { key: string; at: number; title: string; body: string; cron?: string };
export const HORIZON = 14 * 86400_000;
export const STALE_AFTER = 5 * 60_000;

export function blockEvents(
  blocks: Block[],
  settings: Settings,
  now: number,
  since = now,
): Event[] {
  if (!settings.transitions) return [];
  const active = blocks.filter((b) => !b.completed);
  const starts = new Set(active.map((b) => b.startAt));
  const events: Event[] = [];
  for (const block of active) {
    const at = block.startAt - settings.lead * 60_000;
    if (at > since && at < now + HORIZON)
      events.push({
        key: `start:${block.id}:${at}`,
        at,
        title: block.title,
        body: settings.lead ? `Starts in ${settings.lead} minutes.` : 'Time for your next block.',
      });
    if (block.endAt > since && block.endAt < now + HORIZON && !starts.has(block.endAt))
      events.push({
        key: `end:${block.id}:${block.endAt}`,
        at: block.endAt,
        title: `${block.title} is finished`,
        body: 'Your scheduled block has ended.',
      });
  }
  return events.sort((a, b) => a.at - b.at);
}
export function nextOccurrence(cron: string, timezone: string, now: number) {
  return CronExpressionParser.parse(cron, { currentDate: new Date(now), tz: timezone })
    .next()
    .getTime();
}
export function weeklyEvents(settings: Settings, timezone: string, now: number): Event[] {
  if (!settings.planning) return [];
  const end = settings.advanced ? Math.min(settings.end, settings.time + 240) : settings.time;
  const events: Event[] = [];
  for (let minute = settings.time; minute <= end; minute += Math.max(15, settings.interval)) {
    const cron = `${minute % 60} ${Math.floor(minute / 60)} * * ${settings.day}`;
    events.push({
      key: `weekly:${minute}`,
      at: nextOccurrence(cron, timezone, now),
      cron,
      title: 'Weekly planning',
      body: 'Plan the week ahead.',
    });
  }
  return events;
}

export function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function validSubscription(value: unknown): value is {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
} {
  if (!value || typeof value !== 'object') return false;
  const sub = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048) return false;
  try {
    const url = new URL(sub.endpoint);
    const allowed =
      url.hostname === 'fcm.googleapis.com' ||
      url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.push.services.mozilla.com') ||
      url.hostname.endsWith('.push.apple.com');
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      !allowed
    )
      return false;
  } catch {
    return false;
  }
  return (
    typeof sub.keys?.p256dh === 'string' &&
    /^[A-Za-z0-9_-]{87}={0,1}$/.test(sub.keys.p256dh) &&
    typeof sub.keys.auth === 'string' &&
    /^[A-Za-z0-9_-]{22}={0,2}$/.test(sub.keys.auth)
  );
}
