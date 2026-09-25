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
} from 'firebase/firestore';
import { firebase } from './firebase';

export async function deleteAccount(user: User, password: string, onLocked: () => void) {
  if (!firebase || !user.email) throw new Error('Sign in again to delete your account.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const marker = doc(firebase.db, 'accountDeletions', user.uid);
  if (!(await getDoc(marker)).exists()) await setDoc(marker, { requestedAt: serverTimestamp() });
  onLocked();
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
  await deleteUser(user);
}
