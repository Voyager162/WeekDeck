import { describe, expect, it } from 'vitest';
import {
  atMinute,
  blockFromSlot,
  clockLabel,
  defaultDay,
  defaultPreferences,
  dayConfig,
  emptyPlanner,
  fitSlot,
  minuteAt,
  resizeSlot,
  validSlot,
  validClockRange,
  weekDates,
  weekOf,
} from '../src/planner/model';
import { captureDay, dayChanges, pasteDays, settingsChanges } from '../src/planner/changes';
import type { Change } from '../src/planner/store';
import type { PlannerData } from '../src/planner/model';
import { notificationPlan } from '../src/planner/notificationPlan';

const day = '2026-09-21';
const block = (start: number, end: number) => blockFromSlot('Work', 'blue', { day, start, end });
function applyChanges(data: PlannerData, changes: Change[]): PlannerData {
  const next = structuredClone(data);
  for (const change of changes) {
    if (change.kind === 'settings') next.preferences = change.after as PlannerData['preferences'];
    if (change.kind === 'days') {
      if (change.after) next.days[change.id] = change.after as PlannerData['days'][string];
      else delete next.days[change.id];
    }
    if (change.kind === 'blocks') {
      next.blocks = next.blocks.filter((block) => block.id !== change.id);
      if (change.after) next.blocks.push(change.after as PlannerData['blocks'][number]);
    }
  }
  return next;
}
function shared(data: PlannerData, start = 480, end = 1080) {
  return applyChanges(
    data,
    settingsChanges(data, {
      ...data.preferences,
      dayHours: { start, end, linked: true, version: '' },
    }),
  );
}
describe('shared hours and day clipboard', () => {
  it('copies both boundaries through the non-replacing copy path on an empty day', () => {
    const data = emptyPlanner();
    data.days[day] = { enabled: true, start: 600, end: 1080 };
    const next = applyChanges(data, pasteDays(data, captureDay(data, day), ['2026-09-22'], false));
    expect(dayConfig(next, '2026-09-22')).toMatchObject({ start: 600, end: 1080 });
  });
  it('does not silently crop retained blocks when copying a narrower day', () => {
    const data = emptyPlanner();
    data.days['2026-09-22'] = { enabled: true, start: 600, end: 1080 };
    data.blocks = [block(540, 600)];
    const clip = captureDay(data, '2026-09-22');
    expect(() => pasteDays(data, clip, [day], false)).toThrow('outside the copied hours');
    expect(data.blocks).toHaveLength(1);
    const next = applyChanges(data, pasteDays(data, clip, [day], true));
    expect(next.blocks).toHaveLength(0);
    expect(dayConfig(next, day)).toMatchObject({ start: 600, end: 1080 });
  });
  it('keeps legacy hours until a shared range replaces all weeks, including hidden days', () => {
    const data = emptyPlanner();
    data.days[day] = { enabled: true, start: 600, end: 900 };
    data.days['2027-01-04'] = { enabled: false, start: 720, end: 1440 };
    expect(dayConfig(data, day).start).toBe(600);
    const next = shared(data);
    for (const date of [day, '2027-01-04', '2028-02-01'])
      expect(dayConfig(next, date)).toMatchObject({ start: 480, end: 1080 });
    expect(dayConfig(next, '2027-01-04').enabled).toBe(false);
  });
  it('detaches only the edited day, persists other hours, and undoes both changes together', () => {
    const data = shared(emptyPlanner());
    const changes = dayChanges(data, { [day]: { enabled: true, start: 600, end: 1080 } });
    expect(changes).toHaveLength(2);
    const next = applyChanges(data, changes);
    expect(next.preferences.dayHours?.linked).toBe(false);
    expect(dayConfig(next, day).start).toBe(600);
    expect(dayConfig(next, '2026-10-01').start).toBe(480);
    const undo = applyChanges(
      next,
      changes.map((c) => ({ ...c, before: c.after, after: c.before })),
    );
    expect(undo.preferences.dayHours?.linked).toBe(true);
    expect(dayConfig(undo, day).start).toBe(480);
  });
  it('reapplying hours supersedes old overrides without bringing them back on unlink', () => {
    const first = shared(emptyPlanner());
    const detached = applyChanges(
      first,
      dayChanges(first, { [day]: { enabled: true, start: 600, end: 1080 } }),
    );
    const next = shared(detached, 420, 1020);
    expect(next.preferences.dayHours?.version).not.toBe(first.preferences.dayHours?.version);
    const unlinked = applyChanges(
      next,
      dayChanges(next, { '2026-09-22': { enabled: true, start: 480, end: 1020 } }),
    );
    expect(dayConfig(unlinked, day).start).toBe(420);
    expect(dayConfig(unlinked, '2027-01-04').start).toBe(420);
  });
  it('hiding, restoring, or saving unchanged hours does not detach the master', () => {
    const data = shared(emptyPlanner());
    const changes = dayChanges(data, { [day]: { ...dayConfig(data, day), enabled: false } });
    expect(changes).toHaveLength(1);
    expect(applyChanges(data, changes).preferences.dayHours?.linked).toBe(true);
  });
  it('validates shared ranges and preserves existing blocks outside new hours', () => {
    const data = emptyPlanner();
    data.blocks = [block(540, 600)];
    expect(shared(data, 720, 1020).blocks).toEqual(data.blocks);
    for (const [start, end] of [
      [-1, 600],
      [600, 610],
      [540, 1441],
      [NaN, 600],
      [540.5, 600],
    ])
      expect(() => shared(data, start, end)).toThrow('End time');
    const toggled = settingsChanges(data, {
      ...data.preferences,
      dayHours: { start: 540, end: 1020, linked: false, version: '' },
    });
    expect(applyChanges(data, toggled).preferences.dayHours).toBeUndefined();
  });
  it('copies a stable snapshot and replaces targets with new IDs and reset completion', () => {
    const data = emptyPlanner();
    data.blocks = [{ ...block(540, 600), completed: true, notes: 'Keep notes' }];
    const clip = captureDay(data, day);
    data.blocks[0].title = 'Changed later';
    const changes = pasteDays(data, clip, [day, '2026-09-22', '2026-09-22'], true);
    const next = applyChanges(data, changes);
    expect(next.blocks).toHaveLength(2);
    expect(new Set(next.blocks.map((b) => b.id)).size).toBe(2);
    for (const b of next.blocks)
      expect(b).toMatchObject({ title: 'Work', completed: false, notes: 'Keep notes' });
    const restored = applyChanges(
      next,
      changes.map((c) => ({ ...c, after: c.before, before: c.after })),
    );
    expect(restored.blocks).toEqual(data.blocks);
  });
  it('detaches shared hours when pasting different hours and can copy empty days', () => {
    const clip = captureDay(emptyPlanner(), day);
    const data = shared(emptyPlanner());
    data.blocks = [block(540, 600)];
    const next = applyChanges(data, pasteDays(data, clip, [day], true));
    expect(next.blocks).toHaveLength(0);
    expect(next.preferences.dayHours?.linked).toBe(false);
    expect(dayConfig(next, day)).toMatchObject({ start: 540, end: 1020 });
    expect(dayConfig(next, '2026-09-22')).toMatchObject({ start: 480, end: 1080 });
  });
  it('rejects a nonexistent destination time without producing partial changes', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      const data = emptyPlanner();
      data.blocks = [block(120, 180)];
      expect(() =>
        pasteDays(data, captureDay(data, day), ['2026-03-09', '2026-03-08'], true),
      ).toThrow('unavailable');
      expect(data.blocks).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
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
