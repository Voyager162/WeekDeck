import { beforeEach, afterEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), getRegistration: vi.fn(), fetch: vi.fn() }));
vi.mock('../src/firebase', () => ({ firebase: { auth: { currentUser: null } } }));
vi.mock('firebase/auth', () => ({ signOut: mocks.signOut }));
import { clearDeviceReminders, deviceSupport, signOutWithReminders } from '../src/pwa';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', {
    userAgent: 'Chrome',
    platform: 'Win32',
    maxTouchPoints: 0,
    serviceWorker: { getRegistration: mocks.getRegistration },
  });
  vi.stubGlobal('location', { protocol: 'https:' });
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('window', { PushManager: {}, Notification: {} });
  vi.stubGlobal('localStorage', { removeItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

test('iPhone Safari requires Home Screen installation before permission prompts', () => {
  Object.assign(navigator, { userAgent: 'iPhone', platform: 'iPhone' });
  expect(deviceSupport()).toContain('Add to Home Screen');
  Object.assign(navigator, { standalone: true });
  expect(deviceSupport()).toBeNull();
});
test('desktop-mode iPads are detected', () => {
  Object.assign(navigator, { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 });
  expect(deviceSupport()).toContain('Add to Home Screen');
});
test('unsupported and insecure browsers cannot enable notifications', () => {
  vi.stubGlobal('window', {});
  expect(deviceSupport()).toContain('not supported');
  vi.stubGlobal('isSecureContext', false);
  expect(deviceSupport()).toContain('not supported');
});
test('Electron points users to the web app without attempting web push', () => {
  vi.stubGlobal('location', { protocol: 'timeblocker:' });
  expect(deviceSupport()).toContain('web app');
});
test('sign-out unsubscribes the device and closes displayed notifications', async () => {
  const unsubscribe = vi.fn(async () => true),
    close = vi.fn();
  mocks.getRegistration.mockResolvedValue({
    pushManager: { getSubscription: async () => ({ unsubscribe }) },
    getNotifications: async () => [{ close }],
  });
  await signOutWithReminders();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(localStorage.removeItem).toHaveBeenCalledWith('weekdeck-push-account');
});
test('failed unsubscribe does not silently sign out and leave active reminders', async () => {
  mocks.getRegistration.mockResolvedValue({
    pushManager: {
      getSubscription: async () => ({
        unsubscribe: async () => {
          throw Error('offline');
        },
      }),
    },
  });
  await expect(signOutWithReminders()).rejects.toThrow('offline');
  expect(mocks.signOut).not.toHaveBeenCalled();
});
test('cleanup is harmless for browsers without a registration', async () => {
  mocks.getRegistration.mockResolvedValue(undefined);
  await expect(clearDeviceReminders()).resolves.toBeUndefined();
});
test('browsers with service workers but no push API can still sign out', async () => {
  mocks.getRegistration.mockResolvedValue({});
  await signOutWithReminders();
  expect(mocks.signOut).toHaveBeenCalledOnce();
});
