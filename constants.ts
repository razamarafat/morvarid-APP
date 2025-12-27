
import { UserRole } from './types';

export const THEMES = {
  light: {
    [UserRole.ADMIN]: {
      primary: 'bg-metro-purple',
      primaryHover: 'hover:bg-metro-darkPurple',
      primaryText: 'text-metro-purple',
      background: 'bg-[#FFF8F0]', // Updated to match Login
      surface: 'bg-white',
      text: 'text-gray-900',
      border: 'border-metro-purple',
      gradient: 'from-metro-purple to-metro-darkPurple',
      icon: 'text-white'
    },
    [UserRole.REGISTRATION]: {
      primary: 'bg-metro-orange',
      primaryHover: 'hover:bg-amber-600',
      primaryText: 'text-metro-orange',
      background: 'bg-[#FFF8F0]', // Updated
      surface: 'bg-white',
      text: 'text-gray-900',
      border: 'border-metro-orange',
      gradient: 'from-metro-orange to-amber-600',
      icon: 'text-white'
    },
    [UserRole.SALES]: {
      primary: 'bg-metro-blue',
      primaryHover: 'hover:bg-metro-cobalt',
      primaryText: 'text-metro-blue',
      background: 'bg-[#FFF8F0]', // Updated
      surface: 'bg-white',
      text: 'text-gray-900',
      border: 'border-metro-blue',
      gradient: 'from-metro-blue to-metro-cobalt',
      icon: 'text-white'
    },
  },
  dark: {
    [UserRole.ADMIN]: {
      primary: 'bg-metro-purple',
      primaryHover: 'hover:opacity-90',
      primaryText: 'text-metro-purple',
      background: 'bg-[#0f172a]', // Updated to match Login Dark
      surface: 'bg-[#1e293b]',
      text: 'text-white',
      border: 'border-metro-purple',
      gradient: 'from-metro-purple to-metro-darkPurple',
      icon: 'text-white'
    },
    [UserRole.REGISTRATION]: {
      primary: 'bg-metro-orange',
      primaryHover: 'hover:opacity-90',
      primaryText: 'text-metro-orange',
      background: 'bg-[#0f172a]', // Updated
      surface: 'bg-[#1e293b]',
      text: 'text-white',
      border: 'border-metro-orange',
      gradient: 'from-metro-orange to-amber-600',
      icon: 'text-white'
    },
    [UserRole.SALES]: {
      primary: 'bg-metro-blue',
      primaryHover: 'hover:opacity-90',
      primaryText: 'text-metro-blue',
      background: 'bg-[#0f172a]', // Updated
      surface: 'bg-[#1e293b]',
      text: 'text-white',
      border: 'border-metro-blue',
      gradient: 'from-metro-blue to-metro-cobalt',
      icon: 'text-white'
    },
  }
};

// Restore Point Marker
export const APP_VERSION = '3.4.2';
