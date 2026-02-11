import { toPersianDigits } from './dateUtils';

/**
 * Formats a raw plate number string (part1-letter-part3-part4)
 * into a standardized display format: 22 Letter 333 - 11 Iran
 * @param plate Raw plate string from DB
 * @returns Formatted plate string
 */
export const formatPlateNumber = (plate: string | null | undefined): string => {
    if (!plate) return '';

    const parts = plate.split('-');
    if (parts.length !== 4) return toPersianDigits(plate);

    const [part1, letter, part3, part4] = parts;

    // Perfect physical plate order (LTR): [2-digits] [Letter] [3-digits] - [2-digits]
    // Example: ۲۲ الف ۳۶۵ - ۱۱
    return `${toPersianDigits(part1)} ${letter} ${toPersianDigits(part3)} - ${toPersianDigits(part4)}`;
};

/**
 * Formats plate number for Excel RTL display
 * Must be written in reverse order: [part1] - [part3] [letter] [part4]
 * Example: ۲۲ - ۳۶۵ الف ۱۱
 */
export const formatPlateNumberForExcel = (plate: string | null | undefined): string => {
    if (!plate) return '';

    const parts = plate.split('-');
    if (parts.length !== 4) return toPersianDigits(plate);

    const [part1, letter, part3, part4] = parts;

    // Reverse order for Excel RTL: [part1] - [part3] [letter] [part4]
    // Example: ۲۲ - ۳۶۵ الف ۱۱
    return `${toPersianDigits(part1)} - ${toPersianDigits(part3)} ${letter} ${toPersianDigits(part4)}`;
};

/**
 * Formats plate number for UI RTL display
 * Must be written in reverse order: [part4] - [part3] [letter] [part1]
 * Renders visually as [part1] [letter] [part3] - [part4] in RTL
 * Example: ۱۱ - ۳۶۵ الف ۲۲
 */
export const formatPlateNumberForUI = (plate: string | null | undefined): string => {
    if (!plate) return '';

    const parts = plate.split('-');
    if (parts.length !== 4) return toPersianDigits(plate);

    const [part1, letter, part3, part4] = parts;

    // Reverse order for UI RTL: [part4] - [part3] [letter] [part1]
    // Example: ۱۱ - ۳۶۵ الف ۲۲
    return `${toPersianDigits(part4)} - ${toPersianDigits(part3)} ${letter} ${toPersianDigits(part1)}`;
};
