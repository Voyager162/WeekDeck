export const categories = {
  focus: { label: 'Focus', color: '#147d67' },
  meeting: { label: 'Meeting', color: '#4764be' },
  personal: { label: 'Personal', color: '#b05878' },
  break: { label: 'Break', color: '#9c7217' },
};
export type Category = keyof typeof categories;
export type BlockInput = {
  title: string;
  notes: string;
  category: Category;
  startAt: number;
  endAt: number;
  completed: boolean;
};
export type Block = BlockInput & { id: string };

export function validateBlock(block: BlockInput): string | null {
  if (!block.title.trim() || block.title.length > 120)
    return 'Enter a title between 1 and 120 characters.';
  if (block.notes.length > 2000) return 'Notes can contain up to 2,000 characters.';
  if (!Object.hasOwn(categories, block.category)) return 'Choose a category.';
  if (
    !Number.isSafeInteger(block.startAt) ||
    !Number.isSafeInteger(block.endAt) ||
    block.startAt < 0
  )
    return 'Choose valid start and end times.';
  if (block.endAt <= block.startAt) return 'End time must be after start time.';
  if (block.endAt - block.startAt > 86_400_000) return 'A block can be at most 24 hours long.';
  return null;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dayRange(key: string): [number, number] {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}
export function shiftDate(key: string, amount: number): string {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}
export function localDateTime(ms: number): string {
  const date = new Date(ms);
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function durationLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}
