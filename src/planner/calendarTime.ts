import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { Block } from '../domain';

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
// Storage retains one account calendar zone; the planner shows floating local clock times.
export function displayBlock(block: Block, zone: string): Block {
  return {
    ...block,
    startAt: toZonedTime(block.startAt, zone).getTime(),
    endAt: toZonedTime(block.endAt, zone).getTime(),
  };
}
export function storeBlock(block: Block, zone: string): Block {
  return {
    ...block,
    startAt: fromZonedTime(new Date(block.startAt), zone).getTime(),
    endAt: fromZonedTime(new Date(block.endAt), zone).getTime(),
  };
}
export function calendarMidnight(day: string, zone: string): number {
  return fromZonedTime(`${day}T00:00:00`, zone).getTime();
}
