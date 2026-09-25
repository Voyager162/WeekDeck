import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { firebase } from '../firebase';
import { dateKey, shiftDate, type Block } from '../domain';
import { atMinute, type Preferences } from './model';
import { notificationPlan } from './notificationPlan';

export const nativeNotifications = Capacitor.isNativePlatform();
let queue = Promise.resolve();
let generation = 0;
function enqueue(work: () => Promise<void>) {
  queue = queue.catch(() => {}).then(work);
  return queue;
}
async function cancelOwned() {
  const pending = await LocalNotifications.getPending();
  const notifications = pending.notifications.filter((n) => n.id >= 700_000 && n.id < 700_100);
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}
export function useNotifications(
  uid: string | undefined,
  localBlocks: Block[],
  settings: Preferences['notifications'],
  ready: boolean,
) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksReady, setBlocksReady] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState(
    nativeNotifications ? 'Not enabled on this device' : 'Available in the iOS and Android apps',
  );
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!nativeNotifications) return;
    const listener = App.addListener('appStateChange', (event) => {
      if (event.isActive) setRefresh((n) => n + 1);
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
  useEffect(() => {
    if (!uid || !firebase || !nativeNotifications) return;
    const today = dateKey(new Date());
    return onSnapshot(
      query(
        collection(firebase.db, 'users', uid, 'blocks'),
        where('startAt', '>=', atMinute(today, 0)),
        where('startAt', '<', atMinute(shiftDate(today, 14), 0)),
        orderBy('startAt'),
      ),
      (snapshot) => {
        setBlocks(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Block));
        setBlocksReady(true);
      },
      () => setStatus('Could not refresh reminders'),
    );
  }, [uid, refresh]);
  useEffect(() => {
    if (!nativeNotifications || !ready || (uid && !blocksReady)) return;
    const version = ++generation;
    void enqueue(async () => {
      if (version !== generation) return;
      const permission = await LocalNotifications.checkPermissions();
      setEnabled(permission.display === 'granted');
      await cancelOwned();
      if (permission.display !== 'granted') {
        setStatus('Notifications are off on this device');
        return;
      }
      const reminders = notificationPlan(uid ? blocks : localBlocks, settings, Date.now());
      if (Capacitor.getPlatform() === 'android')
        await LocalNotifications.createChannel({
          id: 'weekdeck-reminders',
          name: 'Weekdeck reminders',
          importance: 4,
        });
      if (reminders.length)
        await LocalNotifications.schedule({
          notifications: reminders.map((r) => ({
            id: r.id,
            title: r.title,
            body: r.body,
            channelId: 'weekdeck-reminders',
            schedule: r.repeat
              ? { on: r.repeat, repeats: true, allowWhileIdle: true }
              : { at: new Date(r.at), allowWhileIdle: true },
          })),
        });
      const blockReminders = reminders.filter((r) => !r.repeat);
      const last = blockReminders.at(-1);
      const weekly = reminders.some((r) => r.repeat) ? 'Weekly reminders on. ' : '';
      setStatus(
        last
          ? `${weekly}${blockReminders.length} block reminders through ${new Date(last.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
          : weekly || 'No upcoming reminders',
      );
    }).catch(() => setStatus('Could not schedule reminders. Check device permissions.'));
  }, [uid, blocks, localBlocks, settings, refresh, ready, blocksReady]);
  useEffect(
    () => () => {
      ++generation;
      if (nativeNotifications) void enqueue(cancelOwned).catch(() => {});
    },
    [uid],
  );
  async function request() {
    if (nativeNotifications) {
      await LocalNotifications.requestPermissions();
      setRefresh((n) => n + 1);
    }
  }
  async function exact() {
    if (Capacitor.getPlatform() === 'android')
      await LocalNotifications.changeExactNotificationSetting();
  }
  return { status, enabled, request, exact, android: Capacitor.getPlatform() === 'android' };
}
