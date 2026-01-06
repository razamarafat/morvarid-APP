// Service Worker powered by Workbox
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

console.log(`[SW] Workbox-powered Service Worker starting.`);

// --- CONFIGURATION ---
const IMAGE_CACHE = `morvarid-images`;
const API_CACHE = `morvarid-api`;
const AUTH_CACHE = `morvarid-auth`;
const CURRENT_CACHES = [
  // workbox-precaching will have its own caches, managed by cleanupOutdatedCaches
  IMAGE_CACHE,
  API_CACHE,
  AUTH_CACHE,
];

// --- LIFECYCLE EVENTS ---

// 1. Force SW to become active immediately.
self.addEventListener('install', (event) => {
  console.log('[SW] New Service Worker installing, skipping waiting...');
  self.skipWaiting();
});

// 2. Claim clients and clean up old caches upon activation.
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  // Take control of all open pages.
  event.waitUntil(clients.claim());
  
  // Clean up outdated Workbox caches.
  cleanupOutdatedCaches();
  
  // Clean up other old, non-workbox caches.
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If a cache is not in our list of current caches, delete it.
          // We don't need to add workbox cache names to CURRENT_CACHES
          // because cleanupOutdatedCaches() handles them. We only care about our custom caches.
          if (!CURRENT_CACHES.includes(cacheName) && !cacheName.startsWith('workbox-precache')) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


// 3. Precache and route all static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Cache management utilities (retained for specific caches)
class CacheManager {
  constructor(cacheName, options = {}) {
    this.cacheName = cacheName;
    this.maxEntries = options.maxEntries || 50;
  }

  async limitEntries() {
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    
    if (requests.length > this.maxEntries) {
      const excess = requests.length - this.maxEntries;
      for (let i = 0; i < excess; i++) {
        await cache.delete(requests[i]);
      }
    }
  }
}

// Simple background sync queue (retained)
class SimpleBackgroundSync {
  constructor(queueName) {
    this.queueName = queueName;
    this.queue = [];
  }

  async addRequest(request) {
    this.queue.push(request.clone());
    if (navigator.onLine) {
      this.replayRequests();
    }
  }

  async replayRequests() {
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      try {
        await fetch(request);
      } catch (error) {
        this.queue.unshift(request);
        break;
      }
    }
  }
}

const imageCacheManager = new CacheManager(IMAGE_CACHE, { maxEntries: 60 });
const bgSync = new SimpleBackgroundSync('sync-queue');

// 4. Caching strategy for images (Cache First)
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
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

// 5. Caching strategy for Supabase Auth (Network First)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.includes('/auth/'),
  new NetworkFirst({
    cacheName: AUTH_CACHE,
    networkTimeoutSeconds: 3,
  })
);

// 6. Caching strategy for Supabase API (Stale-While-Revalidate with background sync)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/'),
  new StaleWhileRevalidate({
    cacheName: API_CACHE,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 }), // 5 minutes
      {
        fetchDidFail: async ({ request }) => {
          // Add to background sync queue for retry
          bgSync.addRequest(request);
        },
      },
    ],
  })
);


// --- VAPID KEYS CONFIGURATION ---
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;

if (!VAPID_PUBLIC_KEY) {
  console.debug('[SW] VAPID Public Key not configured - push notifications disabled.');
} else {
  console.log('[SW] VAPID Public Key configured.');
}

// --- PUSH NOTIFICATION HANDLER (retained) ---
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener('push', (event) => {
  let data = { 
    title: 'سامانه مروارید', 
    body: 'پیام جدید', 
    url: '/',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'morvarid-notification'
  };
  
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    dir: 'rtl',
    lang: 'fa-IR',
    renotify: true,
    tag: data.tag,
    data: { url: data.url, action: data.action, timestamp: Date.now() },
    actions: [
      { action: 'open', title: 'مشاهده' },
      { action: 'dismiss', title: 'بستن' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const urlToOpen = event.notification.data.url || '/';
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// --- PERIODIC BACKGROUND SYNC HANDLER (retained) ---
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncDataInBackground());
  }
});

async function syncDataInBackground() {
    const allClients = await clients.matchAll({ type: 'window' });
    for (const client of allClients) {
        client.postMessage({ type: 'TRIGGER_SYNC' });
    }
}

// --- ONLINE/OFFLINE HANDLER (retained) ---
self.addEventListener('online', () => {
  bgSync.replayRequests();
});

console.log('[SW] Service Worker initialized successfully.');
console.log('[SW] Cache strategy: Aggressive update with automatic cache cleaning.');
console.log('[SW] Background sync: Enabled');
console.log('[SW] Push notifications:', VAPID_PUBLIC_KEY ? 'Enabled' : 'Disabled (no VAPID key)');