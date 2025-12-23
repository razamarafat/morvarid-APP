/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 [SW] Skip waiting triggered');
    self.skipWaiting();
  }
});

self.addEventListener('install', () => {
  console.log('✅ [SW] Installing new version...');
});

self.addEventListener('activate', () => {
  console.log('✅ [SW] New version activated!');
});

export {};
