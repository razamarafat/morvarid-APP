
// ═════════════════════════════════════════════════════
// FILE: src/utils/logHelpers.ts
// DESCRIPTION: Utility functions for log processing
// ═════════════════════════════════════════════════════

import { LogLevel } from '../types/log.types';

/**
 * Returns Tailwind classes for a given log level
 */
export const getLevelStyles = (level: LogLevel) => {
  switch (level) {
    case 'INFO':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-500',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      };
    case 'SUCCESS':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-500',
        badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      };
    case 'WARNING':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-200 dark:border-yellow-800',
        icon: 'text-yellow-500',
        badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      };
    case 'ERROR':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-500',
        badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        icon: 'text-gray-500',
        badge: 'bg-gray-100 text-gray-800'
      };
  }
};

/**
 * Safely formats any error object into a storable JSON
 */
export const formatErrorObject = (error: unknown): Record<string, any> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Fix: Cast to any to access 'cause' since standard Error type definition might not include it in target env
      cause: (error as any).cause ? formatErrorObject((error as any).cause) : undefined
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

/**
 * Generates a consistent color for category badges
 */
export const getCategoryColor = (category: string): string => {
  const colors = [
    'bg-purple-100 text-purple-800',
    'bg-indigo-100 text-indigo-800',
    'bg-pink-100 text-pink-800',
    'bg-teal-100 text-teal-800',
    'bg-orange-100 text-orange-800',
    'bg-cyan-100 text-cyan-800'
  ];
  
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};
