
/*
 * Morvarid PWA Service Worker
 * Optimized for Automatic Updates & Notifications
 */

const CACHE_NAME = 'morvarid-pwa-v4.1-notification-fix'; 
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
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (event.request.url.includes('version.json')) {
      event.respondWith(fetch(event.request, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
      }));
      return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

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

self.addEventListener('push', (event) => {
  // This listener handles Server-Sent Push Notifications (Web Push API)
  // For local notifications triggered by client-side logic, see alertStore.ts
  let data = { title: 'سامانه مروارید', body: 'پیام جدید', icon: './vite.svg' };
  
  if (event.data) {
    try {
        data = event.data.json();
    } catch(e) {
        data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './vite.svg',
    badge: './vite.svg',
    dir: 'rtl',
    lang: 'fa-IR',
    vibrate: [200, 100, 200],
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  // Robust window focus logic
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Try to find an open tab matching our origin
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. If no tab open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
