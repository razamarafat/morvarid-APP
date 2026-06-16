
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
 * Current Version: 4.1.5
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
export const APP_VERSION = __APP_VERSION__;

/**
 * NOTIFICATION CONFIGURATION
 * --------------------------
 * Service Worker update notifications will NOT play alert sounds.
 * Only toast messages and system notifications (silent) are shown.
 */
export const NOTIFICATION_SOUND_ENABLED = false;

/**
 * TOAST DEDUPLICATION IDS
 * -----------------------
 * Fixed IDs for system toast messages to prevent duplicates.
 * Each system event should have a unique, constant ID.
 */
export const TOAST_IDS = {
  UPDATE_AVAILABLE: 'update-available',
  SYSTEM_UPDATE: 'system-update',
  SESSION_EXPIRED: 'session-expired',
  OFFLINE_STATUS: 'offline-status',
  NETWORK_ERROR: 'network-error',
  LOGIN_SUCCESS: 'login-success',
  LOGIN_ERROR: 'login-error',
  ACCOUNT_BLOCKED: 'account-blocked',
} as const;

// ============================
// Sales Voucher Constants (ثابت‌های سیستم حواله فروش)
// ============================

/**
 * برچسب‌های فارسی وضعیت‌های حواله فروش
 */
export const SALES_VOUCHER_STATUS_LABELS: Record<string, string> = {
  submitted: 'ثبت شده',
};

/**
 * رنگ‌های وضعیت‌های حواله فروش (برای Badge ها)
 */
export const SALES_VOUCHER_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  submitted: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-300 dark:border-violet-700',
  },
};

/**
 * برچسب‌های فارسی انواع تراکنش انبار
 */
export const INVENTORY_TXN_TYPE_LABELS: Record<string, string> = {
  purchase: 'خرید',
  sale: 'فروش (حواله)',
  sale_reversal: 'برگشت از فروش',
  daily_consumption: 'مصرف روزانه',
  adjustment: 'اصلاح موجودی',
  return: 'مرجوعی',
};

/**
 * تم بنفش (Violet) مخصوص سیستم حواله فروش
 * این رنگ‌ها با پالت رنگی موجود (metro-purple: #9F00A7) هماهنگ هستند
 * و یک طیف بنفش ملایم‌تر و حرفه‌ای ایجاد می‌کنند
 */
export const SALES_VOUCHER_THEME = {
  primary: '#7C3AED',        // Violet-600 - بنفش اصلی
  primaryHover: '#6D28D9',   // Violet-700 - حالت هاور
  primaryLight: '#EDE9FE',   // Violet-100 - پس‌زمینه روشن
  primaryDark: '#5B21B6',    // Violet-800 - حالت تاریک
  accent: '#8B5CF6',         // Violet-500 - تأکید
  gradient: 'from-violet-500 to-purple-600',
  gradientDark: 'from-violet-700 to-purple-900',
} as const;