import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface OfflineIndicatorProps {
  className?: string;
  showWhenOnline?: boolean;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showWhenOnline = false
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);

      // Hide indicator after 3 seconds when back online
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);
    setShowIndicator(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if online and showWhenOnline is false
  if (isOnline && !showWhenOnline) {
    return null;
  }

  // Don't show indicator if online and it's been more than 3 seconds
  if (isOnline && !showIndicator) {
    return null;
  }

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-lg backdrop-blur-md border transition-all duration-300 ${
        isOnline
          ? 'bg-green-500/90 text-white border-green-400/50'
          : 'bg-red-500/90 text-white border-red-400/50'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-white' : 'bg-white animate-pulse'
        }`} />
        <Icons.Globe className="w-4 h-4" />
        <span>
          {isOnline ? 'اتصال برقرار شد' : 'آفلاین'}
        </span>
      </div>
    </div>
  );
};

export default OfflineIndicator;
