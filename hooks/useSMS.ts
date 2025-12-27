
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
      // 1. Clean and Normalize Text
      // Convert digits to English and standardise specific Persian/Arabic characters
      let cleanText = toEnglishDigits(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/ك/g, 'ک')
        .replace(/ي/g, 'ی');

      // 2. Split Strategy
      // Instead of searching with a moving window (which can be fragile or miss overlapping items),
      // we inject a unique marker before every occurrence of the invoice header "حواله بارگیری".
      // Then we split the text by this marker to get isolated chunks for each invoice.
      const marker = "|||SMS_SPLIT|||";
      // This regex finds "حواله بارگیری" allowing for whitespace/newlines between words
      const splitText = cleanText.replace(/(حواله\s+بارگیری)/g, `${marker}$1`);
      
      const chunks = splitText.split(marker);
      
      const results: ParsedSMS[] = [];
      const seenInvoices = new Set<string>();

      // 3. Define Regexes for Field Extraction (Applied per chunk)
      const invoiceNumRegex = /حواله\s+بارگیری[:\s\n]+(\d{8,12})/;
      const weightRegex = /وزن\s+تقریبی[:\s\n]+([\d.]+)/;
      const cartonsRegex = /تعداد\s+کارتن[:\s\n]+(\d+)/;
      const dateRegex = /(\d{4}\/\d{2}\/\d{2})/;
      const farmRegex = /مرغداری[:\s\n]+([^\n\r]+)/;

      // 4. Process Each Chunk
      for (const chunk of chunks) {
        // Skip empty or too short chunks
        if (!chunk || chunk.trim().length < 10) continue;

        // Extract Invoice Number
        const invoiceMatch = chunk.match(invoiceNumRegex);
        if (!invoiceMatch) continue; // Not a valid invoice chunk

        const invNum = invoiceMatch[1];
        
        // Prevent duplicates within the same paste action
        if (seenInvoices.has(invNum)) continue;

        // Extract other fields
        const weightMatch = chunk.match(weightRegex);
        const cartonsMatch = chunk.match(cartonsRegex);
        const dateMatch = chunk.match(dateRegex);
        const farmMatch = chunk.match(farmRegex);

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
