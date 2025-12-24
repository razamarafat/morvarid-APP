
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { useSyncStore } from '../../store/syncStore';

const OnlineStatusBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queueLength = useSyncStore(state => state.queue.length);

  useEffect(() => {
    const updateOnlineStatus = () => {
        setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Also check when window gains focus (helps when waking from sleep)
    window.addEventListener('focus', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('focus', updateOnlineStatus);
    };
  }, []);

  if (isOnline && queueLength === 0) return null;

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
        !isOnline 
          ? 'bg-red-500 text-white animate-pulse shadow-md' // More visible style for offline
          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
      }`}
    >
      {!isOnline ? (
        <>
          <Icons.Globe className="w-4 h-4" />
          <span>آفلاین (قطع ارتباط)</span>
        </>
      ) : (
        <>
          <Icons.Refresh className="w-4 h-4 animate-spin" />
          <span>در حال ارسال...</span>
        </>
      )}
      
      {queueLength > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full shadow-sm min-w-[1.25rem] text-center ${!isOnline ? 'bg-white text-red-600' : 'bg-white dark:bg-gray-800'}`}>
          {queueLength}
        </span>
      )}
    </div>
  );
};

export default OnlineStatusBadge;
