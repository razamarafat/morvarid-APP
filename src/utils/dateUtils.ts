
export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  // Convert Persian digits
  let result = str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
  // Convert Arabic digits
  result = result.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
  return result;
};

export const toPersianDigits = (str: string | number | null | undefined): string => {
  if (str === undefined || str === null) return '';
  const s = String(str).replace(/&#x2F;/g, '/');
  return s.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 1728));
};

/**
 * 20260619 — Format a numeric value as a Persian-numeral string WITH the
 * correct locale digit grouping (e.g. "۱٬۲۳۴٬۵۶۷" instead of just
 * "۱۲۳۴۵۶۷").
 *
 * - Uses `Intl.NumberFormat('fa-IR')` for language-aware grouping (uses
 *   Arabic-Indic U+066C as the thousands separator under Persian locale,
 *   which renders as a thin comma in Persian typography).
 * - Falls back to `toPersianDigits()` (no grouping) if `Intl` is
 *   unavailable (very old browsers).
 *
 * NB: This is a UI/DISPLAY utility only. Do NOT use it for arithmetic
 * (Number parsing, JSON serialization, DB writes). Strip the result via
 * `toEnglishDigits(...)` first if you need the underlying value.
 */
export const formatNumberFa = (n: number | string | null | undefined): string => {
  if (n === undefined || n === null) return '';
  try {
    const v = typeof n === 'number' ? n : Number(n);
    if (Number.isFinite(v)) {
      return new Intl.NumberFormat('fa-IR', { useGrouping: true }).format(v);
    }
  } catch (_) { /* old browser without Intl fa-IR */ }
  return toPersianDigits(String(n));
};

export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';

  // 1. Convert to English Digits
  let english = toEnglishDigits(dateStr);

  // 2. Remove invisible control characters (LTR/RTL marks, zero-width spaces)
  english = english.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 3. Remove anything that is not a digit or a separator (added dot)
  english = english.replace(/[^\d/\\.-]/g, '');

  // 4. Normalize separators to forward slash (e.g., -, ., \, |)
  english = english.replace(/[-.\\|]/g, '/').trim();

  // 5. Pad Month and Day with zeros (e.g., 1403/5/1 -> 1403/05/01)
  const parts = english.split('/');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  return english;
};

export const getTodayJalali = (): string => {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    numberingSystem: 'latn'
  };
  const faDate = new Intl.DateTimeFormat('fa-IR', options).format(date);
  return normalizeDate(faDate);
};

export const getTodayDayName = (): string => {
  const date = new Date();
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long', calendar: 'persian' }).format(date);
};

export const formatJalali = (date: Date | string | number): string => {
  if (!date) return '';
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    numberingSystem: 'latn'
  };
  try {
    return normalizeDate(new Intl.DateTimeFormat('fa-IR', options).format(d));
  } catch (e) {
    return '';
  }
};

export const getCurrentTime = (withSeconds: boolean = true): string => {
  // Return time with Persian digits
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  if (withSeconds) {
    options.second = '2-digit';
  }
  const timeStr = date.toLocaleTimeString('fa-IR', options);
  return toPersianDigits(timeStr);
};

export const getTodayJalaliPersian = (): string => {
  const enDate = getTodayJalali();
  return toPersianDigits(enDate);
};

export const isDateInRange = (date: string, startDate: string, endDate: string): boolean => {
  const d = normalizeDate(date);
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  // String comparison works for YYYY/MM/DD format
  return d >= start && d <= end;
};
