
import { useState } from 'react';
import { useToastStore } from '../store/toastStore';
import { normalizeDate, toEnglishDigits } from '../utils/dateUtils';

export interface ParsedSMS {
  date?: string;
  invoiceNumber: string;
  weight: number;
  cartons: number;
  productName?: string;
  farmName?: string;
}

export const useSMS = () => {
  const { addToast } = useToastStore();
  const TARGET_SENDER = '9830007650001521';

  const parseMultipleInvoices = (text: string): ParsedSMS[] => {
    try {
      // 1. Convert all digits to English
      let cleanText = toEnglishDigits(text);
      
      // 2. Normalize characters (Arabic vs Persian)
      // Standardize K (ك -> ک) and Y (ي -> ی) and remove invisible chars
      cleanText = cleanText
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/ك/g, 'ک')
        .replace(/ي/g, 'ی');

      const results: ParsedSMS[] = [];
      const seenInvoices = new Set<string>();

      // Global regex to find "حواله بارگیری" and its number
      // Uses [\s\n]* to handle cases where the number is on a new line
      const invoiceRegex = /حواله\s+بارگیری[:\s\n]+(\d{8,12})/g;
      
      // Field level regexes (case insensitive and space/newline resilient)
      const weightRegex = /وزن\s+تقریبی[:\s\n]+([\d.]+)/;
      const cartonsRegex = /تعداد\s+کارتن[:\s\n]+(\d+)/;
      const dateRegex = /(\d{4}\/\d{2}\/\d{2})/;
      const farmRegex = /مرغداری[:\s\n]+([^\n\r]+)/;

      let match;
      while ((match = invoiceRegex.exec(cleanText)) !== null) {
        const invNum = match[1];
        if (seenInvoices.has(invNum)) continue;

        // Search in a window around the match (150 chars before/after)
        const startIndex = Math.max(0, match.index - 50);
        const windowText = cleanText.substring(startIndex, match.index + 250);

        const weightMatch = windowText.match(weightRegex);
        const cartonsMatch = windowText.match(cartonsRegex);
        const dateMatch = windowText.match(dateRegex);
        const farmMatch = windowText.match(farmRegex);

        seenInvoices.add(invNum);
        results.push({
          invoiceNumber: invNum,
          weight: weightMatch ? parseFloat(weightMatch[1]) : 0,
          cartons: cartonsMatch ? parseInt(cartonsMatch[1]) : 0,
          date: dateMatch ? normalizeDate(dateMatch[1]) : undefined,
          farmName: farmMatch ? farmMatch[1].trim() : undefined
        });
      }

      return results;
    } catch (e) {
      console.error("Advanced Batch SMS Error:", e);
      return [];
    }
  };

  /**
   * Specifically check and request clipboard-read permission.
   * If denied, it instructs the user how to reset it in the browser.
   */
  const requestClipboardPermission = async (): Promise<boolean> => {
    try {
      // Browsers with Permissions API support
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' as any });
        
        if (permissionStatus.state === 'denied') {
          addToast('دسترسی مسدود است. لطفا در تنظیمات مرورگر (آیکون قفل کنار آدرس‌بار) دسترسی Clipboard را فعال کنید.', 'error');
          return false;
        }
        
        if (permissionStatus.state === 'prompt') {
          // This will trigger the browser prompt when readText() is called below
          return true;
        }
      }
      return true;
    } catch (e) {
      // Fallback for browsers that don't support querying clipboard-read permission
      return true;
    }
  };

  const readFromClipboard = async (): Promise<ParsedSMS[]> => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        addToast('مرورگر شما از قابلیت خواندن حافظه موقت پشتیبانی نمی‌کند. لطفا از آخرین نسخه کروم استفاده کنید.', 'error');
        return [];
      }
      
      const hasPermission = await requestClipboardPermission();
      if (!hasPermission) return [];

      const text = await navigator.clipboard.readText();
      
      if (!text || text.trim().length < 10) {
        addToast('متن کپی شده معتبر نیست یا حافظه موقت خالی است.', 'warning');
        return [];
      }

      const results = parseMultipleInvoices(text);
      return results;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        addToast('اجازه دسترسی به حافظه داده نشد. لطفا برای ادامه گزینه "Allow" را انتخاب کنید.', 'warning');
      } else {
        addToast('خطا در خواندن حافظه موقت: ' + err.message, 'error');
      }
      return [];
    }
  };

  return { readFromClipboard, parseMultipleInvoices, TARGET_SENDER };
};
