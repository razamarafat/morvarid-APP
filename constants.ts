
import { UserRole } from './types';

export const THEMES = {
  light: {
    [UserRole.ADMIN]: {
      primary: 'bg-metro-purple',
      primaryHover: 'hover:bg-metro-darkPurple',
      primaryText: 'text-metro-purple',
      background: 'bg-white',
      surface: 'bg-[#F3F3F3]',
      text: 'text-black',
      border: 'border-metro-purple',
      gradient: 'from-metro-purple to-metro-darkPurple',
      icon: 'text-white'
    },
    [UserRole.REGISTRATION]: {
      primary: 'bg-metro-orange',
      primaryHover: 'hover:bg-amber-600',
      primaryText: 'text-metro-orange',
      background: 'bg-white',
      surface: 'bg-[#F3F3F3]',
      text: 'text-black',
      border: 'border-metro-orange',
      gradient: 'from-metro-orange to-amber-600',
      icon: 'text-white'
    },
    [UserRole.SALES]: {
      primary: 'bg-metro-blue',
      primaryHover: 'hover:bg-metro-cobalt',
      primaryText: 'text-metro-blue',
      background: 'bg-white',
      surface: 'bg-[#F3F3F3]',
      text: 'text-black',
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
      background: 'bg-[#1D1D1D]',
      surface: 'bg-[#2D2D2D]',
      text: 'text-white',
      border: 'border-metro-purple',
      gradient: 'from-metro-purple to-metro-darkPurple',
      icon: 'text-white'
    },
    [UserRole.REGISTRATION]: {
      primary: 'bg-metro-orange',
      primaryHover: 'hover:opacity-90',
      primaryText: 'text-metro-orange',
      background: 'bg-[#1D1D1D]',
      surface: 'bg-[#2D2D2D]',
      text: 'text-white',
      border: 'border-metro-orange',
      gradient: 'from-metro-orange to-amber-600',
      icon: 'text-white'
    },
    [UserRole.SALES]: {
      primary: 'bg-metro-blue',
      primaryHover: 'hover:opacity-90',
      primaryText: 'text-metro-blue',
      background: 'bg-[#1D1D1D]',
      surface: 'bg-[#2D2D2D]',
      text: 'text-white',
      border: 'border-metro-blue',
      gradient: 'from-metro-blue to-metro-cobalt',
      icon: 'text-white'
    },
  }
};

export const APP_VERSION = '1.0.2';
