import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        console.log('✅ [PWA] Service Worker ready');

        // Check for updates every 60 seconds
        const interval = setInterval(() => {
          registration.update();
          console.log('🔄 [PWA] Checking for updates...');
        }, 60 * 1000);

        // Listen for new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🆕 [PWA] New service worker found');

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ [PWA] New version available!');
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });

        return () => clearInterval(interval);
      });

      // Listen for controller change (when new SW takes over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 [PWA] Reloading for new version...');
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setShowUpdate(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-2xl z-[9999] animate-slide-up"
      style={{
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      
      <div className="flex items-start gap-3">
        <div className="text-2xl">🎉</div>
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">نسخه جدید آماده است!</h3>
          <p className="text-blue-100 text-sm mb-3">
            برای دریافت آخرین تغییرات، برنامه را بروزرسانی کنید.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="flex-1 bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors"
            >
              🔄 بروزرسانی
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg border border-white/30 hover:bg-white/10 transition-colors"
            >
              بعداً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateNotification;
