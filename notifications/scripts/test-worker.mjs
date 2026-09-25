import assert from 'node:assert/strict';
import { createECDH, generateKeyPairSync, randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const project = 'weekdeck-test';
const origin = 'https://weekdeck.test';
const authKeys = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(authKeys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
const vapid = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
  format: 'jwk',
});
const vapidPublic = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(vapid.x, 'base64url'),
  Buffer.from(vapid.y, 'base64url'),
]).toString('base64url');
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/device-one',
  expirationTime: null,
  keys: {
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  },
};
let deliveries = 0,
  deliveryStatus = 201;
let completed = false,
  title = 'Work';
const deleted = new Set();
const now = Date.now();
const settings = {
  planning: true,
  day: 0,
  time: 540,
  advanced: false,
  end: 660,
  interval: 30,
  transitions: true,
  lead: 0,
};
function fields(object) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      typeof value === 'boolean'
        ? { booleanValue: value }
        : typeof value === 'number'
          ? { integerValue: String(value) }
          : typeof value === 'string'
            ? { stringValue: value }
            : { mapValue: { fields: fields(value) } },
    ]),
  );
}
const bundle = await build({
  entryPoints: ['tests/harness.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['cloudflare:workers', 'node:*'],
  write: false,
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-09-25',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: { REMINDERS: { className: 'TestReminderAccount', useSQLite: true } },
    bindings: {
      FIREBASE_PROJECT_ID: project,
      APP_ORIGIN: origin,
      VAPID_PUBLIC_KEY: vapidPublic,
      VAPID_PRIVATE_KEY: vapid.d,
      VAPID_SUBJECT: 'mailto:weekdeckdev@gmail.com',
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.hostname === 'www.googleapis.com') return Response.json({ keys: [jwk] });
      if (url.hostname === 'firestore.googleapis.com') {
        assert.ok(request.headers.get('Authorization')?.startsWith('Bearer '));
        if (url.pathname.includes('/accountDeletions/'))
          return new Response('{}', {
            status: deleted.has(url.pathname.split('/').at(-1)) ? 200 : 404,
          });
        if (url.pathname.endsWith('/settings/planner'))
          return Response.json({ fields: fields({ notifications: settings }) });
        if (url.pathname.endsWith(':runQuery')) {
          const query = await request.json();
          assert.ok(!JSON.stringify(query.structuredQuery.select).includes('notes'));
          return Response.json([
            {
              document: {
                name: 'users/alice/blocks/block-one',
                fields: fields({ title, completed, startAt: now + 600000, endAt: now + 3600000 }),
              },
            },
          ]);
        }
      }
      if (url.hostname === 'fcm.googleapis.com') {
        assert.equal(request.headers.get('content-encoding'), 'aes128gcm');
        assert.ok((await request.arrayBuffer()).byteLength > 80);
        deliveries++;
        return new Response(null, { status: deliveryStatus });
      }
      throw new Error(`Unexpected outbound destination: ${url.origin}`);
    },
  }),
);
async function token(uid = 'alice', audience = project, expiry = '5m') {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(uid)
    .setIssuedAt()
    .setIssuer(`https://securetoken.google.com/${project}`)
    .setAudience(audience)
    .setExpirationTime(expiry)
    .sign(authKeys.privateKey);
}
const alice = await token(),
  bob = await token('bob');
async function request(path, body = {}, identity = alice, method = 'POST', site = origin) {
  return mf.dispatchFetch(`https://reminders.test${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${identity}`,
      Origin: site,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
try {
  assert.equal((await request('/sync', {}, 'bad-token')).status, 401);
  assert.equal((await request('/sync', {}, await token('alice', 'another-project'))).status, 401);
  assert.equal((await request('/sync', {}, await token('alice', project, '-1s'))).status, 401);
  assert.equal((await request('/sync', {}, alice, 'POST', 'https://evil.test')).status, 403);
  assert.equal((await request('/sync', { text: 'x'.repeat(5000) })).status, 413);
  assert.equal(
    (
      await request('/subscribe', {
        subscription: { ...subscription, endpoint: 'https://127.0.0.1/' },
        timezone: 'UTC',
      })
    ).status,
    400,
  );
  const result = await request('/subscribe', { subscription, timezone: 'America/Los_Angeles' });
  assert.equal(result.status, 200, await result.text());
  const ns = await mf.getDurableObjectNamespace('REMINDERS');
  const stub = ns.getByName('alice');
  const state = async () => (await stub.fetch('https://test/__state')).json();
  const put = async (data) =>
    stub.fetch('https://test/__state', { method: 'PUT', body: JSON.stringify(data) });
  let data = await state();
  assert.equal(data.devices.length, 1);
  assert.equal(data.events.length, 2);
  assert.equal(data.devices[0].weekly.length, 1);
  assert.ok(!JSON.stringify(data).includes(alice));
  assert.equal((await request('/test', { endpoint: subscription.endpoint }, bob)).status, 404);
  const tested = await request('/test', { endpoint: subscription.endpoint });
  assert.equal(tested.status, 200, await tested.text());
  assert.equal(deliveries, 1);
  assert.equal((await request('/test', { endpoint: subscription.endpoint })).status, 429);

  // Alarm delivery remains deduplicated across repeated alarm invocations.
  data = await state();
  data.events[0].at = Date.now() - 100;
  await put(data);
  await stub.fetch('https://test/__alarm');
  assert.equal(deliveries, 2);
  await stub.fetch('https://test/__alarm');
  assert.equal(deliveries, 2);
  // Transient failures retain events for retry; 410 removes the subscription.
  data = await state();
  data.events = [{ key: 'retry', at: Date.now() - 100, title: 'Retry', body: 'Test' }];
  await put(data);
  deliveryStatus = 503;
  await stub.fetch('https://test/__alarm');
  assert.ok((await state()).events.some((e) => e.key === 'retry'));
  deliveryStatus = 201;
  await stub.fetch('https://test/__alarm');
  assert.ok(
    Object.keys((await state()).devices[0].delivered).some((key) => key.startsWith('retry:')),
  );

  // Canonical Firebase values, not client-supplied block text, refresh the queue.
  title = 'Updated remotely';
  completed = true;
  data = await state();
  data.refreshed = 0;
  await put(data);
  assert.equal((await request('/sync', { title: 'forged' })).status, 200);
  assert.equal((await state()).events.length, 0);
  assert.equal(
    (await request('/device', { endpoint: subscription.endpoint }, bob, 'DELETE')).status,
    200,
  );
  assert.equal((await state()).devices.length, 1);
  assert.equal((await request('/account', {}, alice, 'DELETE')).status, 200);
  assert.equal(await state(), null);
  deleted.add('alice');
  assert.equal((await request('/subscribe', { subscription, timezone: 'UTC' })).status, 503);
  assert.equal(await state(), null);
  deleted.delete('alice');
  assert.equal((await request('/subscribe', { subscription, timezone: 'UTC' })).status, 200);
  deliveryStatus = 410;
  assert.equal((await request('/test', { endpoint: subscription.endpoint })).status, 503);
  assert.equal(await state(), null);
  console.log(
    'Worker integration checks passed: authentication, origin and size limits, subscription validation, encrypted push, account isolation, alarms, deduplication, retry, canonical sync, deletion, expired endpoints.',
  );
} finally {
  await mf.dispose();
}
