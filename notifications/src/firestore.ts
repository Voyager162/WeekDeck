import type { Block, Settings } from './plan';
import { HORIZON } from './plan';

type Value = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  mapValue?: { fields?: Record<string, Value> };
};
type Document = { name: string; fields: Record<string, Value> };
function decode(fields: Record<string, Value>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value.stringValue ??
        (value.integerValue !== undefined
          ? Number(value.integerValue)
          : (value.booleanValue ?? (value.mapValue ? decode(value.mapValue.fields ?? {}) : null))),
    ]),
  );
}
export async function readPlan(project: string, uid: string, token: string, now: number) {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const headers = { Authorization: token, 'Content-Type': 'application/json' };
  const options = { headers, signal: AbortSignal.timeout(8000) };
  const marker = await fetch(`${base}/accountDeletions/${encodeURIComponent(uid)}`, options);
  if (marker.status !== 404) throw new Error('Account unavailable');
  const path = `${base}/users/${encodeURIComponent(uid)}`;
  const settingsResponse = await fetch(`${path}/settings/planner`, {
    ...options,
    signal: AbortSignal.timeout(8000),
  });
  if (!settingsResponse.ok) throw new Error('Settings unavailable');
  const settingsDoc = (await settingsResponse.json()) as Document;
  const settings = decode(settingsDoc.fields).notifications as Settings;
  if (
    !settings ||
    typeof settings.planning !== 'boolean' ||
    typeof settings.transitions !== 'boolean'
  )
    throw new Error('Invalid settings');
  if (!settings.transitions) return { settings, blocks: [] as Block[] };
  const response = await fetch(`${path}:runQuery`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'blocks' }],
        select: {
          fields: ['title', 'startAt', 'endAt', 'completed'].map((fieldPath) => ({ fieldPath })),
        },
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'startAt' },
                  op: 'GREATER_THAN_OR_EQUAL',
                  value: { integerValue: String(now - 86400_000) },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'startAt' },
                  op: 'LESS_THAN',
                  value: { integerValue: String(now + HORIZON) },
                },
              },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'startAt' }, direction: 'ASCENDING' }],
        limit: 5000,
      },
    }),
  });
  if (!response.ok) throw new Error('Planner unavailable');
  const documents = (await response.json()) as { document?: Document }[];
  if (!Array.isArray(documents)) throw new Error('Invalid planner response');
  const blocks = documents.flatMap(({ document }) =>
    document
      ? [
          {
            ...decode(document.fields),
            id: document.name.split('/').at(-1),
          } as Block,
        ]
      : [],
  );
  return { settings, blocks };
}
