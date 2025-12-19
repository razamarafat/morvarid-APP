
import { UserRole } from './types';

export const THEMES = {
  light: {
    [UserRole.ADMIN]: {
      primary: 'bg-violet-600',
      primaryHover: 'hover:bg-violet-700',
      primaryText: 'text-violet-600',
      background: 'bg-gray-100',
      surface: 'bg-white',
      text: 'text-gray-800',
      border: 'border-violet-600',
      gradient: 'from-violet-50 to-purple-100',
      icon: 'text-violet-500'
    },
    [UserRole.REGISTRATION]: {
      primary: 'bg-orange-500',
      primaryHover: 'hover:bg-orange-600',
      primaryText: 'text-orange-500',
      background: 'bg-orange-50',
      surface: 'bg-white',
      text: 'text-gray-800',
      border: 'border-orange-500',
      gradient: 'from-orange-50 to-amber-100',
      icon: 'text-orange-500'
    },
    [UserRole.SALES]: {
      primary: 'bg-blue-600',
      primaryHover: 'hover:bg-blue-700',
      primaryText: 'text-blue-600',
      background: 'bg-blue-50',
      surface: 'bg-white',
      text: 'text-gray-800',
      border: 'border-blue-600',
      gradient: 'from-blue-50 to-sky-100',
      icon: 'text-blue-500'
    },
  },
  dark: {
    [UserRole.ADMIN]: {
      primary: 'bg-violet-500',
      primaryHover: 'hover:bg-violet-600',
      primaryText: 'text-violet-400',
      background: 'bg-gray-900',
      surface: 'bg-gray-800',
      text: 'text-gray-200',
      border: 'border-violet-500',
      gradient: 'from-gray-800 to-violet-900',
      icon: 'text-violet-400'
    },
    [UserRole.REGISTRATION]: {
      primary: 'bg-orange-500',
      primaryHover: 'hover:bg-orange-600',
      primaryText: 'text-orange-400',
      background: 'bg-gray-900',
      surface: 'bg-gray-800',
      text: 'text-gray-200',
      border: 'border-orange-500',
      gradient: 'from-gray-800 to-orange-900',
      icon: 'text-orange-400'
    },
    [UserRole.SALES]: {
      primary: 'bg-blue-500',
      primaryHover: 'hover:bg-blue-600',
      primaryText: 'text-blue-400',
      background: 'bg-gray-900',
      surface: 'bg-gray-800',
      text: 'text-gray-200',
      border: 'border-blue-500',
      gradient: 'from-gray-800 to-blue-900',
      icon: 'text-blue-400'
    },
  }
};

export const APP_VERSION = '1.0.0';
