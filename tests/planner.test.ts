import { describe, expect, it } from 'vitest';
import {
  atMinute,
  blockFromSlot,
  clockLabel,
  defaultDay,
  defaultPreferences,
  fitSlot,
  minuteAt,
  resizeSlot,
  validSlot,
  validClockRange,
  weekDates,
  weekOf,
} from '../src/planner/model';
import { notificationPlan } from '../src/planner/notificationPlan';

const day = '2026-09-21';
const block = (start: number, end: number) => blockFromSlot('Work', 'blue', { day, start, end });
describe('weekly scheduling', () => {
  it('starts on Monday or Sunday across month and year boundaries', () => {
    expect(weekOf('2027-01-01')).toBe('2026-12-28');
    expect(weekOf('2027-01-01', 0)).toBe('2026-12-27');
    expect(weekDates('2026-12-28').at(-1)).toBe('2027-01-03');
  });
  it('converts local clock values including midnight boundaries', () => {
    expect(minuteAt(atMinute(day, 555), day)).toBe(555);
    expect(minuteAt(atMinute(day, 1440), day)).toBe(1440);
    expect(clockLabel(0)).toBe('12 AM');
    expect(clockLabel(780)).toBe('1 PM');
    expect(clockLabel(555, '24')).toBe('09:15');
  });
  it('defaults to an hour and snaps to the chosen interval', () => {
    expect(fitSlot(day, 549, 60, defaultDay, [])).toEqual({ day, start: 555, end: 615 });
  });
  it('auto fits into a shorter gap', () => {
    expect(fitSlot(day, 607, 60, defaultDay, [block(540, 600), block(630, 690)])).toEqual({
      day,
      start: 600,
      end: 630,
    });
  });
  it('will not jump past occupied time or accept tiny gaps', () => {
    expect(fitSlot(day, 560, 60, defaultDay, [block(540, 600)])).toBeNull();
    expect(fitSlot(day, 601, 60, defaultDay, [block(540, 600), block(603, 660)])).toBeNull();
    expect(fitSlot(day, 600, 60, { ...defaultDay, enabled: false }, [])).toBeNull();
  });
  it('fits the trailing edge inside the day', () => {
    expect(fitSlot(day, 1015, 60, defaultDay, [])).toEqual({ day, start: 960, end: 1020 });
  });
  it('can move a block into its own former time', () => {
    const b = block(540, 600);
    expect(fitSlot(day, 555, 60, defaultDay, [b], 15, b.id)).toEqual({ day, start: 555, end: 615 });
  });
  it('resizing stops at neighbors and preserves minimum duration', () => {
    const b = block(630, 690),
      blocks = [block(540, 600), b, block(720, 780)];
    expect(resizeSlot(b, 'start', 570, defaultDay, blocks, 15).start).toBe(600);
    expect(resizeSlot(b, 'end', 800, defaultDay, blocks, 15).end).toBe(720);
    expect(resizeSlot(b, 'end', 600, defaultDay, blocks, 15).end).toBe(635);
    expect(resizeSlot(b, 'start', 800, defaultDay, blocks, 15).start).toBe(685);
  });
  it('allows adjacent blocks but rejects overlaps, invalid numbers and out-of-range times', () => {
    const blocks = [block(600, 660)];
    expect(validSlot(day, 540, 600, defaultDay, blocks)).toBe(true);
    for (const [a, b] of [
      [540, 615],
      [500, 550],
      [990, 1040],
      [600, 600],
      [NaN, 600],
    ])
      expect(validSlot(day, a, b, defaultDay, blocks)).toBe(false);
  });
  it('rejects nonexistent clock times across a spring daylight-saving transition', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(validClockRange('2026-03-08', 120, 180)).toBe(false);
      expect(validClockRange('2026-03-08', 90, 210)).toBe(true);
      expect(validClockRange('2026-11-01', 0, 1440)).toBe(false);
      expect(fitSlot('2026-03-08', 135, 30, { enabled: true, start: 0, end: 1440 }, [])).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
describe('device reminder schedule', () => {
  const now = atMinute(day, 0);
  it('does not schedule disabled reminders', () => {
    expect(notificationPlan([block(540, 600)], defaultPreferences.notifications, now)).toEqual([]);
  });
  it('repeats weekly at a single chosen time', () => {
    const plan = notificationPlan(
      [],
      { ...defaultPreferences.notifications, planning: true, day: 1, time: 600 },
      now,
    );
    expect(plan.map((p) => p.at)).toEqual([atMinute(day, 600)]);
    expect(plan[0].repeat).toEqual({ weekday: 2, hour: 10, minute: 0 });
  });
  it('advanced reminders include the start and each interval through the end', () => {
    const plan = notificationPlan(
      [],
      {
        ...defaultPreferences.notifications,
        planning: true,
        day: 1,
        advanced: true,
        time: 600,
        end: 660,
        interval: 30,
      },
      now,
    );
    expect(plan.slice(0, 3).map((p) => p.at)).toEqual([600, 630, 660].map((m) => atMinute(day, m)));
    expect(plan).toHaveLength(3);
  });
  it('does not send past reminders and does not double-alert contiguous blocks', () => {
    const plan = notificationPlan(
      [block(540, 600), block(600, 660)],
      { ...defaultPreferences.notifications, transitions: true },
      atMinute(day, 570),
    );
    expect(plan.map((p) => p.at)).toEqual([atMinute(day, 600), atMinute(day, 660)]);
  });
  it('honors advance reminders and ignores completed blocks', () => {
    const b = { ...block(660, 720), completed: true };
    const plan = notificationPlan(
      [block(540, 600), b],
      { ...defaultPreferences.notifications, transitions: true, lead: 5 },
      now,
    );
    expect(plan[0].at).toBe(atMinute(day, 535));
    expect(plan).toHaveLength(2);
  });
  it('caps pending reminders below the iOS limit with unique identifiers', () => {
    const blocks = Array.from({ length: 80 }, (_, i) => block(i * 15, i * 15 + 5));
    const plan = notificationPlan(
      blocks,
      { ...defaultPreferences.notifications, transitions: true },
      now,
    );
    expect(plan).toHaveLength(60);
    expect(new Set(plan.map((p) => p.id)).size).toBe(60);
    expect(plan.every((p, i) => i === 0 || p.at >= plan[i - 1].at)).toBe(true);
  });
  it('reserves recurring reminders even when the block queue is full', () => {
    const plan = notificationPlan(
      Array.from({ length: 80 }, (_, i) => block(i * 15, i * 15 + 5)),
      {
        ...defaultPreferences.notifications,
        transitions: true,
        planning: true,
        day: 0,
        advanced: true,
      },
      now,
    );
    expect(plan).toHaveLength(60);
    expect(plan.filter((p) => p.repeat)).toHaveLength(5);
  });
  it('rolls elapsed weekly slots into next week', () => {
    const plan = notificationPlan(
      [],
      { ...defaultPreferences.notifications, planning: true, day: 1, time: 600 },
      atMinute(day, 601),
    );
    expect(plan[0].at).toBe(atMinute('2026-09-28', 600));
    expect(plan[0].repeat?.weekday).toBe(2);
  });
});
