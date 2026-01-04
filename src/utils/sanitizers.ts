/**
 * Sanitizes a string by removing HTML tags and trimming whitespace.
 * Designed to be safe and preserve Persian characters.
 */
export const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;
  if (!str) return '';

  // Enhanced XSS Protection
  let sanitized = str
    // Remove HTML tags
    .replace(/<[^>]*>?/gm, '')
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: and data: URLs
    .replace(/javascript:/gi, '')
    .replace(/data:(?!image\/(png|jpe?g|gif|webp|svg))/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Convert dangerous characters
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

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
