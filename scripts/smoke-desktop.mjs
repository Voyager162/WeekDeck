import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const executablePath = path.resolve(process.argv[2]);
const profile = await mkdtemp(path.join(tmpdir(), 'weekdeck-smoke-'));
let app;
try {
  const args = [`--user-data-dir=${profile}`];
  // The CI Linux runner does not permit Chromium's user-namespace sandbox.
  if (process.env.CI && process.platform === 'linux') args.push('--no-sandbox');
  app = await electron.launch({ executablePath, args });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.getByRole('button', { name: 'Support', exact: true }).click();
  await page.getByRole('heading', { name: 'Support', exact: true }).waitFor();
  if (
    (await page.getByRole('link', { name: 'Email support' }).getAttribute('href')) !==
    'mailto:weekdeckdev@gmail.com'
  )
    throw new Error('Missing support contact');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Privacy', exact: true }).click();
  await page.getByRole('heading', { name: 'Privacy', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete your account' }).click();
  await page.getByText('Sign in to delete your Weekdeck account and planner data.').waitFor();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Packaged desktop app: cloud sign-in and internal privacy navigation passed.');
} finally {
  if (app) await app.close();
  await rm(profile, { recursive: true, force: true });
}
