import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { firebase } from './firebase';
import { reminderRequest, reminderService, clearDeviceReminders } from './pwa';

export async function deleteAccount(user: User, password: string, onLocked: () => void) {
  if (!firebase || !user.email) throw new Error('Sign in again to delete your account.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const marker = doc(firebase.db, 'accountDeletions', user.uid);
  if (!(await getDoc(marker)).exists()) await setDoc(marker, { requestedAt: serverTimestamp() });
  onLocked();
  // Delete server-side reminders before removing the identity needed to authorize cleanup.
  if (reminderService) await reminderRequest('/account', {}, 'DELETE');
  await clearDeviceReminders();
  for (const [field, value] of [
    ['ownerUid', user.uid],
    ['recipientUid', user.uid],
    ...(user.emailVerified ? [['recipientEmail', user.email.toLowerCase()]] : []),
  ]) {
    while (true) {
      const shares = await getDocs(
        query(collection(firebase.db, 'scheduleShares'), where(field, '==', value), limit(400)),
      );
      if (shares.empty) break;
      const batch = writeBatch(firebase.db);
      shares.docs.forEach((share) => batch.delete(share.ref));
      await batch.commit();
    }
  }
  // The deletion marker blocks writes from every device while cleanup is in progress.
  for (const name of ['blocks', 'templates', 'days']) {
    while (true) {
      const documents = await getDocs(
        query(collection(firebase.db, 'users', user.uid, name), limit(400)),
      );
      if (documents.empty) break;
      const batch = writeBatch(firebase.db);
      for (const item of documents.docs) batch.delete(item.ref);
      await batch.commit();
    }
  }
  await deleteDoc(doc(firebase.db, 'users', user.uid, 'settings', 'planner'));
  await deleteDoc(doc(firebase.db, 'users', user.uid, 'settings', 'shared'));
  await deleteUser(user);
}
