
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { useSyncStore } from '../../store/syncStore';

const OnlineStatusBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queueLength = useSyncStore(state => state.queue.length);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && queueLength === 0) return null;

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
        !isOnline 
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse' 
          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
      }`}
    >
      {!isOnline ? (
        <>
          <Icons.Globe className="w-4 h-4" />
          <span>آفلاین</span>
        </>
      ) : (
        <>
          <Icons.Refresh className="w-4 h-4 animate-spin" />
          <span>در حال همگام‌سازی...</span>
        </>
      )}
      
      {queueLength > 0 && (
        <span className="bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-full shadow-sm min-w-[1.25rem] text-center">
          {queueLength}
        </span>
      )}
    </div>
  );
};

export default OnlineStatusBadge;
