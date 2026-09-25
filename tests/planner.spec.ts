import { test, expect } from '@playwright/test';

for (const size of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`planner works at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily planner' })).toBeVisible();
    await page.getByRole('button', { name: 'New block' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Read a book');
    await page.getByLabel('Notes').fill('Chapter one');
    await page.getByRole('button', { name: 'Save block' }).click();
    await expect(page.getByRole('heading', { name: 'Read a book' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Read a book' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit: Read a book', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Read two chapters');
    await page.getByRole('button', { name: 'Save block' }).click();
    await page.getByRole('button', { name: 'Complete: Read two chapters', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Mark incomplete: Read two chapters', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/planner-${size.width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Next day', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Read two chapters' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    await page.getByRole('button', { name: 'Delete: Read two chapters', exact: true }).click();
    await page.getByRole('button', { name: 'Delete block', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Read two chapters' })).toHaveCount(0);
  });
}
