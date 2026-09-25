try {
  process.loadEnvFile('.env.local');
} catch {
  /* CI supplies the public client configuration. */
}
for (const name of [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]) {
  if (!process.env[name])
    throw new Error(`Release build is missing ${name}. Local preview must not be shipped.`);
}
if (
  process.env.VITE_USE_FIREBASE_EMULATORS === 'true' ||
  process.env.VITE_FIREBASE_PROJECT_ID.startsWith('demo-')
)
  throw new Error('Release builds cannot use emulators.');
console.log(`Release configuration verified for ${process.env.VITE_FIREBASE_PROJECT_ID}.`);
