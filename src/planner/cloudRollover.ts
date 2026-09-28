import {
  collection,
  doc,
  documentId,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { dateKey, shiftDate, type Block } from '../domain';
import { calendarMidnight, displayBlock, storeBlock } from './calendarTime';
import { emptyPlanner, weekOf, type DayConfig, type Preferences } from './model';
import { copyWeek } from './rollover';

export async function ensureCloudWeek(db: Firestore, uid: string, week: string, today: string) {
  const base = ['users', uid] as const;
  const settings = await getDocFromServer(doc(db, ...base, 'settings', 'planner'));
  const preferences = settings.data() as Preferences;
  if (week !== weekOf(today, preferences.weekStart)) return;
  const marker = doc(db, ...base, 'weeks', week);
  if ((await getDocFromServer(marker)).exists()) return;
  const zone = preferences.timeZone!;
  const blocksRef = collection(db, ...base, 'blocks'),
    daysRef = collection(db, ...base, 'days');
  const start = calendarMidnight(week, zone),
    end = calendarMidnight(shiftDate(week, 7), zone);
  const existingBlocks = await getDocsFromServer(
    query(blocksRef, where('startAt', '>=', start), where('startAt', '<', end), limit(1)),
  );
  const existingDays = await getDocsFromServer(
    query(
      daysRef,
      where(documentId(), '>=', week),
      where(documentId(), '<', shiftDate(week, 7)),
      limit(1),
    ),
  );
  let copied: ReturnType<typeof copyWeek> | undefined;
  if (existingBlocks.empty && existingDays.empty) {
    const lastBlock = await getDocsFromServer(
      query(blocksRef, where('startAt', '<', start), orderBy('startAt', 'desc'), limit(1)),
    );
    const lastDay = await getDocsFromServer(
      query(
        daysRef,
        where(documentId(), '>=', shiftDate(week, -7)),
        where(documentId(), '<', week),
        limit(1),
      ),
    );
    const lastWeek = await getDocsFromServer(
      query(
        collection(db, ...base, 'weeks'),
        where('week', '<', week),
        orderBy('week', 'desc'),
        limit(1),
      ),
    );
    const candidates = [lastWeek.docs[0]?.id, lastDay.docs[0]?.id];
    if (!lastBlock.empty)
      candidates.push(
        dateKey(new Date(displayBlock(lastBlock.docs[0].data() as Block, zone).startAt)),
      );
    const source = candidates
      .filter((day): day is string => !!day)
      .map((day) => weekOf(day, preferences.weekStart))
      .filter((day) => day < week)
      .sort()
      .at(-1);
    if (source) {
      const sourceBlocks = await getDocsFromServer(
        query(
          blocksRef,
          where('startAt', '>=', calendarMidnight(source, zone)),
          where('startAt', '<', calendarMidnight(shiftDate(source, 7), zone)),
          limit(441),
        ),
      );
      if (sourceBlocks.size > 440)
        throw new Error(
          'This schedule is too large to roll over automatically. Copy individual days instead.',
        );
      const sourceDays = await getDocsFromServer(
        query(
          daysRef,
          where(documentId(), '>=', source),
          where(documentId(), '<', shiftDate(source, 7)),
        ),
      );
      copied = copyWeek(
        {
          ...emptyPlanner(),
          preferences,
          blocks: sourceBlocks.docs.map((item) =>
            displayBlock({ ...item.data(), id: item.id } as Block, zone),
          ),
          days: Object.fromEntries(
            sourceDays.docs.map((item) => {
              const { updatedAt: _updated, ...day } = item.data();
              return [item.id, day as DayConfig];
            }),
          ),
        },
        source,
        week,
      );
    }
  }
  // Every editor writes this marker too, so a concurrent edit or rollover wins intact.
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(marker)).exists()) return;
    transaction.set(marker, { week, updatedAt: serverTimestamp() });
    if (!copied) return;
    for (const block of copied.blocks) {
      const { id, ...value } = storeBlock(block, zone);
      transaction.set(doc(blocksRef, id), {
        ...value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const [day, config] of Object.entries(copied.days))
      transaction.set(doc(daysRef, day), { ...config, updatedAt: serverTimestamp() });
  });
}
