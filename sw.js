
/*
 * Morvarid PWA Service Worker
 * Version: 2.8.1
 * Features: High Priority Notifications, Persistent Caching, Background Sync
 */

const CACHE_NAME = 'morvarid-core-v2.8.1';
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

// --- ENHANCED PUSH HANDLER (Critical Alert) ---
self.addEventListener('push', (event) => {
  console.log('[SW] Push Received');
  
  let data = { 
      title: 'سامانه مروارید', 
      body: 'پیام جدید دریافت شد', 
      url: self.location.origin,
      tag: 'farm-alert'
  };

  if (event.data) {
    try {
        const json = event.data.json();
        data = { ...data, ...json };
    } catch(e) {
        const text = event.data.text();
        if (text) data.body = text;
    }
  }

  if ('setAppBadge' in navigator) {
      // @ts-ignore
      navigator.setAppBadge(1).catch(() => {});
  }

  // Configuration for System Notification
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png', // Must exist in public folder
    badge: '/icons/icon-192x192.png',
    dir: 'rtl',
    lang: 'fa-IR',
    tag: data.tag,
    renotify: true, 
    requireInteraction: true, 
    silent: false,
    vibrate: [500, 200, 500], // Vibration pattern for mobile
    data: {
      url: data.url,
      timestamp: Date.now()
    },
    actions: [
        { action: 'open', title: 'مشاهده' }
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

  if ('clearAppBadge' in navigator) {
      // @ts-ignore
      navigator.clearAppBadge().catch(() => {});
  }

  const urlToOpen = new URL(notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', payload: notification.data });
          return client.focus();
        }
      }
      // If not, open a new window
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