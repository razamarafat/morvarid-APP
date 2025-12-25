
/*
 * Morvarid PWA Service Worker
 * Version: 2.8.0
 * Features: High Priority Notifications, Persistent Caching, Background Sync
 */

const CACHE_NAME = 'morvarid-core-v2.8.0';
const ASSETS = [
  './',
  './index.html',
  './vite.svg',
  './manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
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
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (event.request.url.includes('version.json')) {
      event.respondWith(fetch(event.request, { cache: 'no-store' }));
      return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then(response => {
          if(response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
      });
    })
  );
});

// --- ENHANCED PUSH HANDLER (Critical Alert Simulation) ---
self.addEventListener('push', (event) => {
  let data = { 
      title: 'سامانه مروارید', 
      body: 'پیام جدید دریافت شد', 
      url: self.location.origin,
      tag: 'general-alert'
  };

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
      navigator.setAppBadge(1).catch(() => {});
  }

  // Critical Alert Pattern: Long vibrations
  // Note: True "Silent Mode Override" is reserved for Native Apps, 
  // but this config maximizes visibility on Android.
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    dir: 'rtl',
    lang: 'fa-IR',
    tag: data.tag,
    renotify: true, // Forces sound/vibration even if notification with same tag exists
    requireInteraction: true, // Keeps notification on screen until user interacts
    silent: false,
    // SOS Pattern (...) --- (...)
    vibrate: [
        500, 200, 500, 200, 500, // Long pulses
        500, 
        200, 100, 200, 100, 200 // Short pulses
    ],
    data: {
      url: data.url,
      timestamp: Date.now()
    },
    actions: [
        { action: 'open', title: '🔴 مشاهده فوری' },
        { action: 'close', title: 'بستن' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  
  notification.close();

  if (action === 'close') return;

  if ('clearAppBadge' in navigator) {
      // @ts-ignore
      navigator.clearAppBadge().catch(() => {});
  }

  const urlToOpen = new URL(notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', payload: notification.data });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

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
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
      const { title, options } = event.data.payload;
      self.registration.showNotification(title, options);
  }
});
