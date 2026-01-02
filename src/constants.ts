
import { UserRole } from './types';

export const THEMES = {
  light: {
    [UserRole.ADMIN]: {
      primary: 'bg-metro-purple',
      primaryHover: 'hover:bg-metro-darkPurple',
      primaryText: 'text-metro-purple',
      background: 'bg-[#FFF8F0]',
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
      background: 'bg-[#FFF8F0]',
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
      background: 'bg-[#FFF8F0]',
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
      background: 'bg-[#0f172a]',
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
      background: 'bg-[#0f172a]',
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
      background: 'bg-[#0f172a]',
      surface: 'bg-[#1e293b]',
      text: 'text-white',
      border: 'border-metro-blue',
      gradient: 'from-metro-blue to-metro-cobalt',
      icon: 'text-white'
    },
  }
};

/**
 * APPLICATION VERSION CONTROL
 * ---------------------------
 * Current Version: 3.2.1
 * 
 * UPDATE LOGIC (Strict SemVer):
 * 1. PATCH (z): Increments on bug fixes/minor tweaks (e.g., 3.0.0 -> 3.0.1).
 *    - RULE: If 'z' reaches 9, reset 'z' to 0 and increment 'y'.
 *    - Example: 3.0.9 -> 3.1.0 (NOT 3.0.10).
 * 2. MINOR (y): Increments on new features or when Patch wraps.
 * 3. MAJOR (x): Increments only on major breaking changes/rewrites.
 * 
 * NOTE: Provide 'package.json' update in every XML output to keep sync.
 */
declare const __APP_VERSION__: string;
export const APP_VERSION = '3.2.0';
