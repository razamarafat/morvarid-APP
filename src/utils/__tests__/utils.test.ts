
import { describe, it, expect } from 'vitest';
import { toPersianDigits, normalizeDate } from '../dateUtils';

describe('Utility Functions - Date & Numbers', () => {

    describe('toPersianDigits', () => {
        it('should convert English digits to Persian digits', () => {
            expect(toPersianDigits('12345')).toBe('۱۲۳۴۵');
            expect(toPersianDigits(123)).toBe('۱۲۳');
        });

        it('should handle mixed strings', () => {
            expect(toPersianDigits('Price: 1000')).toBe('Price: ۱۰۰۰');
        });

        it('should handle null/undefined gracefully', () => {
            expect(toPersianDigits(null)).toBe('');
            expect(toPersianDigits(undefined)).toBe('');
        });
    });

    describe('normalizeDate', () => {
        it('should normalize Jalali date separators', () => {
            expect(normalizeDate('1402-01-01')).toBe('1402/01/01');
            expect(normalizeDate('1402.01.01')).toBe('1402/01/01');
            expect(normalizeDate('1402/01/01')).toBe('1402/01/01');
        });

        it('should pad single digit month and day', () => {
            expect(normalizeDate('1402/1/5')).toBe('1402/01/05');
        });
    });
});
