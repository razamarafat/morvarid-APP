/**
 * Sanitizes a string by removing HTML tags and trimming whitespace.
 * Designed to be safe and preserve Persian characters.
 */
export const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;
  if (!str) return '';

  // Remove HTML tags to prevent XSS
  // This approach is lightweight and avoids common tag-based injection
  let sanitized = str.replace(/<[^>]*>?/gm, '');

  // Optional: Convert common dangerous characters to their entities if needed
  // For this lightweight implementation, removing tags is the primary goal

  return sanitized.trim();
};

/**
 * Recursively sanitizes all string properties within an object.
 */
export const sanitizeObject = <T>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as any;
  }

  const sanitized = { ...obj } as any;

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      }
    }
  }

  return sanitized;
};
