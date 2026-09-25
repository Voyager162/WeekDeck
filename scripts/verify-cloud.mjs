import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename, join } from 'node:path';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import { chromium, expect, _electron } from '@playwright/test';

process.loadEnvFile('.env.local');
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId || process.argv[2] !== projectId) {
  throw new Error('Pass the exact Firebase project ID to explicitly run this live-cloud check.');
}
const config = {
  projectId,
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
const url = `https://${projectId}.web.app`;
const accounts = [];
const apps = [];
let browser;
let desktop;
let desktopProfile;
try {
  for (let i = 0; i < 2; i++) {
    const app = initializeApp(config, `cloud-check-${i}`);
    apps.push(app);
    const auth = getAuth(app);
    const account = {
      auth,
      db: getFirestore(app),
      email: `weekdeck-check-${randomUUID()}@example.test`,
      password: `Check-${randomUUID()}!`,
    };
    accounts.push(account);
    await createUserWithEmailAndPassword(auth, account.email, account.password);
  }
  browser = await chromium.launch();
  async function device(account, existingPage) {
    const page = existingPage ?? (await (await browser.newContext()).newPage());
    if (!existingPage) await page.goto(url);
    return signIn(page, account);
  }
  async function signIn(page, account) {
    await expect(page).toHaveTitle('Weekdeck');
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Weekly planner' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.sync-status')).toHaveText('All changes saved', { timeout: 30_000 });
    return page;
  }
  if (process.argv[3]) {
    desktopProfile = await mkdtemp(join(tmpdir(), 'weekdeck-desktop-check-'));
    desktop = await _electron.launch({
      executablePath: process.argv[3],
      args: [`--user-data-dir=${desktopProfile}`],
    });
  }
  const first = await device(accounts[0], desktop ? await desktop.firstWindow() : undefined);
  const second = await device(accounts[0]);
  const isolated = await device(accounts[1]);
  await first.getByRole('button', { name: 'New block', exact: true }).click();
  await first.getByLabel('Block name', { exact: true }).fill('Cloud sync verification');
  await first.getByRole('button', { name: 'Save block', exact: true }).click();
  await expect(second.getByRole('button', { name: /^Cloud sync verification,/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(isolated.getByRole('button', { name: /^Cloud sync verification,/ })).toHaveCount(0);

  const path = `users/${accounts[0].auth.currentUser.uid}/blocks`;
  const saved = await getDocs(collection(accounts[0].db, path));
  assert.equal(saved.size, 1);
  await assert.rejects(getDoc(doc(accounts[1].db, path, saved.docs[0].id)), {
    code: 'permission-denied',
  });
  const anonymous = initializeApp(config, 'cloud-check-anonymous');
  apps.push(anonymous);
  await assert.rejects(getDoc(doc(getFirestore(anonymous), path, saved.docs[0].id)), {
    code: 'permission-denied',
  });

  await second.getByRole('button', { name: /^Cloud sync verification,/ }).click();
  await second.getByLabel('Block name', { exact: true }).fill('Edited on another device');
  await second.getByRole('button', { name: 'Save block', exact: true }).click();
  await expect(first.getByRole('button', { name: /^Edited on another device,/ })).toBeVisible({
    timeout: 30_000,
  });
  await first.reload();
  await expect(first.getByRole('button', { name: /^Edited on another device,/ })).toBeVisible({
    timeout: 30_000,
  });
  await second.getByRole('button', { name: /^Edited on another device,/ }).click();
  await second.getByRole('switch', { name: 'Completed' }).check();
  await second.getByRole('button', { name: 'Save block' }).click();
  await expect(first.locator('.scheduled-block.completed')).toHaveCount(1, { timeout: 30_000 });
  await second.getByRole('button', { name: /^Edited on another device,/ }).click();
  await second.getByRole('button', { name: 'Delete block', exact: true }).click();
  await expect(first.getByRole('button', { name: /^Edited on another device,/ })).toHaveCount(0, {
    timeout: 30_000,
  });
  await second.getByRole('button', { name: 'Settings', exact: true }).click();
  await second.getByRole('button', { name: 'sage theme', exact: true }).click();
  await second.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(first.locator('html')).toHaveAttribute('data-theme', 'sage', { timeout: 30_000 });
  await expect(isolated.locator('html')).toHaveAttribute('data-theme', 'light');
  await first.getByRole('button', { name: /^Sign out / }).click();
  await expect(first.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  console.log(
    'PASS: hosted sign-in, create/edit/complete/delete sync, persistence, sign-out, and cross-account/anonymous read denial.',
  );
} finally {
  await desktop?.close();
  await browser?.close();
  if (desktopProfile) {
    assert.equal(dirname(resolve(desktopProfile)), resolve(tmpdir()));
    assert.ok(basename(desktopProfile).startsWith('weekdeck-desktop-check-'));
    await rm(desktopProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  let cleanupFailed = false;
  for (const account of accounts) {
    const user = account.auth.currentUser;
    if (!user) continue;
    try {
      for (const name of ['blocks', 'templates', 'days']) {
        const documents = await getDocs(collection(account.db, 'users', user.uid, name));
        for (const document of documents.docs) await deleteDoc(document.ref);
      }
      await deleteDoc(doc(account.db, 'users', user.uid, 'settings', 'planner'));
      await deleteUser(user);
    } catch (error) {
      cleanupFailed = true;
      console.error(`Temporary-account cleanup failed for UID ${user.uid}: ${error.message}`);
    }
  }
  await Promise.all(apps.map((app) => deleteApp(app)));
  if (cleanupFailed)
    throw new Error(
      'Clean up the reported temporary test account before considering verification complete.',
    );
  console.log('Temporary test accounts and data removed.');
}
