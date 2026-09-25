const CACHE = 'weekdeck-public-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/offline.html', '/icons/icon-192.png'])),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('weekdeck-public-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
// Do not cache signed-in pages, API responses, or planner data.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname === '/icons/icon-192.png')
    event.respondWith(
      caches.match('/icons/icon-192.png').then((cached) => cached || fetch(event.request)),
    );
  else if (event.request.mode === 'navigate')
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
self.addEventListener('push', (event) => {
  let message;
  try {
    message = event.data.json();
  } catch {
    message = {};
  }
  event.waitUntil(
    self.registration.showNotification(
      typeof message?.title === 'string' ? message.title.slice(0, 160) : 'Weekdeck',
      {
        body: typeof message?.body === 'string' ? message.body.slice(0, 240) : 'Open your planner.',
        icon: '/icons/icon-192.png',
        tag: typeof message?.tag === 'string' ? message.tag.slice(0, 180) : 'weekdeck-reminder',
      },
    ),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const target = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (target) {
        await target.navigate('/');
        await target.focus();
      } else await self.clients.openWindow('/');
    })(),
  );
});
