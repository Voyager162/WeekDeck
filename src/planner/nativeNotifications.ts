import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { collection, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import { firebase } from '../firebase';
import { nativeIOS } from '../native';
import type { Block } from '../domain';
import type { Preferences } from './model';
import { displayBlock, deviceTimeZone } from './calendarTime';
import { nativeNotificationPlan } from './nativeNotificationPlan';

const key = 'weekdeck-ios-reminders-account';
let queue = Promise.resolve();
let epoch = 0;
function serialize(action: () => Promise<void>) {
  const next = queue.then(action);
  queue = next.catch(() => {});
  return next;
}
async function cancelPending() {
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}
export async function clearNativeReminders() {
  if (!nativeIOS) return;
  epoch++;
  localStorage.removeItem(key);
  await serialize(async () => {
    await cancelPending();
    await LocalNotifications.removeAllDeliveredNotifications();
  });
}
export function useNativeNotifications(
  uid: string | undefined,
  preferences: Preferences,
  ready: boolean,
) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Not enabled on this iPhone');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!nativeIOS) return;
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) setRefresh((n) => n + 1);
    });
    void (async () => {
      if (localStorage.getItem(key) && localStorage.getItem(key) !== uid)
        await clearNativeReminders();
      const permission = await LocalNotifications.checkPermissions();
      const active = !!uid && localStorage.getItem(key) === uid && permission.display === 'granted';
      setEnabled(active);
      setStatus(
        permission.display === 'denied'
          ? 'Notifications are blocked in iPhone Settings.'
          : active
            ? 'Enabled on this iPhone'
            : 'Not enabled on this iPhone',
      );
    })().catch(() => setStatus('Could not check notification permission.'));
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [uid, refresh]);
  useEffect(() => {
    if (!nativeIOS || !uid || !enabled || !ready || !firebase) return;
    let disposed = false;
    const token = epoch;
    const unsubscribe = onSnapshot(
      query(
        collection(firebase.db, 'users', uid, 'blocks'),
        where('startAt', '>=', Date.now() - 2 * 86400000),
        where('startAt', '<', Date.now() + 32 * 86400000),
        orderBy('startAt'),
        limit(2500),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        const blocks = snapshot.docs.map((doc) =>
          displayBlock(
            { ...doc.data(), id: doc.id } as Block,
            preferences.timeZone ?? deviceTimeZone(),
          ),
        );
        void serialize(async () => {
          if (disposed || token !== epoch || localStorage.getItem(key) !== uid) return;
          const notifications = nativeNotificationPlan(blocks, preferences.notifications);
          await cancelPending();
          if (notifications.length) await LocalNotifications.schedule({ notifications });
          setStatus('Enabled on this iPhone');
        }).catch(() => setStatus('Reminders could not refresh. Reopen Weekdeck.'));
      },
      () => setStatus('Reminders could not sync. Reopen Weekdeck when online.'),
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [uid, enabled, ready, preferences, refresh]);
  async function request() {
    if (!uid) return;
    setBusy(true);
    try {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        setStatus('Notifications are blocked in iPhone Settings.');
        return;
      }
      localStorage.setItem(key, uid);
      setEnabled(true);
      setRefresh((n) => n + 1);
    } catch {
      setStatus('Could not enable reminders. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      await clearNativeReminders();
      setEnabled(false);
      setStatus('Not enabled on this iPhone');
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    if (!enabled) return;
    setBusy(true);
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 99,
            title: 'Weekdeck',
            body: 'Notifications are ready.',
            schedule: { at: new Date(Date.now() + 3000) },
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  }
  return {
    enabled,
    busy,
    status: uid ? status : 'Sign in to enable reminders.',
    request,
    disable,
    test,
    canEnable: !!uid,
  };
}
