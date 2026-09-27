import { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { firebase } from '../firebase';
import { dayRange, shiftDate, type Block } from '../domain';
import { schedulePreferences } from './sharing';
import { deviceTimeZone, displayBlock, storeBlock, validTimeZone } from './calendarTime';
import {
  defaultPreferences,
  defaultTemplates,
  emptyPlanner,
  type DayConfig,
  type PlannerData,
  type Preferences,
  type Template,
} from './model';

export type Change = {
  kind: 'blocks' | 'templates' | 'days' | 'settings';
  id: string;
  before?: unknown;
  after?: unknown;
};
const localKey = 'weekdeck.planner.v2';
function clean(value: unknown): Record<string, unknown> {
  const {
    id: _id,
    createdAt: _created,
    updatedAt: _updated,
    ...data
  } = value as Record<string, unknown>;
  return data;
}
function apply(data: PlannerData, changes: Change[]): PlannerData {
  const next = structuredClone(data);
  for (const change of changes) {
    if (change.kind === 'settings')
      next.preferences = (change.after ?? defaultPreferences) as Preferences;
    else if (change.kind === 'days') {
      if (change.after) next.days[change.id] = change.after as DayConfig;
      else delete next.days[change.id];
    } else {
      const list = next[change.kind] as (Block | Template)[];
      const index = list.findIndex((item) => item.id === change.id);
      if (index >= 0) list.splice(index, 1);
      if (change.after) list.push({ ...clean(change.after), id: change.id } as Block | Template);
    }
  }
  return next;
}
export function usePlanner(user: User | null, week: string) {
  const [data, setData] = useState<PlannerData>(emptyPlanner);
  const [localZone, setLocalZone] = useState(deviceTimeZone);
  const current = useRef(data);
  const zone = data.preferences.timeZone ?? localZone;
  const displayed = { ...data, blocks: data.blocks.map((block) => displayBlock(block, zone)) };
  current.current = displayed;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const initialization = useRef<Promise<void> | null>(null);
  const [cached, setCached] = useState(!!user);
  const [history, setHistory] = useState<Change[][]>([]);
  const [future, setFuture] = useState<Change[][]>([]);
  useEffect(() => {
    const refresh = () => setLocalZone(deviceTimeZone());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    // Undo snapshots contain display-local dates, so don't reuse them after travel.
    setHistory([]);
    setFuture([]);
  }, [localZone]);
  useEffect(() => {
    if (user) return;
    try {
      const stored = localStorage.getItem(localKey);
      const initial = stored ? JSON.parse(stored) : emptyPlanner();
      if (!stored)
        initial.blocks = JSON.parse(localStorage.getItem('timeblocker.preview.v1') || '[]');
      if (!validTimeZone(initial.preferences.timeZone))
        initial.preferences.timeZone = deviceTimeZone();
      localStorage.setItem(localKey, JSON.stringify(initial));
      setData(initial);
      setReady(true);
    } catch {
      setError('Local data could not be loaded.');
    }
  }, [user]);
  useEffect(() => {
    if (!user || !firebase) return;
    let active = true;
    setReady(false);
    setError('');
    const db = firebase.db,
      base = ['users', user.uid] as const;
    const fail = (error: Error) => {
      if (active) setError(error.message);
    };
    const loaded = new Set<string>();
    const mark = (key: string) => {
      loaded.add(key);
      if (loaded.size === 4) setReady(true);
    };
    const prefs = doc(db, ...base, 'settings', 'planner');
    initialization.current ??= runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(prefs);
      const shared = await transaction.get(doc(db, ...base, 'settings', 'shared'));
      const existing = snapshot.exists() ? (snapshot.data() as Preferences) : defaultPreferences;
      const timeZone = validTimeZone(existing.timeZone)
        ? existing.timeZone
        : validTimeZone(shared.data()?.timeZone)
          ? shared.data()!.timeZone
          : deviceTimeZone();
      const preferences = { ...existing, timeZone };
      transaction.set(doc(db, ...base, 'settings', 'shared'), {
        ...schedulePreferences(preferences),
        updatedAt: serverTimestamp(),
      });
      if (!validTimeZone(existing.timeZone))
        transaction.set(prefs, { ...preferences, updatedAt: serverTimestamp() });
      if (!snapshot.exists()) {
        for (const template of defaultTemplates)
          transaction.set(doc(db, ...base, 'templates', template.id), {
            ...clean(template),
            updatedAt: serverTimestamp(),
          });
      }
    });
    void initialization.current.catch((error) => {
      initialization.current = null;
      fail(error);
    });
    const start = dayRange(shiftDate(week, -2))[0],
      end = dayRange(shiftDate(week, 9))[0];
    const unsubs = [
      onSnapshot(
        query(
          collection(db, ...base, 'blocks'),
          where('startAt', '>=', start),
          where('startAt', '<', end),
          orderBy('startAt'),
          limit(2500),
        ),
        { includeMetadataChanges: true },
        (snapshot) => {
          setData((old) => ({
            ...old,
            blocks: snapshot.docs.map((item) => ({ ...clean(item.data()), id: item.id }) as Block),
          }));
          setCached(snapshot.metadata.fromCache);
          mark('blocks');
        },
        fail,
      ),
      onSnapshot(
        query(collection(db, ...base, 'templates'), limit(50)),
        (snapshot) => {
          setData((old) => ({
            ...old,
            templates: snapshot.docs.map(
              (item) => ({ ...clean(item.data()), id: item.id }) as Template,
            ),
          }));
          mark('templates');
        },
        fail,
      ),
      onSnapshot(
        query(
          collection(db, ...base, 'days'),
          where(documentId(), '>=', week),
          where(documentId(), '<', shiftDate(week, 7)),
        ),
        (snapshot) => {
          setData((old) => ({
            ...old,
            days: Object.fromEntries(
              snapshot.docs.map((item) => [item.id, clean(item.data()) as DayConfig]),
            ),
          }));
          mark('days');
        },
        fail,
      ),
      onSnapshot(
        prefs,
        (snapshot) => {
          if (snapshot.exists()) {
            setData((old) => ({ ...old, preferences: clean(snapshot.data()) as Preferences }));
            if (snapshot.data().timeZone) mark('prefs');
          }
        },
        fail,
      ),
    ];
    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
    };
  }, [user, week]);
  async function write(changes: Change[]) {
    if (!ready || writing.current)
      throw new Error('Please wait for the current changes to finish.');
    if (changes.length > 450) throw new Error('Select fewer days to copy at once.');
    setBusy(true);
    writing.current = true;
    setError('');
    try {
      if (!user) {
        const next = apply(current.current, changes);
        next.preferences.timeZone ??= zone;
        const stored = { ...next, blocks: next.blocks.map((block) => storeBlock(block, zone)) };
        localStorage.setItem(localKey, JSON.stringify(stored));
        current.current = next;
        setData(stored);
      } else {
        const batch = writeBatch(firebase!.db);
        for (const change of changes) {
          if (change.kind === 'settings')
            batch.set(doc(firebase!.db, 'users', user.uid, 'settings', 'shared'), {
              ...schedulePreferences({
                ...((change.after ?? defaultPreferences) as Preferences),
                timeZone: (change.after as Preferences)?.timeZone ?? zone,
              }),
              updatedAt: serverTimestamp(),
            });
          const ref = doc(firebase!.db, 'users', user.uid, change.kind, change.id);
          if (change.after === undefined) batch.delete(ref);
          else {
            const value =
              change.kind === 'blocks'
                ? storeBlock(change.after as Block, zone)
                : change.kind === 'settings'
                  ? {
                      ...(change.after as Preferences),
                      timeZone: (change.after as Preferences).timeZone ?? zone,
                    }
                  : change.after;
            const next = { ...clean(value), updatedAt: serverTimestamp() };
            if (change.kind === 'blocks' && change.before) batch.update(ref, next);
            else
              batch.set(ref, {
                ...next,
                ...(change.kind === 'blocks' ? { createdAt: serverTimestamp() } : {}),
              });
          }
        }
        await batch.commit();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Changes could not be saved.');
      throw error;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  async function commit(changes: Change[]) {
    if (!changes.length) return;
    await write(changes);
    setHistory((old) => [...old.slice(-19), changes]);
    setFuture([]);
  }
  async function undo() {
    const last = history.at(-1);
    if (!last) return;
    await write(last.map((c) => ({ ...c, before: c.after, after: c.before })));
    setHistory((old) => old.slice(0, -1));
    setFuture((old) => [...old, last]);
  }
  async function redo() {
    const last = future.at(-1);
    if (!last) return;
    await write(last);
    setFuture((old) => old.slice(0, -1));
    setHistory((old) => [...old, last]);
  }
  return {
    data: displayed,
    ready,
    error,
    setError,
    busy,
    cached,
    commit,
    undo,
    redo,
    canUndo: !!history.length,
    canRedo: !!future.length,
  };
}
