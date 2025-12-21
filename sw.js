
const CACHE_NAME = 'morvarid-pwa-v3.3'; // Increment version to force update
const ASSETS = [
  './',
  './index.html',
  './vite.svg',
  './manifest.json'
];

// 1. Install Event: Cache assets and force activation
self.addEventListener('install', (event) => {
  self.skipWaiting(); // IMPORTANT: Forces the waiting SW to become the active SW
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activate Event: Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim(); // IMPORTANT: Takes control of the page immediately
});

// 3. Fetch Event: Network First strategy (safest for dynamic apps)
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (like Supabase)
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Handle navigation requests (SPA support)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // General Resource Strategy: Cache First, fall back to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
              // Only cache valid responses
              if(response.status === 200) {
                  cache.put(event.request, response.clone());
              }
              return response;
          });
      });
    })
  );
});

// 4. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});
