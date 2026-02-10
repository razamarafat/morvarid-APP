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
