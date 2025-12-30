
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`[SW] Workbox loaded`);

  // 1. Force SW to activate immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // 2. Precache Core Assets (Manual, or via injectManifest in build)
  // Since we are manual for now, we use Runtime Caching heavily.

  // 3. Cache Strategy: StaleWhileRevalidate for CSS, JS, HTML
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'document',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'morvarid-static-resources',
    })
  );

  // 4. Cache Strategy: CacheFirst for Images/Fonts
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image' ||
      request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: 'morvarid-images-fonts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // 5. Cache Strategy: NetworkFirst for API (Supabase)
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('/rest/v1/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'morvarid-api-cache',
      bgSync: {
        name: 'sync-queue',
        options: {
          maxRetentionTime: 24 * 60 // Retry for 24 Hours
        }
      },
      plugins: [
        {
          // Custom plugin to handle 4xx/5xx errors
          fetchDidFail: async ({ request }) => {
            console.error('[SW] API Request Failed', request.url);
          }
        }
      ]
    })
  );

} else {
  console.log(`[SW] Workbox failed to load`);
}

// --- PUSH NOTIFICATION HANDLER (Keep existing logic) ---
self.addEventListener('push', (event) => {
  let data = { title: 'سامانه مروارید', body: 'پیام جدید', url: '/' };
  try {
    if (event.data) {
      const json = event.data.json();
      data = { ...data, ...json };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    dir: 'rtl',
    lang: 'fa-IR',
    renotify: true,
    tag: 'system-alert',
    data: { url: data.url }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url);
    })
  );
});
