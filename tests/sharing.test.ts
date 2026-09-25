import { expect, it, vi } from 'vitest';
vi.mock('../src/firebase', () => ({ firebase: null }));
import { schedulePreferences, validShareCalendar } from '../src/planner/sharing';
import { defaultPreferences } from '../src/planner/model';
const calendar = {
  week: '2026-09-21',
  endDay: '2026-09-28',
  startAt: Date.parse('2026-09-21T00:00Z'),
  endAt: Date.parse('2026-09-28T00:00Z'),
  timeZone: 'America/Los_Angeles',
};
it('projects layout without notification or personal appearance settings', () => {
  expect(Object.keys(schedulePreferences(defaultPreferences)).sort()).toEqual([
    'dayHours',
    'timeZone',
    'weekStart',
  ]);
});
it('accepts a normal week and daylight-saving week lengths', () => {
  expect(validShareCalendar(calendar)).toBe(true);
  expect(validShareCalendar({ ...calendar, endAt: calendar.endAt + 3600000 })).toBe(true);
  expect(validShareCalendar({ ...calendar, endAt: calendar.endAt - 3600000 })).toBe(true);
});
it.each([
  { timeZone: 'Not/AZone' },
  { week: '2026-02-30' },
  { week: 'no-date' },
  { endDay: '2026-10-28' },
  { endAt: Infinity },
  { startAt: -1 },
  { endAt: 1e20 },
])('rejects malformed shared calendar metadata %j', (patch) => {
  expect(validShareCalendar({ ...calendar, ...patch })).toBe(false);
});
