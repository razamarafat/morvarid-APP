
import { LogLevel, DeviceInfo } from '../types';

export const getDeviceInfo = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'SSR',
      screenResolution: '0x0',
      language: 'unknown',
      platform: 'server'
    };
  }

  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    platform: navigator.platform,
    connection: conn ? conn.effectiveType : 'unknown'
  };
};

export const formatError = (error: unknown): Record<string, any> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return { raw: String(error) };
    }
  }
  return { message: String(error) };
};

export const getLevelColor = (level: LogLevel): string => {
  switch (level) {
    case 'INFO': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'SUCCESS': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'ERROR': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getLevelIconColor = (level: LogLevel): string => {
    switch (level) {
        case 'INFO': return 'text-blue-500';
        case 'SUCCESS': return 'text-green-500';
        case 'WARNING': return 'text-yellow-500';
        case 'ERROR': return 'text-red-500';
        default: return 'text-gray-500';
    }
}
