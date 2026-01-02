importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const CACHE_PREFIX = 'morvarid';
const CURRENT_CACHE_ID = 'v3.2.1'; // Change this manually or via build script to invalidate caches
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CURRENT_CACHE_ID}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CURRENT_CACHE_ID}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CURRENT_CACHE_ID}`;

if (workbox) {
  console.log(`[SW] Workbox loaded`);

  // 1. Force SW to activate immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // 2. Cleanup Old Caches on Activate
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete caches that start with our prefix but don't match current ID
            if (cacheName.startsWith(CACHE_PREFIX) && !cacheName.includes(CURRENT_CACHE_ID)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  // 3. Cache Strategy: StaleWhileRevalidate for Hashed Assets (Vite)
  // These files have hashes in filenames, so we could theoretically use CacheFirst,
  // but StaleWhileRevalidate ensures we never get stuck with a broken version if hash collision happens (rare).
  workbox.routing.registerRoute(
    ({ request, url }) => url.pathname.includes('/assets/'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: STATIC_CACHE,
    })
  );

  // 4. Cache Strategy: StaleWhileRevalidate for Core Files (HTML, Root JS)
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'document',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: STATIC_CACHE,
    })
  );

  // 5. Cache Strategy: CacheFirst for Images/Fonts
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image' ||
      request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: IMAGE_CACHE,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // 6. Cache Strategy: NetworkFirst for API (Supabase)
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('/rest/v1/'),
    new workbox.strategies.NetworkFirst({
      cacheName: API_CACHE,
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
