import { readFileSync } from 'node:fs';
import { defaultPreferences } from '../src/planner/model';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const block = () => ({
  title: 'Deep work',
  notes: '',
  category: 'focus',
  startAt: 1_800_000_000_000,
  endAt: 1_800_003_600_000,
  completed: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timeblocker',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}, 30_000);
beforeEach(() => env.clearFirestore());
afterAll(async () => {
  if (env) await env.cleanup();
});

describe('private user schedules', () => {
  it('allows the owner to create, read, list, update and delete', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const ref = doc(db, 'users/alice/blocks/a');
    await assertSucceeds(setDoc(ref, block()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(db, 'users/alice/blocks')));
    await assertSucceeds(updateDoc(ref, { completed: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });
  it('denies other users and anonymous clients on every operation', async () => {
    await setDoc(
      doc(env.authenticatedContext('alice').firestore(), 'users/alice/blocks/a'),
      block(),
    );
    for (const db of [
      env.authenticatedContext('bob').firestore(),
      env.unauthenticatedContext().firestore(),
    ]) {
      const ref = doc(db, 'users/alice/blocks/a');
      await assertFails(getDoc(ref));
      await assertFails(getDocs(collection(db, 'users/alice/blocks')));
      await assertFails(setDoc(doc(db, 'users/alice/blocks/new'), block()));
      await assertFails(updateDoc(ref, { completed: true, updatedAt: serverTimestamp() }));
      await assertFails(deleteDoc(ref));
    }
  });
  it.each([
    { color: 'script' },
    { title: '' },
    { title: 'x'.repeat(121) },
    { notes: 12 },
    { notes: 'x'.repeat(2001) },
    { category: 'admin' },
    { startAt: -1 },
    { startAt: 1.5 },
    { endAt: 0 },
    { endAt: 1_800_086_400_001 },
    { completed: 'yes' },
    { owner: 'alice' },
    { createdAt: Timestamp.fromMillis(0) },
    { updatedAt: Timestamp.fromMillis(0) },
  ])('rejects malformed or forged data %j', async (patch) => {
    await assertFails(
      setDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice/blocks/a'), {
        ...block(),
        ...patch,
      }),
    );
  });
  it('rejects missing fields and unknown paths', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users/alice/blocks/a'), { title: 'Incomplete' }));
    await assertFails(setDoc(doc(db, 'users/alice'), { admin: true }));
  });
  it('does not permit changing the creation timestamp', async () => {
    const ref = doc(env.authenticatedContext('alice').firestore(), 'users/alice/blocks/a');
    await setDoc(ref, block());
    await assertFails(
      updateDoc(ref, { createdAt: Timestamp.fromMillis(1), updatedAt: serverTimestamp() }),
    );
  });
});

describe('private weekly planner configuration', () => {
  const version = 'c84d810c-6a13-4a27-944d-d0540e9f267e';
  const dayHours = { start: 480, end: 1080, linked: true, version };
  const samples = () => [
    {
      path: 'templates/work',
      data: {
        title: 'Work',
        color: 'blue',
        icon: 'briefcase',
        duration: 60,
        updatedAt: serverTimestamp(),
      },
    },
    {
      path: 'days/2026-09-21',
      data: { enabled: true, start: 540, end: 1020, updatedAt: serverTimestamp() },
    },
    { path: 'settings/planner', data: { ...defaultPreferences, updatedAt: serverTimestamp() } },
    {
      path: 'days/2026-09-22',
      data: {
        enabled: true,
        start: 480,
        end: 1080,
        hoursVersion: version,
        updatedAt: serverTimestamp(),
      },
    },
    {
      path: 'settings/planner',
      data: { ...defaultPreferences, dayHours, updatedAt: serverTimestamp() },
    },
  ];
  it('allows owner CRUD on every new schema', async () => {
    const db = env.authenticatedContext('alice').firestore();
    for (const { path, data } of samples()) {
      const ref = doc(db, `users/alice/${path}`);
      await assertSucceeds(setDoc(ref, data));
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(updateDoc(ref, { ...data, updatedAt: serverTimestamp() }));
      await assertSucceeds(deleteDoc(ref));
    }
    await assertSucceeds(
      setDoc(doc(db, 'users/alice/blocks/colored'), { ...block(), color: 'rose' }),
    );
  });
  it('denies cross-account and unauthenticated CRUD and collection reads', async () => {
    const owner = env.authenticatedContext('alice').firestore();
    for (const { path, data } of samples()) {
      await setDoc(doc(owner, `users/alice/${path}`), data);
      for (const db of [
        env.authenticatedContext('bob').firestore(),
        env.unauthenticatedContext().firestore(),
      ]) {
        const ref = doc(db, `users/alice/${path}`);
        await assertFails(getDoc(ref));
        await assertFails(getDocs(collection(db, `users/alice/${path.split('/')[0]}`)));
        await assertFails(setDoc(ref, data));
        await assertFails(setDoc(doc(db, `users/alice/${path.split('/')[0]}/new`), data));
        await assertFails(updateDoc(ref, { updatedAt: serverTimestamp() }));
        await assertFails(deleteDoc(ref));
      }
    }
  });
  it('rejects missing, unexpected, and forged timestamp fields on every schema', async () => {
    const db = env.authenticatedContext('alice').firestore();
    for (const { path, data } of samples()) {
      const ref = doc(db, `users/alice/${path}`);
      await assertFails(setDoc(ref, { ...data, admin: true }));
      await assertFails(setDoc(ref, { ...data, updatedAt: Timestamp.fromMillis(0) }));
      await assertFails(setDoc(ref, { updatedAt: serverTimestamp() }));
      await setDoc(ref, data);
      await assertFails(updateDoc(ref, { owner: 'bob', updatedAt: serverTimestamp() }));
    }
  });
  it.each([
    { duration: 0 },
    { duration: 241 },
    { duration: 20.5 },
    { color: '#fff' },
    { icon: 'script' },
    { title: 'x'.repeat(81) },
  ])('rejects invalid presets %j', async (patch) => {
    await assertFails(
      setDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice/templates/a'), {
        ...samples()[0].data,
        ...patch,
      }),
    );
  });
  it.each([
    { start: -1 },
    { end: 1441 },
    { start: 600, end: 600 },
    { start: 539.5 },
    { enabled: 'yes' },
    { hoursVersion: 'x'.repeat(1000) },
    { hoursVersion: 1 },
  ])('rejects invalid hours %j', async (patch) => {
    await assertFails(
      setDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice/days/2026-09-21'), {
        ...samples()[1].data,
        ...patch,
      }),
    );
  });
  it.each([
    { theme: 'invalid' },
    { hourHeight: 1 },
    { hourHeight: 101 },
    { snap: 0 },
    { weekStart: 6 },
    { timeFormat: 'words' },
    { notifications: [] },
    { notifications: { ...defaultPreferences.notifications, interval: 0 } },
    { notifications: { ...defaultPreferences.notifications, day: 7 } },
    {
      notifications: { ...defaultPreferences.notifications, advanced: true, time: 1200, end: 900 },
    },
    { notifications: { ...defaultPreferences.notifications, advanced: true, time: 600, end: 901 } },
    { notifications: { ...defaultPreferences.notifications, arbitrary: 'field' } },
  ])('rejects invalid preferences %j', async (patch) => {
    await assertFails(
      setDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice/settings/planner'), {
        ...samples()[2].data,
        ...patch,
      }),
    );
  });
  it('rejects malformed date IDs and unknown settings documents', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users/alice/days/admin'), samples()[1].data));
    await assertFails(setDoc(doc(db, 'users/alice/settings/admin'), samples()[2].data));
  });
  it.each([
    { start: -1 },
    { end: 1441 },
    { start: 600, end: 610 },
    { start: 540.5 },
    { linked: 'true' },
    { version: '' },
    { version: 'x'.repeat(1000) },
    { version: 123 },
    { admin: true },
  ])('rejects malformed shared hours on create and update %j', async (patch) => {
    const ref = doc(env.authenticatedContext('alice').firestore(), 'users/alice/settings/planner');
    const data = { ...defaultPreferences, dayHours, updatedAt: serverTimestamp() };
    await assertFails(setDoc(ref, { ...data, dayHours: { ...dayHours, ...patch } }));
    await assertSucceeds(setDoc(ref, data));
    await assertFails(
      updateDoc(ref, { dayHours: { ...dayHours, ...patch }, updatedAt: serverTimestamp() }),
    );
  });
  it('rejects missing nested fields, malformed maps and required-field deletion', async () => {
    const ref = doc(env.authenticatedContext('alice').firestore(), 'users/alice/settings/planner');
    const data = { ...defaultPreferences, dayHours, updatedAt: serverTimestamp() };
    for (const malformed of [
      null,
      [],
      'hours',
      { start: 480 },
      { start: 480, end: 1080, linked: true },
    ])
      await assertFails(setDoc(ref, { ...data, dayHours: malformed }));
    await assertSucceeds(setDoc(ref, data));
    await assertFails(
      updateDoc(ref, { 'dayHours.start': deleteField(), updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(ref, { weekStart: deleteField(), updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(ref, { 'dayHours.linked': false, updatedAt: serverTimestamp() }),
    );
  });
});
