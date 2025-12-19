
export const toEnglishDigits = (str: string): string => {
  return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
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
  return faDate;
};

export const formatJalali = (date: Date | string | number): string => {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      // @ts-ignore
      calendar: 'persian',
      numberingSystem: 'latn'
  };
  return new Intl.DateTimeFormat('fa-IR', options).format(d);
};

export const getCurrentTime = (): string => {
    // @ts-ignore
    return new Date().toLocaleTimeString('fa-IR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        numberingSystem: 'latn' 
    });
};

// Helper to check if a date string falls within a range
export const isDateInRange = (date: string, startDate: string, endDate: string): boolean => {
  const d = toEnglishDigits(date);
  const start = toEnglishDigits(startDate);
  const end = toEnglishDigits(endDate);
  return d >= start && d <= end;
};
