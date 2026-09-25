import { describe, expect, it } from 'vitest';
import {
  dateKey,
  dayRange,
  localDateTime,
  shiftDate,
  validateBlock,
  type BlockInput,
} from '../src/domain';

const valid: BlockInput = {
  title: 'Focus',
  notes: '',
  category: 'focus',
  startAt: 1_800_000_000_000,
  endAt: 1_800_003_600_000,
  completed: false,
};
describe('schedule validation', () => {
  it('accepts a valid block', () => expect(validateBlock(valid)).toBeNull());
  it.each([
    { title: '   ' },
    { title: 'x'.repeat(121) },
    { notes: 'x'.repeat(2001) },
    { startAt: NaN },
    { endAt: valid.startAt },
    { endAt: valid.startAt - 1 },
    { endAt: valid.startAt + 86_400_001 },
    { category: 'invalid' },
  ])('rejects invalid input %j', (patch) =>
    expect(validateBlock({ ...valid, ...patch } as BlockInput)).not.toBeNull(),
  );
  it('round trips local wall time without interpreting it as UTC', () => {
    const date = new Date(2026, 8, 24, 9, 30);
    expect(localDateTime(date.getTime())).toBe('2026-09-24T09:30');
    expect(dateKey(date)).toBe('2026-09-24');
  });
  it('navigates across month and year boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('constructs calendar day boundaries', () => {
    const [start, end] = dayRange('2026-03-08');
    expect(dateKey(new Date(start))).toBe('2026-03-08');
    expect(dateKey(new Date(end))).toBe('2026-03-09');
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(end).getHours()).toBe(0);
  });
});
