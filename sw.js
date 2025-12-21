
// sw.js - Morvarid PWA Service Worker v1.7
const CACHE_NAME = 'morvarid-v1.7';

// دارایی‌هایی که باید برای کارکرد آفلاین کش شوند
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap'
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
// این بهترین استراتژی برای برنامه‌های آماری است که داده‌های تازه نیاز دارند
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // جلوگیری از کش کردن درخواست‌های API (Supabase) برای جلوگیری از تداخل داده‌ای
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // اگر پاسخ معتبر بود، آن را در کش کپی کن
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // اگر اینترنت نبود، از کش برگردان
        return caches.match(event.request);
      })
  );
});

// مدیریت نوتیفیکیشن
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
