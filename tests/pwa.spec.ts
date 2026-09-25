import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

test('Home Screen manifest, icons, and privacy-safe cache', async ({ page }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toBe('Weekdeck');
  expect(manifest.start_url).toBe('/');
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const cache = await caches.open('weekdeck-public-v1');
    return (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
  });
  expect(cached).toEqual(['/icons/icon-192.png', '/offline.html']);
});

test('offline fallback survives a real disconnected origin and reconnects', async ({ page }) => {
  // WebKit's setOffline breaks SW navigations (Playwright #42775). Stop a dedicated origin instead.
  const assets = new Map(
    await Promise.all(
      ['/sw.js', '/offline.html', '/icons/icon-192.png'].map(
        async (path) => [path, await readFile(`public${path}`)] as const,
      ),
    ),
  );
  const server = createServer((request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    response.setHeader(
      'Content-Type',
      path.endsWith('.js') ? 'text/javascript' : path.endsWith('.png') ? 'image/png' : 'text/html',
    );
    response.end(assets.get(path) ?? '<!doctype html><h1>Online</h1>');
  });
  const listen = (port: number) =>
    new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const stop = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  await listen(0);
  const port = (server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;
  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await stop();
    await page.goto(`${origin}/offline-check`);
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect
      .poll(() => page.locator('img').evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    await listen(port);
    await page.getByRole('link', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Online', exact: true })).toBeVisible();
  } finally {
    if (server.listening) await stop();
  }
});

test('iPhone notification settings explain Home Screen requirement without requesting permission', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Notifications' }).click();
  await expect(page.getByText('Open in Safari, then Share > Add to Home Screen.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/iphone-home-screen-settings.png' });
  await context.close();
});

test('push reception always shows a notification and ignores untrusted navigation', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Service-worker inspection is Chromium-only; manifest and offline checks also run on WebKit.',
  );
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const worker = context.serviceWorkers()[0];
  const notification = await worker.evaluate(async () => {
    let shown: { title: string; options: NotificationOptions } | undefined;
    const registration = (self as unknown as { registration: ServiceWorkerRegistration })
      .registration;
    const original = registration.showNotification.bind(registration);
    registration.showNotification = async (title, options) => {
      shown = { title, options: options! };
    };
    const event = new Event('push');
    let pending: Promise<unknown> | undefined;
    Object.assign(event, {
      data: {
        json: () => ({
          title: 'Work',
          body: 'Time to switch.',
          tag: 'block:123',
          url: 'https://evil.test',
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    self.dispatchEvent(event);
    await pending;
    registration.showNotification = original;
    return shown;
  });
  expect(notification?.title).toBe('Work');
  expect(notification?.options.tag).toBe('block:123');
  expect(notification?.options.data).toBeUndefined();
});
