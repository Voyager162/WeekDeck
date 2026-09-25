import { signOut } from 'firebase/auth';
import { firebase } from './firebase';

export const reminderService = (import.meta.env.VITE_REMINDER_URL ?? '').replace(/\/$/, '');
let registration: Promise<ServiceWorkerRegistration> | undefined;
export function registerWebApp() {
  if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol))
    return undefined;
  registration ??= navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready)
    .catch((error) => {
      registration = undefined;
      throw error;
    });
  return registration;
}
export function deviceSupport() {
  const iphone =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone;
  if (iphone && !standalone) return 'Open in Safari, then Share > Add to Home Screen.';
  if (!['https:', 'http:'].includes(location.protocol))
    return 'Enable phone reminders from the web app.';
  if (
    !isSecureContext ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  )
    return 'Web notifications are not supported by this browser.';
  return null;
}
export async function reminderRequest(path: string, body: unknown = {}, method = 'POST') {
  const user = firebase?.auth.currentUser;
  if (!reminderService || !user) throw new Error('Sign in to use reminders.');
  const response = await fetch(`${reminderService}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || 'Reminder service unavailable. Try again.');
  }
  return response.json() as Promise<{ ok: boolean; devices?: number; through?: number }>;
}
export async function clearDeviceReminders(remote = false) {
  if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol)) return;
  const worker = await navigator.serviceWorker.getRegistration('/');
  const subscription = await worker?.pushManager?.getSubscription();
  if (subscription) {
    if (remote && reminderService && firebase?.auth.currentUser)
      await reminderRequest('/device', { endpoint: subscription.endpoint }, 'DELETE').catch(
        () => {},
      );
    await subscription.unsubscribe();
  }
  for (const notification of (await worker?.getNotifications?.()) ?? []) notification.close();
  localStorage.removeItem('weekdeck-push-account');
}
export async function signOutWithReminders() {
  await clearDeviceReminders(true);
  if (firebase) await signOut(firebase.auth);
}
