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
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
