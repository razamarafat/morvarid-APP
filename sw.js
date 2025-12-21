
// sw.js - Morvarid PWA Service Worker v2.0
const CACHE_NAME = 'morvarid-v2.0';

// دارایی‌هایی که باید برای کارکرد آفلاین کش شوند
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdn.tailwindcss.com'
];

// نصب سرویس ورکر
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// فعال‌سازی و حذف کش‌های قدیمی
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// استراتژی کش: Network First, falling back to Cache
// برای فایل‌های استاتیک و navigation fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // جلوگیری از کش کردن درخواست‌های API (Supabase)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // درخواست‌های Navigation (تغییر صفحه) را به index.html هدایت کن تا SPA کار کند
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // کش کردن پاسخ‌های موفق
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // بازگشت از کش در صورت آفلاین بودن
        return caches.match(event.request);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // اگر پنجره‌ای باز است روی آن فوکوس کن
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      // اگر نه، پنجره جدید باز کن
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
