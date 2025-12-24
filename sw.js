
/*
 * Morvarid PWA Service Worker
 * Optimized for Automatic Updates & Immediate Claiming
 */

// We use a dynamic cache name here, but the main update logic is driven by
// the 'useAutoUpdate' hook which clears caches on version mismatch.
const CACHE_NAME = 'morvarid-pwa-v3.6-auto'; 
const ASSETS = [
  './',
  './index.html',
  './vite.svg',
  './manifest.json'
];

// 1. Install Event: Force waiting service worker to become active
self.addEventListener('install', (event) => {
  self.skipWaiting(); // CRITICAL: Forces this new SW to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activate Event: Clean old caches and take control of all tabs immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // CRITICAL: Tells the SW to take control of the page immediately, not after reload
  return self.clients.claim(); 
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Never cache version.json so the client always gets the latest
  if (event.request.url.includes('version.json')) {
      event.respondWith(fetch(event.request));
      return;
  }

  // SPA Navigation: Always serve index.html for navigation, but try network first to ensure freshness
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Stale-While-Revalidate Strategy for other assets
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

// 4. Push Event
self.addEventListener('push', (event) => {
  let data = { title: 'سامانه مروارید', body: 'پیام جدید دریافت شد', icon: './vite.svg' };
  
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
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
