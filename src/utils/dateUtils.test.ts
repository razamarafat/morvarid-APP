
import { describe, it, expect } from 'vitest';
import { toEnglishDigits, toPersianDigits, normalizeDate } from './dateUtils';

describe('Utility Functions', () => {
  
  describe('toEnglishDigits', () => {
    it('should convert Persian digits to English digits', () => {
      expect(toEnglishDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
    });

    it('should convert Arabic digits to English digits', () => {
      expect(toEnglishDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    });

    it('should handle mixed input', () => {
      expect(toEnglishDigits('User۱۲۳')).toBe('User123');
    });

    it('should handle empty or null input', () => {
      expect(toEnglishDigits('')).toBe('');
      // @ts-ignore
      expect(toEnglishDigits(null)).toBe('');
    });
  });

  describe('toPersianDigits', () => {
    it('should convert English digits to Persian digits', () => {
      expect(toPersianDigits('1234567890')).toBe('۱۲۳۴۵۶۷۸۹۰');
    });

    it('should handle number input', () => {
      expect(toPersianDigits(123)).toBe('۱۲۳');
    });

    it('should handle empty input', () => {
      expect(toPersianDigits('')).toBe('');
    });
  });

  describe('normalizeDate', () => {
    it('should normalize standard Persian date', () => {
      expect(normalizeDate('1403/1/1')).toBe('1403/01/01');
    });

    it('should normalize date with Persian digits', () => {
      expect(normalizeDate('۱۴۰۳/۲/۵')).toBe('1403/02/05');
    });

    it('should handle different separators', () => {
      expect(normalizeDate('1403-5-20')).toBe('1403/05/20');
    });

    it('should remove invisible characters', () => {
      // Simulate input with RTL marks often found in copy-paste
      const dirtyDate = '1403/05/20\u200C'; 
      expect(normalizeDate(dirtyDate)).toBe('1403/05/20');
    });

    it('should return empty string for invalid input', () => {
      expect(normalizeDate('')).toBe('');
    });
  });

});
