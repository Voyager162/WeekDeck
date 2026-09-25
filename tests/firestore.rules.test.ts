import { readFileSync } from 'node:fs';
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
