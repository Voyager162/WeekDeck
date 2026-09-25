import type { Block } from '../domain';
import {
  atMinute,
  dayBlocks,
  dayConfig,
  minuteAt,
  validClockRange,
  validSlot,
  type DayConfig,
  type PlannerData,
  type Preferences,
} from './model';
import type { Change } from './store';

export function settingsChanges(data: PlannerData, preferences: Preferences): Change[] {
  const before = data.preferences.dayHours;
  const hours = preferences.dayHours;
  if (!before && hours && !hours.linked) {
    const { dayHours: _hours, ...after } = preferences;
    return [{ kind: 'settings', id: 'planner', before: data.preferences, after }];
  }
  if (
    hours &&
    (!Number.isInteger(hours.start) ||
      !Number.isInteger(hours.end) ||
      hours.start < 0 ||
      hours.end > 1440 ||
      hours.end - hours.start < 15)
  )
    throw new Error('End time must be at least 15 minutes after start.');
  const reapplied =
    hours?.linked && (!before?.linked || hours.start !== before.start || hours.end !== before.end);
  const after = reapplied
    ? { ...preferences, dayHours: { ...hours, version: crypto.randomUUID() } }
    : preferences;
  return [{ kind: 'settings', id: 'planner', before: data.preferences, after }];
}

export function dayChanges(data: PlannerData, configs: Record<string, DayConfig>): Change[] {
  const hours = data.preferences.dayHours;
  const changes: Change[] = Object.entries(configs).map(([day, config]) => ({
    kind: 'days',
    id: day,
    before: data.days[day],
    after: { ...config, ...(hours ? { hoursVersion: hours.version } : {}) },
  }));
  if (
    hours?.linked &&
    Object.entries(configs).some(([day, config]) => {
      const current = dayConfig(data, day);
      return config.start !== current.start || config.end !== current.end;
    })
  )
    changes.push({
      kind: 'settings',
      id: 'planner',
      before: data.preferences,
      after: { ...data.preferences, dayHours: { ...hours, linked: false } },
    });
  return changes;
}

export type DayClipboard = {
  config: Pick<DayConfig, 'start' | 'end'>;
  blocks: { block: Block; start: number; end: number }[];
};
export function captureDay(data: PlannerData, day: string): DayClipboard {
  const { start, end } = dayConfig(data, day);
  return {
    config: { start, end },
    blocks: dayBlocks(data.blocks, day).map((block) => ({
      block: { ...block },
      start: minuteAt(block.startAt, day),
      end: minuteAt(block.endAt, day),
    })),
  };
}

export function pasteDays(
  data: PlannerData,
  source: DayClipboard,
  targets: string[],
  replace: boolean,
): Change[] {
  const changes: Change[] = [];
  const configs: Record<string, DayConfig> = {};
  for (const target of new Set(targets)) {
    const existing = dayBlocks(data.blocks, target);
    const config = {
      enabled: true,
      start: source.config.start,
      end: source.config.end,
    };
    if (
      !replace &&
      existing.some(
        (block) =>
          minuteAt(block.startAt, target) < config.start ||
          minuteAt(block.endAt, target) > config.end,
      )
    )
      throw new Error(
        'Existing blocks fall outside the copied hours. Move them first or replace existing blocks.',
      );
    if (source.blocks.some(({ start, end }) => !validClockRange(target, start, end)))
      throw new Error('A copied time is unavailable on this date. Adjust that block first.');
    if (
      !replace &&
      source.blocks.some(({ start, end }) => !validSlot(target, start, end, config, existing))
    )
      throw new Error('Some blocks overlap. Choose another day or replace existing blocks.');
    if (replace)
      for (const block of existing) changes.push({ kind: 'blocks', id: block.id, before: block });
    for (const { block, start, end } of source.blocks) {
      const copy = {
        ...block,
        id: crypto.randomUUID(),
        completed: false,
        startAt: atMinute(target, start),
        endAt: atMinute(target, end),
      };
      changes.push({ kind: 'blocks', id: copy.id, after: copy });
    }
    configs[target] = config;
  }
  return [...changes, ...dayChanges(data, configs)];
}
