// Service Worker without external dependencies
// Manual implementation of essential caching strategies

// Cache management utilities
class CacheManager {
  constructor(cacheName, options = {}) {
    this.cacheName = cacheName;
    this.maxEntries = options.maxEntries || 50;
    this.maxAgeSeconds = options.maxAgeSeconds || 30 * 24 * 60 * 60;
  }

  async cleanupExpired() {
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const cachedDate = response.headers.get('sw-cached-date');
        if (cachedDate) {
          const age = (Date.now() - parseInt(cachedDate)) / 1000;
          if (age > this.maxAgeSeconds) {
            await cache.delete(request);
          }
        }
      }
    }
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

// Simple background sync queue
class SimpleBackgroundSync {
  constructor(queueName) {
    this.queueName = queueName;
    this.queue = [];
  }

  async addRequest(request) {
    this.queue.push(request.clone());
    // Try to replay immediately if online
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
        // Put it back if failed
        this.queue.unshift(request);
        break;
      }
    }
  }
}

const CACHE_PREFIX = 'morvarid';
const CURRENT_CACHE_ID = 'v3.9.4'; // Synced with package.json
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CURRENT_CACHE_ID}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CURRENT_CACHE_ID}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CURRENT_CACHE_ID}`;

console.log(`[SW] Local caching loaded (${CURRENT_CACHE_ID})`);

// Initialize cache managers
const staticCacheManager = new CacheManager(STATIC_CACHE, { maxEntries: 60 });
const imageCacheManager = new CacheManager(IMAGE_CACHE, { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 });
const apiCacheManager = new CacheManager(API_CACHE, { maxEntries: 50, maxAgeSeconds: 60 });
const bgSync = new SimpleBackgroundSync('sync-queue');

// 1. Force SW to activate immediately
self.skipWaiting();

// 2. Activation and cleanup
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Manual cache cleanup for versioned caches
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
      }),
      // Clean up expired entries
      staticCacheManager.cleanupExpired(),
      imageCacheManager.cleanupExpired(),
      apiCacheManager.cleanupExpired()
    ])
  );
});

// 3. Fetch event handler with manual caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle different types of requests
  if (url.pathname.includes('/assets/')) {
    // Hashed assets - cache first
    event.respondWith(handleAssets(request));
  } else if (request.destination === 'script' || request.destination === 'style' || request.destination === 'document') {
    // Core files - stale while revalidate
    event.respondWith(handleCoreFiles(request));
  } else if (request.destination === 'image' || request.destination === 'font') {
    // Images and fonts - cache first with expiration
    event.respondWith(handleImages(request));
  } else if (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/')) {
    // Auth endpoints - network first
    event.respondWith(handleAuth(request));
  } else if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    // API endpoints - stale while revalidate with background sync
    event.respondWith(handleAPI(request));
  }
});

// Cache strategies implementation
async function handleAssets(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    // Update in background
    fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Asset fetch failed:', error);
    throw error;
  }
}

async function handleCoreFiles(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      // Create new Response with custom header instead of modifying existing one
      const headers = new Headers(response.headers);
      headers.set('sw-cached-date', Date.now().toString());
      const responseToCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
      cache.put(request, responseToCache);
    }
    return response;
  }).catch(error => {
    // Handle CSP errors gracefully - don't throw, just return cached version or fail silently
    if (error.message && error.message.includes('violates the document')) {
      console.debug('[SW] Resource blocked by CSP, skipping cache:', request.url);
      return cached || fetch(request); // Try original request without caching
    }
    console.error('[SW] Core file fetch failed:', error);
    if (cached) return cached;
    throw error;
  });

  return cached || fetchPromise;
}

async function handleImages(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    imageCacheManager.limitEntries();
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Create new Response with custom header instead of modifying existing one
      const headers = new Headers(response.headers);
      headers.set('sw-cached-date', Date.now().toString());
      const responseToCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
      cache.put(request, responseToCache);
      imageCacheManager.limitEntries();
    }
    return response;
  } catch (error) {
    console.error('[SW] Image fetch failed:', error);
    throw error;
  }
}

async function handleAuth(request) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 3000))
    ]);
    return response;
  } catch (error) {
    console.error('[SW] Auth Request Failed:', request.url);
    throw error;
  }
}

async function handleAPI(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok && response.status >= 200 && response.status < 400) {
      // Create new Response with custom header instead of modifying existing one
      const headers = new Headers(response.headers);
      headers.set('sw-cached-date', Date.now().toString());
      const responseToCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
      cache.put(request, responseToCache);
      apiCacheManager.limitEntries();
    }
    return response;
  }).catch(error => {
    console.error('[SW] API Request Failed:', request.url);
    // Add to background sync queue for retry
    bgSync.addRequest(request);
    if (cached) return cached;
    throw error;
  });
  
  return cached || fetchPromise;
}

// --- VAPID KEYS CONFIGURATION ---
// Get VAPID key from environment (injected during build)
let VAPID_PUBLIC_KEY = null;
try {
  // This will be replaced during build by Vite if VITE_VAPID_PUBLIC_KEY is set
  VAPID_PUBLIC_KEY = '__VITE_VAPID_PUBLIC_KEY__';
  if (VAPID_PUBLIC_KEY === '__VITE_VAPID_PUBLIC_KEY__') {
    VAPID_PUBLIC_KEY = null; // Not replaced, so not configured
  }
} catch (e) {
  VAPID_PUBLIC_KEY = null;
}

// Check if VAPID key is available and log appropriately
if (!VAPID_PUBLIC_KEY) {
  // Only log as debug to reduce console noise - push notifications are optional
  console.debug('[SW] VAPID Public Key not configured - push notifications disabled (optional feature)');
} else {
  console.log('[SW] VAPID Public Key configured successfully');
}

// --- ENHANCED PUSH NOTIFICATION HANDLER ---

// Function to validate and convert VAPID key
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

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
    if (event.data) {
      const json = event.data.json();
      data = { ...data, ...json };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    dir: 'rtl',
    lang: 'fa-IR',
    renotify: true,
    tag: data.tag || 'morvarid-notification',
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    data: { 
      url: data.url,
      action: data.action,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'مشاهده',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'بستن',
        icon: '/icons/icon-192x192.png'
      }
    ]
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

// Handle online/offline status changes for background sync
self.addEventListener('online', () => {
  console.log('[SW] App is back online, replaying queued requests...');
  bgSync.replayRequests();
});

// Initialize and announce service worker status
console.log('[SW] Service Worker initialized successfully');
console.log('[SW] Cache strategy: Local caching without external dependencies');
console.log('[SW] Background sync: Enabled');
console.log('[SW] Push notifications:', VAPID_PUBLIC_KEY ? 'Enabled' : 'Disabled (no VAPID key)');
