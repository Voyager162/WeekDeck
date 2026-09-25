import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firebase } from './firebase';
import { dayRange, validateBlock, type Block, type BlockInput } from './domain';

export function subscribeBlocks(
  uid: string,
  day: string,
  receive: (blocks: Block[], pending: boolean, cached: boolean) => void,
  fail: (error: Error) => void,
) {
  const [start, end] = dayRange(day);
  const ref = query(
    collection(firebase!.db, 'users', uid, 'blocks'),
    where('startAt', '>=', start),
    where('startAt', '<', end),
    orderBy('startAt'),
    limit(500),
  );
  return onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snapshot) => {
      receive(
        snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Block),
        snapshot.metadata.hasPendingWrites,
        snapshot.metadata.fromCache,
      );
    },
    fail,
  );
}
export async function saveBlock(uid: string, block: BlockInput, id?: string) {
  const error = validateBlock(block);
  if (error) throw new Error(error);
  const data = { ...block, title: block.title.trim(), updatedAt: serverTimestamp() };
  if (id) await updateDoc(doc(firebase!.db, 'users', uid, 'blocks', id), data);
  else
    await addDoc(collection(firebase!.db, 'users', uid, 'blocks'), {
      ...data,
      createdAt: serverTimestamp(),
    });
}
export async function removeBlock(uid: string, id: string) {
  await deleteDoc(doc(firebase!.db, 'users', uid, 'blocks', id));
}
