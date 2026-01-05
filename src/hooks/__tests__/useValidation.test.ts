import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValidation } from '../useValidation';

describe('useValidation Hook', () => {

  describe('cleanPersianText', () => {
    it('removes English letters from mixed text', () => {
      const { result } = renderHook(() => useValidation());
      const input = 'سلام Hello دنیا World';
      const resultText = result.current.cleanPersianText(input);
      expect(resultText).toBe('سلام دنیا ');
    });

    it('removes only English letters, keeps Persian and numbers', () => {
      const { result } = renderHook(() => useValidation());
      const input = 'تست Test 123 سلام';
      const resultText = result.current.cleanPersianText(input);
      expect(resultText).toBe('تست 123 سلام');
    });

    it('removes uppercase and lowercase English letters', () => {
      const { result } = renderHook(() => useValidation());
      const input = 'Hello WORLD Test';
      const resultText = result.current.cleanPersianText(input);
      expect(resultText).toBe('  ');
    });

    it('returns empty string for empty input', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.cleanPersianText('')).toBe('');
      expect(result.current.cleanPersianText(null as any)).toBe('');
      expect(result.current.cleanPersianText(undefined as any)).toBe('');
    });

    it('preserves Persian characters and symbols', () => {
      const { result } = renderHook(() => useValidation());
      const input = 'سلام! @#$% فارسی';
      const resultText = result.current.cleanPersianText(input);
      expect(resultText).toBe('سلام! @#$% فارسی');
    });
  });

  describe('isValidMobile', () => {
    it('validates correct Iranian mobile numbers', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidMobile('09123456789')).toBe(true);
      expect(result.current.isValidMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true); // Persian digits
      expect(result.current.isValidMobile('09120000000')).toBe(true);
      expect(result.current.isValidMobile('09199999999')).toBe(true);
    });

    it('rejects invalid mobile numbers', () => {
      const { result } = renderHook(() => useValidation());
      // Wrong length
      expect(result.current.isValidMobile('0912345678')).toBe(false); // 10 digits
      expect(result.current.isValidMobile('091234567890')).toBe(false); // 12 digits

      // Wrong prefix
      expect(result.current.isValidMobile('08123456789')).toBe(false);
      expect(result.current.isValidMobile('00123456789')).toBe(false);
      expect(result.current.isValidMobile('12345678901')).toBe(false);

      // Contains non-digits
      expect(result.current.isValidMobile('0912345678a')).toBe(false);
      expect(result.current.isValidMobile('091234 56789')).toBe(false);
      expect(result.current.isValidMobile('091234-56789')).toBe(false);
    });

    it('returns false for empty or null input', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidMobile('')).toBe(false);
      expect(result.current.isValidMobile(null as any)).toBe(false);
      expect(result.current.isValidMobile(undefined as any)).toBe(false);
    });

    it('handles Persian digits correctly', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidMobile('۰۹۱۲۱۴۱۶۵۴۳')).toBe(true);
      expect(result.current.isValidMobile('۰۹۱۲۱۴۱۶۵۴')).toBe(false); // Too short
    });
  });

  describe('isValidNumber', () => {
    it('validates strings containing only digits', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidNumber('123')).toBe(true);
      expect(result.current.isValidNumber('0')).toBe(true);
      expect(result.current.isValidNumber('999999')).toBe(true);
    });

    it('validates Persian digits', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidNumber('۱۲۳')).toBe(true);
      expect(result.current.isValidNumber('۰')).toBe(true);
    });

    it('rejects strings with non-digit characters', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidNumber('123a')).toBe(false);
      expect(result.current.isValidNumber('12 3')).toBe(false);
      expect(result.current.isValidNumber('123.45')).toBe(false);
      expect(result.current.isValidNumber('۱۲۳a')).toBe(false);
      expect(result.current.isValidNumber('')).toBe(false);
    });

    it('returns false for empty or null input', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.isValidNumber('')).toBe(false);
      expect(result.current.isValidNumber(null as any)).toBe(false);
      expect(result.current.isValidNumber(undefined as any)).toBe(false);
    });
  });

  describe('cleanNumericInput', () => {
    it('removes non-numeric characters', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.cleanNumericInput('123abc')).toBe('123');
      expect(result.current.cleanNumericInput('12 3')).toBe('123');
      expect(result.current.cleanNumericInput('123.45')).toBe('12345');
      expect(result.current.cleanNumericInput('abc')).toBe('');
    });

    it('handles Persian digits', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.cleanNumericInput('۱۲۳abc')).toBe('123');
      expect(result.current.cleanNumericInput('۱۲ ۳')).toBe('123');
    });

    it('returns empty string for empty input', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.cleanNumericInput('')).toBe('');
      expect(result.current.cleanNumericInput(null as any)).toBe('');
      expect(result.current.cleanNumericInput(undefined as any)).toBe('');
    });

    it('preserves only numeric characters', () => {
      const { result } = renderHook(() => useValidation());
      expect(result.current.cleanNumericInput('Phone: 09123456789')).toBe('09123456789');
      expect(result.current.cleanNumericInput('Price: ۱,۰۰۰,۰۰۰')).toBe('1000000');
    });
  });
});
