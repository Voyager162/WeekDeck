import { defineConfig } from '@playwright/test';
const emulators = !!process.env.FIRESTORE_EMULATOR_HOST;
const port = emulators ? 4174 : 4173;
export default defineConfig({
  outputDir: emulators ? 'test-results/sync' : 'test-results/browser',
  testDir: './tests',
  testMatch: emulators ? 'sync.spec.ts' : ['planner.spec.ts', 'pwa.spec.ts'],
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: emulators
      ? `npm run dev:emulators -- --port ${port} --strictPort`
      : `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    // Preview tests must never use a developer's live Firebase configuration.
    env: emulators
      ? undefined
      : {
          VITE_FIREBASE_API_KEY: '',
          VITE_FIREBASE_AUTH_DOMAIN: '',
          VITE_FIREBASE_PROJECT_ID: '',
          VITE_FIREBASE_APP_ID: '',
          VITE_USE_FIREBASE_EMULATORS: 'false',
          VITE_REMINDER_URL: '',
        },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(!emulators ? [{ name: 'webkit', use: { browserName: 'webkit' as const } }] : []),
  ],
});
