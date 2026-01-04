// Service Worker with Local Workbox (No CDN Dependencies)
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

const CACHE_PREFIX = 'morvarid';
const CURRENT_CACHE_ID = 'v3.9.4'; // Synced with package.json
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CURRENT_CACHE_ID}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CURRENT_CACHE_ID}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CURRENT_CACHE_ID}`;

console.log(`[SW] Workbox loaded locally (${CURRENT_CACHE_ID})`);

// 1. Precache and cleanup
cleanupOutdatedCaches();

// 2. Force SW to activate immediately
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 3. Manual cache cleanup for versioned caches
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

// 4. Cache Strategy: StaleWhileRevalidate for Hashed Assets (Vite)
registerRoute(
  ({ request, url }) => url.pathname.includes('/assets/'),
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
  })
);

// 5. Cache Strategy: StaleWhileRevalidate for Core Files (HTML, Root JS)
registerRoute(
  ({ request }) => request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'document',
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
  })
);

// 6. Cache Strategy: CacheFirst for Images/Fonts
registerRoute(
  ({ request }) => request.destination === 'image' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// 7. Background Sync Plugin for offline requests
const bgSyncPlugin = new BackgroundSyncPlugin('sync-queue', {
  maxRetentionTime: 24 * 60 // Retry for 24 Hours
});

// 8. Cache Strategy: NetworkFirst for API (Supabase)
registerRoute(
  ({ url }) => url.pathname.includes('/rest/v1/'),
  new NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      bgSyncPlugin,
      {
        // Custom plugin to handle 4xx/5xx errors
        fetchDidFail: async ({ request }) => {
          console.error('[SW] API Request Failed', request.url);
        }
      }
    ]
  })
);

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

// --- PERIODIC BACKGROUND SYNC HANDLER ---
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Periodic Sync triggered:', event.tag);
    event.waitUntil(syncDataInBackground());
  }
});

async function syncDataInBackground() {
  console.log('[SW] Starting background data synchronization...');
  // Note: Since SW doesn't have direct access to Zustand, 
  // we trigger a message to all clients to start their internal sync processes.
  const allClients = await clients.matchAll({ type: 'window' });
  for (const client of allClients) {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  }
}
