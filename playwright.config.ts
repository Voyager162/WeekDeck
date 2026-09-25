import { defineConfig } from '@playwright/test';
const emulators = !!process.env.FIRESTORE_EMULATOR_HOST;
export default defineConfig({
  testDir: './tests',
  testMatch: emulators ? 'sync.spec.ts' : 'planner.spec.ts',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: emulators
      ? 'npm run dev:emulators -- --port 4173 --strictPort'
      : 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
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
        },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
