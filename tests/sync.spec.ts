import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, signup = false) {
  await page.goto('/');
  if (signup) await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Test-password-482!');
  await page
    .getByRole('button', { name: signup ? 'Create account' : 'Sign in', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Weekly planner' })).toBeVisible();
}

test('two devices sync a schedule while a different account stays isolated', async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const third = await browser.newContext();
  try {
    const a = await first.newPage();
    const b = await second.newPage();
    const c = await third.newPage();
    const email = `sync-${Date.now()}@example.test`;
    await login(a, email, true);
    await login(b, email);
    await login(c, `other-${Date.now()}@example.test`, true);
    await a.getByRole('button', { name: 'New block', exact: true }).click();
    await a.getByLabel('Block name', { exact: true }).fill('Shared across my devices');
    await a.getByRole('button', { name: 'Save block', exact: true }).click();
    await expect(b.getByRole('button', { name: /^Shared across my devices,/ })).toBeVisible();
    await expect(c.getByRole('button', { name: /^Shared across my devices,/ })).toHaveCount(0);
    await b.getByRole('button', { name: /^Shared across my devices,/ }).click();
    await b.getByLabel('Block name', { exact: true }).fill('Edited on second device');
    await b.getByRole('button', { name: 'Save block', exact: true }).click();
    await expect(a.getByRole('button', { name: /^Edited on second device,/ })).toBeVisible();
    await a.reload();
    await expect(a.getByRole('button', { name: /^Edited on second device,/ })).toBeVisible();
    await b.getByRole('button', { name: /^Edited on second device,/ }).click();
    await b.getByRole('button', { name: 'Delete block', exact: true }).click();
    await expect(a.getByRole('button', { name: /^Edited on second device,/ })).toHaveCount(0);
    await b.getByRole('button', { name: 'Settings', exact: true }).click();
    await b.getByRole('button', { name: 'dark theme', exact: true }).click();
    await b.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(a.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(c.locator('html')).toHaveAttribute('data-theme', 'light');
    await b.getByRole('button', { name: 'Edit Work preset', exact: true }).click();
    await b.getByLabel('Preset name').fill('Studio time');
    await b.getByRole('button', { name: 'Save preset', exact: true }).click();
    await expect(a.getByRole('button', { name: 'Place Studio time', exact: true })).toBeVisible();
    await b.getByRole('button', { name: 'Remove Monday', exact: true }).click();
    await b.getByRole('button', { name: 'Remove day', exact: true }).click();
    await expect(a.locator('[data-lane]')).toHaveCount(6);
    await expect(c.locator('[data-lane]')).toHaveCount(7);
    await a.getByRole('button', { name: /^Sign out / }).click();
    await expect(a.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  } finally {
    await first.close();
    await second.close();
    await third.close();
  }
});
