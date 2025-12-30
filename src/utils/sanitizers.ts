
/**
 * Sanitizes user input to prevent XSS attacks.
 * It removes HTML tags and escapes special characters.
 * Preserves Persian characters and numbers.
 */
export const sanitizeInput = (input: string | undefined | null): string => {
  if (!input) return '';

  // 1. Remove HTML tags (Simple Strip)
  let clean = input.replace(/<[^>]*>?/gm, '');

  // 2. Escape special characters to HTML entities
  // This prevents the browser from interpreting them as code
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
  };

  clean = clean.replace(/[&<>"'/]/g, (m) => map[m]);

  return clean.trim();
};

/**
 * Sanitizes an object by running sanitizeInput on all string properties.
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const newObj = { ...obj };
  for (const key in newObj) {
    if (Object.prototype.hasOwnProperty.call(newObj, key)) {
      const value = newObj[key];
      if (typeof value === 'string') {
        // Safe casting because we checked typeof
        (newObj as any)[key] = sanitizeInput(value);
      }
    }
  }
  return newObj;
};
