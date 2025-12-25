
/*
 * Morvarid PWA Service Worker
 * Optimized for Performance & Stability (v2.7.0)
 */

const CACHE_NAME = 'morvarid-pwa-v2.7.0'; 
const ASSETS = [
  './',
  './index.html',
  './vite.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim(); 
});

self.addEventListener('fetch', (event) => {
  // OPTIMIZATION: Ignore non-GET requests immediately
  if (event.request.method !== 'GET') return;

  // Ignore cross-origin requests (like Supabase API) to ensure data freshness
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Version check bypass
  if (event.request.url.includes('version.json')) {
      event.respondWith(fetch(event.request, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
      }));
      return;
  }

  // SPA Navigation Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Stale-While-Revalidate Strategy for Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
                 cache.put(event.request, responseToCache);
             });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// --- PUSH NOTIFICATION HANDLER ---
self.addEventListener('push', (event) => {
  let data = { title: 'سامانه مروارید', body: 'پیام جدید', icon: './icons/icon-192x192.png', url: self.location.origin };
  
  if (event.data) {
    try {
        const json = event.data.json();
        data = { ...data, ...json };
    } catch(e) {
        data.body = event.data.text();
    }
  }

  if ('setAppBadge' in navigator) {
      // @ts-ignore
      navigator.setAppBadge(1).catch(e => console.warn('Badge failed', e));
  }

  const options = {
    body: data.body,
    icon: data.icon || './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    dir: 'rtl',
    lang: 'fa-IR',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || self.location.origin,
      timestamp: Date.now()
    },
    actions: [
        { action: 'open', title: 'مشاهده' },
        { action: 'close', title: 'بستن' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// --- NOTIFICATION CLICK HANDLER ---
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const urlToOpen = notification.data?.url || self.location.origin;

  notification.close();

  if ('clearAppBadge' in navigator) {
      // @ts-ignore
      navigator.clearAppBadge().catch(() => {});
  }

  if (action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if (notification.tag === 'system-update') {
              client.postMessage({ type: 'FORCE_RELOAD' });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// --- BACKGROUND SYNC HANDLER ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            clientList.forEach(client => {
                client.postMessage({ type: 'PROCESS_QUEUE_BACKGROUND' });
            });
        })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
