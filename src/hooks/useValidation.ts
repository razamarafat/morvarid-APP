
import { useCallback } from 'react';
import { toEnglishDigits } from '../utils/dateUtils';

export const useValidation = () => {
    /**
     * Removes Latin characters (a-z, A-Z) from the input string.
     * Useful for forcing Persian/Arabic input in text fields.
     */
    const cleanPersianText = useCallback((value: string): string => {
        if (!value) return '';
        // Remove English letters
        return value.replace(/[a-zA-Z]/g, '');
    }, []);

    /**
     * Validates if the input string is a valid Iranian mobile number format.
     * Starts with 09 and has 11 digits.
     */
    const isValidMobile = useCallback((value: string): boolean => {
        if (!value) return false;
        const englishValue = toEnglishDigits(value);
        return /^09\d{9}$/.test(englishValue);
    }, []);

    /**
     * Validates if the input string contains only digits.
     */
    const isValidNumber = useCallback((value: string): boolean => {
        if (!value) return false;
        const englishValue = toEnglishDigits(value);
        return /^\d+$/.test(englishValue);
    }, []);

    /**
     * Sanitizes numeric input, removing non-numeric characters.
     */
    const cleanNumericInput = useCallback((value: string): string => {
        if (!value) return '';
        const englishValue = toEnglishDigits(value);
        return englishValue.replace(/[^0-9]/g, '');
    }, []);

    return {
        cleanPersianText,
        isValidMobile,
        isValidNumber,
        cleanNumericInput
    };
};
