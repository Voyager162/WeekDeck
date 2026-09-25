import { expect, test } from 'vitest';
import {
  blockEvents,
  weeklyEvents,
  nextOccurrence,
  validSubscription,
  validTimezone,
  type Settings,
} from '../src/plan';
const settings: Settings = {
  planning: true,
  day: 0,
  time: 540,
  advanced: false,
  end: 660,
  interval: 30,
  transitions: true,
  lead: 0,
};
const now = Date.parse('2026-09-25T12:00:00Z');
test('weekly planning uses the receiving device timezone', () => {
  const event = weeklyEvents(settings, 'America/Los_Angeles', now)[0];
  expect(new Date(event.at).toISOString()).toBe('2026-09-27T16:00:00.000Z');
  expect(event.body).toBe('Plan the week ahead.');
});
test('weekly reminders retain the wall clock time across daylight saving', () => {
  const first = weeklyEvents(
    settings,
    'America/Los_Angeles',
    Date.parse('2026-10-24T12:00:00Z'),
  )[0];
  expect(new Date(first.at).toISOString()).toBe('2026-10-25T16:00:00.000Z');
  expect(new Date(nextOccurrence(first.cron!, 'America/Los_Angeles', first.at)).toISOString()).toBe(
    '2026-11-01T17:00:00.000Z',
  );
});
test('advanced intervals include both boundaries and remain capped', () => {
  expect(weeklyEvents({ ...settings, advanced: true }, 'UTC', now)).toHaveLength(5);
  expect(
    weeklyEvents({ ...settings, advanced: true, end: 1439, interval: 15 }, 'UTC', now),
  ).toHaveLength(17);
});
test('disabled settings produce no reminders', () => {
  expect(weeklyEvents({ ...settings, planning: false }, 'UTC', now)).toEqual([]);
  expect(blockEvents([], { ...settings, transitions: false }, now)).toEqual([]);
});
test('adjacent blocks generate one transition, completed blocks none', () => {
  const blocks = [
    { id: 'a', title: 'Work', startAt: now + 60000, endAt: now + 3600000, completed: false },
    { id: 'b', title: 'Rest', startAt: now + 3600000, endAt: now + 7200000, completed: false },
    { id: 'c', title: 'Done', startAt: now + 9000000, endAt: now + 9500000, completed: true },
  ];
  const events = blockEvents(blocks, settings, now);
  expect(events).toHaveLength(3);
  expect(events.filter((e) => e.at === blocks[1].startAt)).toHaveLength(1);
  expect(events.map((e) => e.title)).toEqual(['Work', 'Rest', 'Rest is finished']);
  expect(blockEvents(blocks, settings, now)[0].key).toBe(events[0].key);
});
test('advance starts and the 14 day horizon are enforced', () => {
  const block = {
    id: 'a',
    title: 'Work',
    startAt: now + 600000,
    endAt: now + 3600000,
    completed: false,
  };
  expect(blockEvents([block], { ...settings, lead: 5 }, now)[0].at).toBe(now + 300000);
  expect(
    blockEvents(
      [{ ...block, startAt: now + 15 * 86400000, endAt: now + 16 * 86400000 }],
      settings,
      now,
    ),
  ).toEqual([]);
});
test('subscription validation prevents private-network requests and redirects', () => {
  const sub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
  };
  expect(validSubscription(sub)).toBe(true);
  for (const endpoint of [
    'http://fcm.googleapis.com/a',
    'https://127.0.0.1/a',
    'https://fcm.googleapis.com.evil.test/a',
    'https://fcm.googleapis.com:8443/a',
    'https://user:pass@fcm.googleapis.com/a',
    'https://example.com/a',
  ])
    expect(validSubscription({ ...sub, endpoint })).toBe(false);
  expect(validSubscription({ ...sub, keys: { ...sub.keys, auth: 'bad' } })).toBe(false);
  expect(validSubscription(null)).toBe(false);
});
test('timezone validation rejects malformed values', () => {
  expect(validTimezone('America/Los_Angeles')).toBe(true);
  expect(validTimezone('Bad/Timezone')).toBe(false);
  expect(validTimezone({})).toBe(false);
});
