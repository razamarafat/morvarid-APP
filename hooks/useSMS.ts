
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

interface MatchItem {
  value: string;
  index: number;
}

export const useSMS = () => {
  const { addToast } = useToastStore();
  const TARGET_SENDER = '9830007650001521';

  const parseMultipleInvoices = (text: string): ParsedSMS[] => {
    try {
      // 1. Clean and Normalize Text
      let cleanText = toEnglishDigits(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, ' ') // Remove invisible chars
        .replace(/ك/g, 'ک')
        .replace(/ي/g, 'ی')
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

      // 2. Define Regex Patterns (Global)
      const regexInvoice = /(?:حواله|بارنامه)(?:\s+بارگیری)?[:\s]*(\d{8,12})/g;
      const regexWeight = /(?:وزن|ثقل)(?:\s+تقریبی)?[:\s]*([\d.,]+)/g;
      const regexCartons = /(?:تعداد|کارتن)(?:\s+کارتن)?[:\s]*(\d+)/g;
      // Date format: YYYY/MM/DD or YYYY-MM-DD
      const regexDate = /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/g;

      // 3. Extract All Entities with Indices
      const invoices = extractAllMatches(cleanText, regexInvoice);
      const weights = extractAllMatches(cleanText, regexWeight);
      const cartons = extractAllMatches(cleanText, regexCartons);
      const dates = extractAllMatches(cleanText, regexDate);

      if (invoices.length === 0) return [];

      const results: ParsedSMS[] = [];
      const seenInvoices = new Set<string>();

      // 4. Proximity Matching Algorithm
      for (let i = 0; i < invoices.length; i++) {
        const currentInv = invoices[i];
        const nextInvIndex = i < invoices.length - 1 ? invoices[i + 1].index : cleanText.length;
        const prevInvIndex = i > 0 ? invoices[i - 1].index : 0;

        if (seenInvoices.has(currentInv.value)) continue;

        // A. Find Weight & Cartons (Lookahead)
        const matchedWeight = weights.find(w => w.index > currentInv.index && w.index < nextInvIndex);
        const matchedCarton = cartons.find(c => c.index > currentInv.index && c.index < nextInvIndex);

        // B. Find Date (Lookback with proximity)
        const matchedDate = dates
            .filter(d => d.index < currentInv.index && d.index >= prevInvIndex) // Basic: between current and prev
            .pop(); // Closest one before current

        // Fallback for date: if not found before, look closely after (sometimes date is at end)
        let finalDate = matchedDate;
        if (!finalDate) {
             const matchedDateAfter = dates.find(d => d.index > currentInv.index && d.index < nextInvIndex);
             if (matchedDateAfter) finalDate = matchedDateAfter;
        }

        seenInvoices.add(currentInv.value);

        const weightVal = matchedWeight ? parseFloat(matchedWeight.value.replace(/,/g, '')) : 0;
        const cartonVal = matchedCarton ? parseInt(matchedCarton.value) : 0;

        if (weightVal > 0 || cartonVal > 0) {
            results.push({
              invoiceNumber: currentInv.value,
              weight: weightVal,
              cartons: cartonVal,
              date: finalDate ? normalizeDate(finalDate.value) : undefined,
              farmName: undefined 
            });
        }
      }

      return results;

    } catch (e) {
      console.error("Proximity Parser Error:", e);
      return [];
    }
  };

  const extractAllMatches = (text: string, regex: RegExp): MatchItem[] => {
    const matches: MatchItem[] = [];
    let match;
    regex.lastIndex = 0; 
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        value: match[1], 
        index: match.index
      });
    }
    return matches;
  };

  const requestClipboardPermission = async (): Promise<boolean> => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'clipboard-read' as any });
        if (permissionStatus.state === 'denied') {
          addToast('دسترسی مسدود است. لطفا در تنظیمات مرورگر (آیکون قفل) دسترسی Clipboard را فعال کنید.', 'error');
          return false;
        }
        return true;
      }
      return true;
    } catch (e) {
      return true;
    }
  };

  const readFromClipboard = async (): Promise<ParsedSMS[]> => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        addToast('مرورگر شما از قابلیت خواندن حافظه موقت پشتیبانی نمی‌کند.', 'error');
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
        addToast('اجازه دسترسی به حافظه داده نشد. لطفا گزینه Allow را بزنید.', 'warning');
      } else {
        addToast('خطا در خواندن حافظه موقت: ' + err.message, 'error');
      }
      return [];
    }
  };

  return { readFromClipboard, parseMultipleInvoices, TARGET_SENDER };
};
