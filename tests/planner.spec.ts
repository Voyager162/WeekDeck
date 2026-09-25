import { test, expect, type Page } from '@playwright/test';
import { dateKey } from '../src/domain';
import { blockFromSlot, emptyPlanner, weekDates, weekOf } from '../src/planner/model';

const week = weekOf(dateKey(new Date()));
const dates = weekDates(week);
async function open(page: Page, seeded = false) {
  page.on('pageerror', (error) => {
    throw error;
  });
  if (seeded) {
    const data = emptyPlanner();
    data.blocks = [
      [0, 'Deep work', 'blue', 540, 660],
      [0, 'Reading', 'violet', 690, 750],
      [0, 'Lunch', 'teal', 750, 810],
      [0, 'Practice music', 'rose', 840, 900],
      [1, 'Study', 'violet', 555, 645],
      [1, 'Work', 'blue', 690, 810],
      [1, 'Exercise', 'green', 870, 930],
      [2, 'Homework', 'amber', 540, 630],
      [2, 'Work', 'blue', 660, 780],
      [2, 'Relax', 'teal', 840, 900],
      [3, 'Deep work', 'blue', 540, 660],
      [3, 'Practice music', 'rose', 720, 810],
      [3, 'Study', 'violet', 855, 945],
      [4, 'Work', 'blue', 570, 690],
      [4, 'Lunch', 'teal', 720, 780],
      [4, 'Homework', 'amber', 840, 930],
      [5, 'Exercise', 'green', 600, 690],
      [5, 'Read a book', 'violet', 750, 840],
      [6, 'Relax', 'teal', 600, 720],
    ].map(([d, title, color, start, end]) =>
      blockFromSlot(title as string, color as 'blue', {
        day: dates[d as number],
        start: start as number,
        end: end as number,
      }),
    );
    await page.addInitScript(
      (data) => localStorage.setItem('weekdeck.planner.v2', JSON.stringify(data)),
      data,
    );
  }
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Weekly planner' })).toBeVisible();
}

test('long-press touch drag from phone drawer creates a block with a ghost', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-specific.');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await open(page);
    await page.getByRole('button', { name: 'Block library', exact: true }).tap();
    const rect = await page.getByRole('button', { name: 'Place Study', exact: true }).boundingBox();
    const client = await context.newCDPSession(page);
    const x = rect!.x + 45,
      y = rect!.y + 25;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(300);
    await expect(page.locator('.library')).toHaveCSS('opacity', '0');
    const lane = await page.locator('[data-lane].selected-day').boundingBox();
    const target = { x: lane!.x + 120, y: lane!.y + (600 * 72) / 60 };
    for (let i = 1; i <= 12; i++)
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + ((target.x - x) * i) / 12, y: y + ((target.y - y) * i) / 12 }],
      });
    await expect(page.getByTestId('drop-ghost')).toBeVisible();
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('button', { name: /^Study,/ })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('rejects overlapping edits and copies; replacement and undo are atomic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await add(page, 'Monday work', dates[0]);
  await add(page, 'Tuesday study', dates[1]);
  await page.getByRole('button', { name: 'Copy Monday', exact: true }).click();
  await page.getByRole('checkbox', { name: /Tuesday/ }).check();
  await page.getByRole('button', { name: 'Copy to 1 day' }).click();
  await expect(page.getByRole('alert')).toContainText('overlap');
  await page.getByRole('switch', { name: 'Replace existing blocks' }).check();
  await page.getByRole('button', { name: 'Copy to 1 day' }).click();
  await expect(page.getByRole('button', { name: /^Monday work,/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Tuesday study,/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Monday work,/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Tuesday study,/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Monday settings', exact: true }).click();
  await page.getByLabel('Start', { exact: true }).fill('09:30');
  await page.getByRole('button', { name: 'Save hours' }).click();
  await expect(page.getByRole('alert')).toContainText('Move or resize');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'New block', exact: true }).click();
  await page.getByLabel('Block name').fill('Overlap');
  await page.getByLabel('Day', { exact: true }).selectOption(dates[0]);
  await page.getByLabel('Start', { exact: true }).fill('09:15');
  await page.getByLabel('End', { exact: true }).fill('10:00');
  await page.getByRole('button', { name: 'Save block' }).click();
  await expect(page.getByRole('alert')).toContainText('free time');
});
async function add(page: Page, title: string, day = dates[0], start = '09:00', end = '10:00') {
  await page.getByRole('button', { name: 'New block', exact: true }).click();
  await page.getByLabel('Block name').fill(title);
  await page.getByLabel('Day', { exact: true }).selectOption(day);
  await page.getByLabel('Start', { exact: true }).fill(start);
  await page.getByLabel('End', { exact: true }).fill(end);
  await page.getByRole('button', { name: 'Save block', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  release = true,
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  if (release) await page.mouse.up();
}
async function pointAt(page: Page, day: string, minute: number) {
  const lane = await page.locator(`[data-lane="${day}"]`).boundingBox();
  return { x: lane!.x + lane!.width / 2, y: lane!.y + (minute * 72) / 60 };
}
for (const width of [1440, 768, 390, 320]) {
  test(`create edit persist and delete at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await add(page, 'Read a book', dateKey(new Date()));
    await expect(page.getByRole('button', { name: /^Read a book,/ })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /^Read a book,/ }).click();
    await page.getByLabel('Block name').fill('Read two chapters');
    await page.getByRole('switch', { name: 'Completed' }).check();
    await page.getByRole('button', { name: 'Save block' }).click();
    await expect(page.locator('.scheduled-block.completed')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/crud-${width}.png` });
    await page.getByRole('button', { name: /^Read two chapters,/ }).click();
    await page.getByRole('button', { name: 'Delete block', exact: true }).click();
    await expect(page.locator('.scheduled-block')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.scheduled-block')).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete Read two chapters', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.scheduled-block')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.locator('.scheduled-block')).toHaveCount(0);
  });
}
test('drag follows pointer, previews gap fit, and resizes at either edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.getByRole('button', { name: 'Close block library', exact: true }).click();
  const handle = await page
    .locator('.icon-rail')
    .getByRole('button', { name: 'Block library', exact: true })
    .boundingBox();
  await drag(
    page,
    { x: handle!.x + 15, y: handle!.y + 15 },
    { x: handle!.x + 100, y: handle!.y + 15 },
  );
  await expect(page.locator('.library')).toBeVisible();
  await add(page, 'First', dates[0], '09:00', '10:00');
  await add(page, 'Second', dates[0], '10:30', '11:30');
  const preset = await page.getByRole('button', { name: 'Place Study', exact: true }).boundingBox();
  const target = await pointAt(page, dates[0], 605);
  await drag(page, { x: preset!.x + 30, y: preset!.y + 20 }, target, false);
  await expect(page.locator('.drag-overlay')).toContainText('Study');
  await expect(page.getByTestId('drop-ghost')).toContainText('10 AM - 10:30 AM');
  await page.screenshot({ path: 'test-results/drag-ghost.png' });
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Study, 10 AM to 10:30 AM', exact: true }),
  ).toBeVisible();
  const block = await page.getByRole('button', { name: /^Study,/ }).boundingBox();
  await drag(page, { x: block!.x + 30, y: block!.y + 12 }, await pointAt(page, dates[1], 600));
  await expect(page.locator(`[data-lane="${dates[1]}"] .scheduled-block`)).toHaveCount(1);
  const bottom = await page
    .getByRole('button', { name: 'Resize end of Study', exact: true })
    .boundingBox();
  await drag(
    page,
    { x: bottom!.x + 30, y: bottom!.y + 4 },
    { x: bottom!.x + 30, y: bottom!.y + 40 },
  );
  await expect(
    page.getByRole('button', { name: 'Study, 10 AM to 11 AM', exact: true }),
  ).toBeVisible();
  const top = await page
    .getByRole('button', { name: 'Resize start of Study', exact: true })
    .boundingBox();
  await drag(page, { x: top!.x + 30, y: top!.y + 3 }, { x: top!.x + 30, y: top!.y - 33 });
  await expect(
    page.getByRole('button', { name: 'Study, 9:30 AM to 11 AM', exact: true }),
  ).toBeVisible();
});
test('day hours, keyboard-copy to multiple days, remove and restore', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await add(page, 'Work session');
  const start = await page
    .getByRole('button', { name: `Start hours ${dates[1]}`, exact: true })
    .boundingBox();
  await drag(page, { x: start!.x + 20, y: start!.y + 10 }, { x: start!.x + 20, y: start!.y + 82 });
  await page.getByRole('button', { name: 'Tuesday settings', exact: true }).click();
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('10:00');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Unplanned', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Select Monday', exact: true }).click();
  await expect(page.locator(`[data-day-heading="${dates[0]}"]`)).toHaveClass(/selected-day/);
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Select Tuesday', exact: true }).click();
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Work session,/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'Select Wednesday', exact: true }).click();
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('button', { name: /^Work session,/ })).toHaveCount(3);
  await page.getByRole('button', { name: 'Remove Monday', exact: true }).click();
  await page.getByRole('button', { name: 'Remove day', exact: true }).click();
  await expect(page.locator('[data-lane]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-lane]')).toHaveCount(7);
  await expect(page.getByRole('button', { name: /^Work session,/ })).toHaveCount(3);
});
test('clipboard snapshot, Command shortcuts, replacement and typing isolation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await add(page, 'Original Monday');
  await add(page, 'Old Tuesday', dates[1]);
  await page.getByRole('button', { name: 'Select Monday', exact: true }).click();
  await page.keyboard.press('Meta+c');
  await page.getByRole('button', { name: /^Original Monday,/ }).click();
  await page.getByLabel('Block name').fill('Edited Monday');
  await page.getByLabel('Block name').press('Control+a');
  await page.getByLabel('Block name').press('Control+c');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Save block', exact: true }).click();
  await page.getByRole('button', { name: 'Select Tuesday', exact: true }).click();
  await page.keyboard.press('Meta+v');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Original Monday,/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Old Tuesday,/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Old Tuesday,/ })).toHaveCount(1);
  await page.getByRole('button', { name: /^Edited Monday,/ }).click();
  await page.getByLabel('Notes').focus();
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator(`[data-lane="${dates[0]}"] .scheduled-block`)).toHaveCount(1);
});
test('shared hours persist across weeks, detach on resize, and undo atomically', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.getByRole('button', { name: 'Planner settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Shared day hours' }).check();
  await page.getByLabel('Shared start time').fill('08:00');
  await page.getByLabel('Shared end time').fill('18:00');
  await page.getByRole('button', { name: 'Save settings' }).click();
  for (const day of dates)
    await expect(page.getByRole('button', { name: `Start hours ${day}` })).toHaveText('8 AM');
  await page.reload();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Monday settings', exact: true }).click();
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('08:00');
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('18:00');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  const start = page.getByRole('button', { name: `Start hours ${dates[0]}` });
  await start.focus();
  await start.press('ArrowDown');
  await expect(start).toHaveText('8:15 AM');
  for (const day of dates.slice(1))
    await expect(page.getByRole('button', { name: `Start hours ${day}` })).toHaveText('8 AM');
  await page.getByRole('button', { name: 'Planner settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Shared day hours' })).not.toBeChecked();
  await expect(page.getByLabel('Shared start time')).toHaveValue('08:00');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(start).toHaveText('8 AM');
  await page.getByRole('button', { name: 'Planner settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Shared day hours' })).toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.reload();
  await expect(start).toHaveText('8:15 AM');
  await expect(page.getByRole('button', { name: `Start hours ${dates[1]}` })).toHaveText('8 AM');
});
test('preset editing, tap placement and all settings fit a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await open(page);
  await page.getByRole('button', { name: 'Block library', exact: true }).click();
  await page.getByRole('button', { name: 'New preset', exact: true }).click();
  await page.getByLabel('Preset name').fill('Creative practice');
  await page.getByRole('button', { name: 'rose', exact: true }).click();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await page.getByRole('button', { name: 'Place Creative practice', exact: true }).click();
  await expect(page.locator('.library')).toHaveCount(0);
  const lane = page.locator('[data-lane].selected-day');
  const rect = await lane.boundingBox();
  await page.mouse.click(rect!.x + 80, rect!.y + (600 * 72) / 60);
  await expect(page.getByRole('button', { name: /^Creative practice,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('tab', { name: 'Planner', exact: true }).click();
  await page.getByRole('switch', { name: 'Shared day hours' }).check();
  await page.getByLabel('Shared start time').fill('08:00');
  await page.getByLabel('Shared end time').fill('18:00');
  await expect(
    page
      .locator('.toggle-row')
      .filter({ has: page.getByRole('switch', { name: 'Shared day hours' }) })
      .locator('.toggle-track'),
  ).toHaveCSS('background-color', 'rgb(138, 211, 182)');
  await page.screenshot({ path: 'test-results/mobile-shared-hours.png' });
  await page.getByRole('tab', { name: 'Notifications' }).click();
  await page.getByRole('switch', { name: 'Weekly planning reminder' }).check();
  await page.getByRole('switch', { name: 'Advanced reminder schedule' }).check();
  await page.getByRole('switch', { name: 'Block transitions' }).check();
  await page.screenshot({ path: 'test-results/mobile-notifications.png' });
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
for (const width of [1440, 390])
  test(`visual board ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await open(page, true);
    await page.screenshot({ path: `test-results/weekly-board-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'dark theme', exact: true }).click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await page.screenshot({ path: `test-results/weekly-board-dark-${width}.png`, fullPage: true });
  });
