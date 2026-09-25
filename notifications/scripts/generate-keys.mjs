import { generateKeyPairSync } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const key = privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(key.x, 'base64url'),
  Buffer.from(key.y, 'base64url'),
]).toString('base64url');
// Exclusive creation prevents accidentally invalidating existing subscriptions.
await writeFile('.dev.vars', `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${key.d}\n`, {
  flag: 'wx',
  mode: 0o600,
});
console.log(
  'Created ignored .dev.vars. Upload it with wrangler secret bulk .dev.vars. Keep it private.',
);
