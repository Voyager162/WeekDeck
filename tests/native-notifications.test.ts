import { describe, it, expect } from 'vitest';
import { nativeNotificationPlan } from '../src/planner/nativeNotificationPlan';
import { defaultPreferences, blockFromSlot } from '../src/planner/model';
describe('iPhone reminder queue', () => {
  it('reserves room for weekly intervals and avoids duplicate transitions', () => {
    const settings = {
      ...defaultPreferences.notifications,
      planning: true,
      advanced: true,
      time: 900,
      end: 1140,
      interval: 15,
      transitions: true,
    };
    const blocks = Array.from({ length: 80 }, (_, i) =>
      blockFromSlot('Work', 'blue', { day: '2030-01-07', start: i * 15, end: i * 15 + 15 }),
    );
    const plan = nativeNotificationPlan(blocks, settings, 0);
    expect(plan).toHaveLength(60);
    expect(plan.filter((n) => n.schedule?.repeats)).toHaveLength(17);
    expect(new Set(plan.map((n) => n.id)).size).toBe(60);
    expect(plan.filter((n) => n.title === 'Block complete')).toHaveLength(0);
  });
  it('does not queue completed, past, or disabled blocks', () => {
    const block = blockFromSlot('Work', 'blue', { day: '2020-01-01', start: 540, end: 600 });
    expect(
      nativeNotificationPlan([block], { ...defaultPreferences.notifications, transitions: true }),
    ).toHaveLength(0);
    expect(
      nativeNotificationPlan(
        [{ ...block, completed: true }],
        { ...defaultPreferences.notifications, transitions: true },
        0,
      ),
    ).toHaveLength(0);
  });
});
