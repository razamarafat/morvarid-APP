
// ═════════════════════════════════════════════════════
// FILE: src/constants/logMessages.ts
// DESCRIPTION: Standardized Persian messages for logs
// ═════════════════════════════════════════════════════

export const LOG_MESSAGES = {
  // Authentication
  'AUTH_LOGIN_SUCCESS': 'ورود موفق به سیستم',
  'AUTH_LOGIN_FAILED': 'تلاش ناموفق برای ورود',
  'AUTH_LOGOUT': 'خروج از حساب کاربری',
  'AUTH_SESSION_EXPIRED': 'نشست کاربری منقضی شد',
  'AUTH_UNAUTHORIZED': 'دسترسی غیرمجاز تشخیص داده شد',

  // Database
  'DB_CONNECT_SUCCESS': 'اتصال به دیتابیس برقرار شد',
  'DB_CONNECT_FAILED': 'خطا در اتصال به دیتابیس',
  'DB_QUERY_SUCCESS': 'عملیات دیتابیس با موفقیت انجام شد',
  'DB_QUERY_FAILED': 'خطا در اجرای کوئری دیتابیس',
  'DB_BACKUP_CREATED': 'نسخه پشتیبان ایجاد شد',

  // CRUD
  'CREATE_SUCCESS': 'رکورد جدید با موفقیت ثبت شد',
  'CREATE_FAILED': 'خطا در ثبت رکورد جدید',
  'UPDATE_SUCCESS': 'ویرایش اطلاعات با موفقیت انجام شد',
  'UPDATE_FAILED': 'خطا در ویرایش اطلاعات',
  'DELETE_SUCCESS': 'حذف رکورد با موفقیت انجام شد',
  'DELETE_FAILED': 'خطا در حذف رکورد',

  // Network / System
  'NETWORK_ONLINE': 'ارتباط اینترنت برقرار شد',
  'NETWORK_OFFLINE': 'ارتباط اینترنت قطع شد',
  'SYSTEM_STARTUP': 'سیستم راه‌اندازی شد',
  'SYSTEM_ERROR': 'خطای داخلی سیستم',
  'PWA_INSTALLED': 'نسخه PWA نصب شد',

  // Feature Tests
  'TEST_INIT': 'شروع تست عملکرد',
  'TEST_SUCCESS': 'تست عملکرد با موفقیت پاس شد',
  'TEST_FAILED': 'تست عملکرد مردود شد',

  // UI
  'UI_BUTTON_CLICK': 'کلیک روی دکمه',
  'UI_FORM_SUBMIT': 'ارسال فرم',
  'UI_NAVIGATION': 'تغییر صفحه',
  
  // Generic
  'OPERATION_SUCCESS': 'عملیات موفق',
  'OPERATION_FAILED': 'عملیات ناموفق',
} as const;
