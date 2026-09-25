import { useEffect, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebase } from '../firebase';
import { dayRange, shiftDate } from '../domain';
import { type Preferences } from './model';

export type ScheduleShare = {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  recipientEmail: string;
  recipientUid: string;
  status: 'pending' | 'accepted' | 'declined';
  scope: 'week' | 'all';
  week: string;
  endDay: string;
  startAt: number;
  endAt: number;
  timeZone: string;
};
export function validShareCalendar(
  share: Pick<ScheduleShare, 'week' | 'endDay' | 'startAt' | 'endAt' | 'timeZone'>,
) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: share.timeZone }).format(0);
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(share.week) &&
      new Date(`${share.week}T12:00:00Z`).toISOString().slice(0, 10) === share.week &&
      shiftDate(share.week, 7) === share.endDay &&
      Number.isSafeInteger(share.startAt) &&
      Number.isSafeInteger(share.endAt) &&
      share.startAt >= 0 &&
      share.endAt <= 253402300799999 &&
      share.endAt - share.startAt >= 601200000 &&
      share.endAt - share.startAt <= 608400000
    );
  } catch {
    return false;
  }
}
export function schedulePreferences(preferences: Preferences) {
  return {
    weekStart: preferences.weekStart,
    dayHours: preferences.dayHours ?? null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
export function useSharing(user: User | null) {
  const [verified, setVerified] = useState(!!user?.emailVerified);
  const [incoming, setIncoming] = useState<ScheduleShare[]>([]);
  const [outgoing, setOutgoing] = useState<ScheduleShare[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!firebase) return;
    return onIdTokenChanged(firebase.auth, (current) => setVerified(!!current?.emailVerified));
  }, []);
  useEffect(() => {
    setIncoming([]);
    setOutgoing([]);
    setError('');
    if (!firebase || !user?.email || !verified) return;
    const shares = collection(firebase.db, 'scheduleShares');
    const fail = () => setError('Sharing could not connect. Please try again.');
    const subscribe = (field: string, value: string, set: typeof setIncoming) =>
      onSnapshot(
        query(shares, where(field, '==', value)),
        (snap) =>
          set(
            snap.docs
              .map((d) => ({ ...d.data(), id: d.id }) as ScheduleShare)
              .filter(validShareCalendar),
          ),
        fail,
      );
    const unsub = [
      subscribe('recipientEmail', user.email.toLowerCase(), setIncoming),
      subscribe('ownerUid', user.uid, setOutgoing),
    ];
    return () => unsub.forEach((stop) => stop());
  }, [user?.uid, user?.email, verified]);
  return { verified, incoming, outgoing, error };
}
export async function inviteSchedule(
  user: User,
  email: string,
  scope: 'week' | 'all',
  week: string,
  preferences: Preferences,
) {
  const recipientEmail = email.trim().toLowerCase();
  if (!user.emailVerified || !user.email || !firebase)
    throw new Error('Verify your email before sharing.');
  if (recipientEmail === user.email.toLowerCase()) throw new Error("Enter another person's email.");
  if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(recipientEmail) || recipientEmail.length > 254)
    throw new Error('Enter a valid email address.');
  const batch = writeBatch(firebase.db);
  batch.set(doc(firebase.db, 'users', user.uid, 'settings', 'shared'), {
    ...schedulePreferences(preferences),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(firebase.db, 'scheduleShares', `${user.uid}_${recipientEmail}`), {
    ownerUid: user.uid,
    ownerEmail: user.email.toLowerCase(),
    recipientEmail,
    recipientUid: '',
    status: 'pending',
    scope,
    week,
    endDay: shiftDate(week, 7),
    startAt: dayRange(week)[0],
    endAt: dayRange(shiftDate(week, 7))[0],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
export async function respondToShare(share: ScheduleShare, user: User, accept: boolean) {
  await updateDoc(doc(firebase!.db, 'scheduleShares', share.id), {
    status: accept ? 'accepted' : 'declined',
    recipientUid: user.uid,
    updatedAt: serverTimestamp(),
  });
}
export async function removeShare(share: ScheduleShare) {
  await deleteDoc(doc(firebase!.db, 'scheduleShares', share.id));
}
