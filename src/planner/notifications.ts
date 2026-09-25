import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { firebase } from '../firebase';
import type { Preferences } from './model';
import {
  clearDeviceReminders,
  deviceSupport,
  registerWebApp,
  reminderRequest,
  reminderService,
} from '../pwa';

export function useNotifications(
  uid: string | undefined,
  settings: Preferences['notifications'],
  ready: boolean,
) {
  const [refresh, setRefresh] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const support = deviceSupport();
  const [status, setStatus] = useState('');
  const unavailable = !reminderService
    ? 'Background reminders are awaiting server setup.'
    : !uid
      ? 'Sign in to enable reminders.'
      : support;
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') setRefresh((n) => n + 1);
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
    };
  }, []);
  useEffect(() => {
    if (!uid || !reminderService || support) return;
    let cancelled = false;
    void (async () => {
      const worker = await registerWebApp();
      const subscription = await worker?.pushManager.getSubscription();
      if (cancelled) return;
      if (subscription && localStorage.getItem('weekdeck-push-account') !== uid) {
        await clearDeviceReminders();
        return;
      }
      setEnabled(!!subscription && Notification.permission === 'granted');
      if (subscription && Notification.permission === 'granted')
        await reminderRequest('/subscribe', {
          subscription: subscription.toJSON(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      setStatus(
        Notification.permission === 'denied'
          ? 'Notifications are blocked in device settings.'
          : subscription
            ? 'Enabled on this device'
            : 'Not enabled on this device',
      );
    })().catch(() => {
      if (!cancelled) setStatus('Could not check this device. Reopen Weekdeck and try again.');
    });
    return () => {
      cancelled = true;
    };
  }, [uid, refresh, support]);
  useEffect(() => {
    if (!firebase || !uid || !reminderService || !ready) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let attempts = 0;
    const sync = async () => {
      try {
        await reminderRequest('/sync');
        if (!cancelled) {
          attempts = 0;
          setStatus((old) => (old.startsWith('Reminder sync') ? 'Reminders updated' : old));
        }
      } catch {
        if (!cancelled) {
          setStatus('Reminder sync failed. Your planner is still saved.');
          if (++attempts <= 3) timer = setTimeout(() => void sync(), attempts * 5000);
        }
      }
    };
    const now = Date.now();
    const unsubscribe = onSnapshot(
      query(
        collection(firebase.db, 'users', uid, 'blocks'),
        where('startAt', '>=', now - 86400_000),
        where('startAt', '<', now + 14 * 86400_000),
        orderBy('startAt'),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
        clearTimeout(timer);
        timer = setTimeout(() => void sync(), 2000);
      },
      () => setStatus('Reminder sync failed. Check your connection.'),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [uid, settings, ready, refresh]);
  async function request() {
    if (unavailable) return;
    setBusy(true);
    try {
      // iOS requires the permission call directly inside the user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('Notifications are blocked in device settings.');
        return;
      }
      const worker = await registerWebApp();
      if (!worker) throw new Error('Could not install the web app.');
      const response = await fetch(`${reminderService}/config`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Reminder service unavailable.');
      const config = (await response.json()) as { ready: boolean; publicKey: string };
      if (!config.ready) throw new Error('Background reminders are awaiting server setup.');
      const key = Uint8Array.from(
        atob(config.publicKey.replaceAll('-', '+').replaceAll('_', '/')),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        (await worker.pushManager.getSubscription()) ??
        (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await reminderRequest('/subscribe', {
        subscription: subscription.toJSON(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      localStorage.setItem('weekdeck-push-account', uid!);
      setEnabled(true);
      setStatus('Enabled on this device');
    } catch (error) {
      await clearDeviceReminders().catch(() => {});
      setEnabled(false);
      setStatus(error instanceof Error ? error.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      await clearDeviceReminders(true);
      setEnabled(false);
      setStatus('Not enabled on this device');
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    try {
      const subscription = await (await registerWebApp())?.pushManager.getSubscription();
      if (!subscription) throw new Error('Enable this device first.');
      await reminderRequest('/test', { endpoint: subscription.endpoint });
      setStatus('Test sent. Check your notifications.');
    } finally {
      setBusy(false);
    }
  }
  return {
    status: support || unavailable || status,
    enabled,
    busy,
    request,
    disable,
    test,
    canEnable: !unavailable,
  };
}
