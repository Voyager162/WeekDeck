import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useEffect: vi.fn(),
  cancel: vi.fn(async () => {}),
  getPending: vi.fn(async () => ({
    notifications: [{ id: 700_000 }, { id: 700_099 }, { id: 42 }],
  })),
}));
vi.mock('react', () => ({ useEffect: mocks.useEffect, useState: () => [[], vi.fn()] }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));
vi.mock('@capacitor/app', () => ({ App: {} }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: mocks }));
vi.mock('../src/firebase', () => ({ firebase: null }));
import { clearNativeReminders, useNotifications } from '../src/planner/notifications';
import { defaultPreferences } from '../src/planner/model';

beforeEach(() => vi.clearAllMocks());

test('navigating away from the planner retains scheduled native reminders', async () => {
  useNotifications('test-user', [], defaultPreferences.notifications, false);
  const createCleanup = mocks.useEffect.mock.calls.at(-1)![0];
  const unmount = createCleanup();
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mocks.getPending).not.toHaveBeenCalled();
  expect(mocks.cancel).not.toHaveBeenCalled();
});

test('explicit sign-out/deletion cleanup cancels only Weekdeck-owned reminders', async () => {
  await clearNativeReminders();
  expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 700_000 }, { id: 700_099 }] });
});

test('cleanup leaves other notification IDs alone', async () => {
  mocks.getPending.mockResolvedValueOnce({ notifications: [{ id: 42 }] });
  await clearNativeReminders();
  expect(mocks.cancel).not.toHaveBeenCalled();
});
