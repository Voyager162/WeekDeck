import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
    await expect(page.getByRole('heading', { name: 'Daily planner' })).toBeVisible();
    await expect(page.locator('.sync')).toHaveText('Synced', { timeout: 30_000 });
    return page;
  }
  if (process.argv[3]) {
    desktop = await _electron.launch({ executablePath: process.argv[3] });
  }
  const first = await device(accounts[0], desktop ? await desktop.firstWindow() : undefined);
  const second = await device(accounts[0]);
  const isolated = await device(accounts[1]);
  await first.getByRole('button', { name: 'New block', exact: true }).click();
  await first.getByLabel('Title', { exact: true }).fill('Cloud sync verification');
  await first.getByRole('button', { name: 'Save block', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Cloud sync verification' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(isolated.getByRole('heading', { name: 'Cloud sync verification' })).toHaveCount(0);

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

  await second.getByRole('button', { name: 'Edit: Cloud sync verification', exact: true }).click();
  await second.getByLabel('Title', { exact: true }).fill('Edited on another device');
  await second.getByRole('button', { name: 'Save block', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'Edited on another device' })).toBeVisible({
    timeout: 30_000,
  });
  await first.reload();
  await expect(first.getByRole('heading', { name: 'Edited on another device' })).toBeVisible({
    timeout: 30_000,
  });
  await second
    .getByRole('button', { name: 'Complete: Edited on another device', exact: true })
    .click();
  await expect(
    first.getByRole('button', { name: 'Mark incomplete: Edited on another device', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await second
    .getByRole('button', { name: 'Delete: Edited on another device', exact: true })
    .click();
  await second.getByRole('button', { name: 'Delete block', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'Edited on another device' })).toHaveCount(0, {
    timeout: 30_000,
  });
  await first.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(first.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  console.log(
    'PASS: hosted sign-in, create/edit/complete/delete sync, persistence, sign-out, and cross-account/anonymous read denial.',
  );
} finally {
  await desktop?.close();
  await browser?.close();
  let cleanupFailed = false;
  for (const account of accounts) {
    const user = account.auth.currentUser;
    if (!user) continue;
    try {
      const blocks = await getDocs(collection(account.db, 'users', user.uid, 'blocks'));
      for (const block of blocks.docs) await deleteDoc(block.ref);
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
