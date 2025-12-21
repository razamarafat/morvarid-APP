
export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  // Convert Persian digits
  let result = str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
  // Convert Arabic digits
  result = result.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
  return result;
};

export const toPersianDigits = (str: string | number): string => {
    if (str === undefined || str === null) return '';
    const s = String(str);
    return s.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 1728));
};

export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // 1. Convert everything to English digits first
  let english = toEnglishDigits(dateStr);
  
  // 2. Remove anything that is not a digit or a separator (/ or -)
  english = english.replace(/[^\d/\\-]/g, '');
  
  // 3. Normalize separators to forward slash
  english = english.replace(/[-|\\]/g, '/').trim();

  // 4. Pad Month and Day with zeros (e.g., 9 -> 09)
  const parts = english.split('/');
  if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}/${m}/${d}`; // Always returns YYYY/MM/DD
  }
  
  return english;
};

export const getTodayJalali = (): string => {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      // @ts-ignore
      calendar: 'persian',
      numberingSystem: 'latn'
  };
  const faDate = new Intl.DateTimeFormat('fa-IR', options).format(date);
  return normalizeDate(faDate);
};

export const formatJalali = (date: Date | string | number): string => {
  if (!date) return '';
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      // @ts-ignore
      calendar: 'persian',
      numberingSystem: 'latn'
  };
  try {
    return normalizeDate(new Intl.DateTimeFormat('fa-IR', options).format(d));
  } catch (e) {
    return '';
  }
};

export const getCurrentTime = (): string => {
    // Return time with Persian digits
    const date = new Date();
    const timeStr = date.toLocaleTimeString('fa-IR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
    });
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
