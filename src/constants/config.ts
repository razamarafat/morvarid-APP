/**
 * 📊 MORVARID CONFIGURATION CONSTANTS
 * ═══════════════════════════════════
 * 
 * تمام اعداد ثابت و تنظیمات سیستم در اینجا متمرکز شده‌اند
 * برای بهبود خوانایی و نگهداری آسان‌تر کد
 */

// ⏱️ TIMING CONSTANTS
export const TIMING = {
  // Debounce & Throttling
  AUTO_SAVE_DEBOUNCE: 1000,           // ms - زمان تاخیر auto-save
  SEARCH_DEBOUNCE: 300,               // ms - زمان تاخیر جستجو
  UI_FEEDBACK_DELAY: 500,             // ms - تاخیر فیدبک UI
  
  // Intervals
  TIME_UPDATE_INTERVAL: 30000,        // ms - به‌روزرسانی زمان (30 ثانیه)
  AUTO_THEME_CHECK: 1000,             // ms - چک حالت تم
  VERSION_CHECK_INTERVAL: 30000,      // ms - چک نسخه جدید
  ACTIVITY_THROTTLE: 10000,           // ms - throttle فعالیت کاربر
  INACTIVITY_CHECK: 60000,            // ms - چک عدم فعالیت (1 دقیقه)
  AUTO_BACKUP_INTERVAL: 5 * 60 * 1000, // ms - پشتیبان‌گیری خودکار (5 دقیقه)
  
  // Timeouts
  SPLASH_SCREEN_DURATION: 1500,       // ms - مدت نمایش صفحه آغاز
  PERMISSION_CHECK_DELAY: 1500,       // ms - تاخیر چک دسترسی‌ها
  TOAST_AUTO_HIDE: 5000,              // ms - مخفی شدن toast
  DOUBLE_BACK_EXIT_WINDOW: 2000,      // ms - پنجره زمانی دوبار فشردن back
  REFRESH_ANIMATION_DURATION: 500,    // ms - انیمیشن رفرش
  SW_READY_TIMEOUT: 5000,             // ms - timeout آماده‌سازی service worker
  ALERT_ANIMATION_DELAY: 1500,        // ms - تاخیر انیمیشن alert
  SIDEBAR_ANIMATION_DELAY: 100,       // ms - تاخیر انیمیشن sidebar
} as const;

// 🔐 SECURITY CONSTANTS
export const SECURITY = {
  // Cryptography
  PBKDF2_ITERATIONS: 100000,          // تعداد تکرار PBKDF2
  SESSION_TIMEOUT: 3600000,           // ms - timeout نشست (1 ساعت)
  INACTIVITY_TIMEOUT: 3600000,        // ms - timeout عدم فعالیت (1 ساعت)
  
  // Session Management
  EXPIRATION_ALERT_THRESHOLD: 14400000, // ms - آغاز هشدار انقضا (4 ساعت)
  EXPIRATION_CHECK_INTERVAL: 300000,   // ms - چک انقضا (5 دقیقه)
} as const;

// 💾 STORAGE & CACHE CONSTANTS
export const STORAGE = {
  // Cache Settings
  MAX_CACHE_ENTRIES: 60,              // حداکثر ورودی cache
  CACHE_MAX_AGE: 30 * 24 * 60 * 60,   // seconds - حداکثر عمر cache (30 روز)
  
  // Local Storage Keys
  THEME_KEY: 'morvarid-theme',
  USER_PREFERENCES_KEY: 'morvarid-prefs',
  DRAFT_KEY_PREFIX: 'morvarid-draft-',
  
  // IndexedDB Settings (برای آینده)
  IDB_VERSION: 1,
  IDB_NAME: 'morvarid-db',
  IDB_STORES: {
    STATISTICS: 'statistics',
    INVOICES: 'invoices',
    FARMS: 'farms',
    DRAFTS: 'drafts'
  }
} as const;

// 🌐 PWA CONSTANTS
export const PWA = {
  // Service Worker
  SW_SCOPE: '/',
  SW_FILE: '/sw.js',
  
  // Periodic Sync
  PERIODIC_SYNC_MIN_INTERVAL: 12 * 60 * 60 * 1000, // ms - حداقل فاصله sync (12 ساعت)
  
  // Installation
  INSTALL_PROMPT_DELAY: 2000,         // ms - تاخیر نمایش prompt نصب
  
  // Offline
  OFFLINE_RETRY_ATTEMPTS: 3,
  OFFLINE_RETRY_DELAY: 1000,          // ms - تاخیر بین تلاش‌ها
} as const;

// 🎨 UI/UX CONSTANTS
export const UI = {
  // Animations
  PAGE_TRANSITION_DURATION: 300,      // ms - مدت انیمیشن تغییر صفحه
  MODAL_TRANSITION_DURATION: 200,     // ms - مدت انیمیشن modal
  TOAST_SLIDE_DURATION: 250,          // ms - مدت انیمیشن toast
  
  // Layout
  SIDEBAR_WIDTH: 280,                  // px - عرض sidebar
  HEADER_HEIGHT: 64,                   // px - ارتفاع header
  MOBILE_BREAKPOINT: 768,              // px - breakpoint موبایل
  
  // Scroll
  CUSTOM_SCROLLBAR_WIDTH: 6,           // px - عرض scrollbar سفارشی
  
  // Touch
  MIN_TOUCH_TARGET: 44,                // px - حداقل سایز touch target
} as const;

// 🔢 BUSINESS LOGIC CONSTANTS
export const BUSINESS = {
  // Validation Limits
  MAX_INVOICE_ITEMS: 100,              // حداکثر آیتم در فاکتور
  MAX_FARM_CAPACITY: 10000,            // حداکثر ظرفیت فارم
  MIN_PASSWORD_LENGTH: 8,              // حداقل طول رمز عبور
  
  // Default Values
  DEFAULT_CURRENCY: 'IRR',
  DEFAULT_LOCALE: 'fa-IR',
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// 📱 MOBILE-SPECIFIC CONSTANTS
export const MOBILE = {
  // Performance
  VIRTUAL_LIST_THRESHOLD: 50,          // تعداد آیتم برای virtual scrolling
  IMAGE_COMPRESSION_QUALITY: 0.8,     // کیفیت فشرده‌سازی تصاویر
  
  // Touch Gestures
  SWIPE_THRESHOLD: 50,                 // px - حداقل مسافت swipe
  DOUBLE_TAP_WINDOW: 300,              // ms - پنجره زمانی double tap
  
  // Battery Optimization
  BACKGROUND_SYNC_DELAY: 30000,        // ms - تاخیر sync در background
} as const;

// 📊 ANALYTICS & MONITORING
export const ANALYTICS = {
  // Performance Metrics
  PERFORMANCE_MARK_PREFIX: 'morvarid-',
  FCP_THRESHOLD: 1800,                 // ms - آستانه First Contentful Paint
  LCP_THRESHOLD: 2500,                 // ms - آستانه Largest Contentful Paint
  
  // Error Tracking
  MAX_ERROR_LOGS: 50,                  // حداکثر لاگ خطا محلی
  ERROR_BATCH_SIZE: 10,                // اندازه دسته ارسال خطا
} as const;

// 🔄 SYNC & OFFLINE CONSTANTS
export const SYNC = {
  // Queue Management
  MAX_SYNC_QUEUE_SIZE: 100,            // حداکثر سایز صف sync
  SYNC_RETRY_ATTEMPTS: 3,              // تعداد تلاش مجدد
  SYNC_BACKOFF_MULTIPLIER: 2,          // ضریب backoff
  
  // Conflict Resolution
  CONFLICT_RESOLUTION_TIMEOUT: 5000,   // ms - timeout حل تعارض
} as const;

// 🚀 DEVELOPMENT CONSTANTS
export const DEV = {
  // Debug Logging
  LOG_LEVEL: 'debug',
  ENABLE_REDUX_DEVTOOLS: true,
  
  // Hot Module Replacement
  HMR_TIMEOUT: 2000,                   // ms - timeout HMR
} as const;

// ⚙️ FEATURE FLAGS (برای کنترل ویژگی‌ها)
export const FEATURES = {
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_AUTO_BACKUP: true,
  ENABLE_ANALYTICS: false,             // غیرفعال در نسخه فعلی
} as const;

// 📋 EXPORT ALL CONSTANTS
export const CONFIG = {
  TIMING,
  SECURITY,
  STORAGE,
  PWA,
  UI,
  BUSINESS,
  MOBILE,
  ANALYTICS,
  SYNC,
  DEV,
  FEATURES
} as const;

export default CONFIG;