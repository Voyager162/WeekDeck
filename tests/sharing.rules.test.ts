import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, it } from 'vitest';
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timeblocker',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}, 30000);
beforeEach(() => env.clearFirestore());
afterAll(async () => {
  if (env) await env.cleanup();
});
const auth = (uid: string, verified = true, email = `${uid}@example.test`) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const share = () => ({
  ownerUid: 'alice',
  ownerEmail: 'alice@example.test',
  recipientEmail: 'bob@example.test',
  recipientUid: '',
  status: 'pending',
  scope: 'week',
  week: '2026-09-21',
  endDay: '2026-09-28',
  startAt: Date.parse('2026-09-21T00:00Z'),
  endAt: Date.parse('2026-09-28T00:00Z'),
  timeZone: 'UTC',
  updatedAt: serverTimestamp(),
});
const ref = (db: ReturnType<typeof auth>) => doc(db, 'scheduleShares/alice_bob@example.test');
async function seed(accept = true) {
  const a = auth('alice');
  await setDoc(ref(a), share());
  for (const [id, date] of [
    ['inside', '2026-09-23'],
    ['outside', '2026-09-30'],
  ]) {
    await setDoc(doc(a, `users/alice/blocks/${id}`), {
      title: 'Study',
      notes: '',
      category: 'focus',
      startAt: Date.parse(`${date}T10:00Z`),
      endAt: Date.parse(`${date}T11:00Z`),
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(a, `users/alice/days/${date}`), {
      enabled: true,
      start: 540,
      end: 1020,
      updatedAt: serverTimestamp(),
    });
  }
  if (accept)
    await updateDoc(ref(auth('bob')), {
      status: 'accepted',
      recipientUid: 'bob',
      updatedAt: serverTimestamp(),
    });
}
it('keeps pending invitations private and requires verified sender and recipient', async () => {
  await assertFails(setDoc(ref(auth('alice', false)), share()));
  await seed(false);
  await assertSucceeds(
    getDocs(
      query(
        collection(auth('bob'), 'scheduleShares'),
        where('recipientEmail', '==', 'bob@example.test'),
      ),
    ),
  );
  for (const db of [auth('bob', false), auth('eve'), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(ref(db)));
    await assertFails(
      updateDoc(ref(db), { status: 'accepted', recipientUid: 'bob', updatedAt: serverTimestamp() }),
    );
  }
  await assertFails(getDoc(doc(auth('bob'), 'users/alice/blocks/inside')));
});
it('grants only the invited week and permits the actual bounded queries', async () => {
  await seed();
  const b = auth('bob');
  await assertSucceeds(getDoc(doc(b, 'users/alice/blocks/inside')));
  await assertFails(getDoc(doc(b, 'users/alice/blocks/outside')));
  await assertSucceeds(
    getDocs(
      query(
        collection(b, 'users/alice/blocks'),
        where('startAt', '>=', share().startAt),
        where('startAt', '<', share().endAt),
      ),
    ),
  );
  await assertFails(getDocs(collection(b, 'users/alice/blocks')));
  await assertSucceeds(
    getDocs(
      query(
        collection(b, 'users/alice/days'),
        where(documentId(), 'in', ['2026-09-21', '2026-09-23']),
      ),
    ),
  );
  await assertFails(getDoc(doc(b, 'users/alice/days/2026-09-30')));
  await assertFails(getDoc(doc(b, 'users/alice/settings/planner')));
  await assertFails(getDocs(collection(b, 'users/alice/templates')));
  await assertFails(
    updateDoc(doc(b, 'users/alice/blocks/inside'), {
      title: 'Changed',
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(b, 'users/alice/blocks/inside')));
});
it('prevents widening, identity forgery, and claiming an accepted invite with a new UID', async () => {
  await seed();
  const b = auth('bob');
  for (const patch of [
    { scope: 'all' },
    { recipientUid: 'eve' },
    { ownerUid: 'bob' },
    { ownerEmail: 'eve@example.test' },
  ])
    await assertFails(updateDoc(ref(b), { ...patch, updatedAt: serverTimestamp() }));
  await assertFails(
    getDoc(doc(auth('replacement', true, 'bob@example.test'), 'users/alice/blocks/inside')),
  );
  await assertFails(
    setDoc(doc(auth('eve'), 'scheduleShares/eve_bob@example.test'), {
      ...share(),
      ownerUid: 'eve',
    }),
  );
});
it('supports all weeks and immediately revokes reads when removed or the owner is deleting', async () => {
  await seed();
  const a = auth('alice'),
    b = auth('bob');
  await setDoc(ref(a), { ...share(), scope: 'all' });
  await assertFails(getDoc(doc(b, 'users/alice/blocks/inside')));
  await updateDoc(ref(b), {
    status: 'accepted',
    recipientUid: 'bob',
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(getDocs(collection(b, 'users/alice/blocks')));
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), 'accountDeletions/alice'), { requestedAt: serverTimestamp() }),
  );
  await assertFails(getDoc(doc(b, 'users/alice/blocks/inside')));
  await deleteDoc(ref(a));
  await assertFails(getDoc(doc(b, 'users/alice/blocks/inside')));
});
it('declines permanently and allows either participant to remove access', async () => {
  await seed(false);
  const b = auth('bob');
  await updateDoc(ref(b), {
    status: 'declined',
    recipientUid: 'bob',
    updatedAt: serverTimestamp(),
  });
  await assertFails(
    updateDoc(ref(b), { status: 'accepted', recipientUid: 'bob', updatedAt: serverTimestamp() }),
  );
  await assertFails(getDoc(doc(b, 'users/alice/blocks/inside')));
  await assertSucceeds(deleteDoc(ref(b)));
});
