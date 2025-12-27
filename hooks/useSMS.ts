
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

  /**
   * Advanced Parser for Multiple Invoices
   * Strategy: Anchor-based parsing
   * 1. Find all "Invoice Numbers" (Anchors).
   * 2. Determine the "window" of text belonging to each invoice.
   * 3. Extract attributes (Weight, Cartons, Date) from that window.
   */
  const parseMultipleInvoices = (text: string): ParsedSMS[] => {
    try {
      if (!text) return [];
      
      // Safety Check: Limit input length to avoid browser freeze
      if (text.length > 50000) {
          addToast('متن کپی شده بسیار طولانی است. فقط ۵۰,۰۰۰ کاراکتر اول پردازش می‌شود.', 'warning');
          text = text.substring(0, 50000);
      }

      // 1. Clean and Normalize Text
      let cleanText = toEnglishDigits(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, ' ') // Remove invisible chars
        .replace(/ك/g, 'ک')
        .replace(/ي/g, 'ی')
        .replace(/[\r\n]+/g, '\n'); // Normalize newlines

      // 2. Define Regex Patterns
      // Invoice Anchor: 8-12 digits, often preceded by "حواله", "بارنامه", "کد", "شماره"
      // We look for the digits primarily, but filter by context.
      const invoiceAnchorRegex = /(?:حواله|بارنامه|کد|شماره|بارگیری).*?[:\s-]*(\d{8,12})/gi;
      
      // Weight: "وزن", "ثقل", "کیلو" -> followed by 3-5 digits (allow decimals)
      const weightRegex = /(?:وزن|ثقل|کیلو|net).*?[:\s-]*([\d.,]+)/i;
      
      // Cartons: "تعداد", "کارتن", "عدد" -> followed by 1-4 digits
      const cartonsRegex = /(?:تعداد|کارتن|عدد|count).*?[:\s-]*(\d+)/i;
      
      // Date: YYYY/MM/DD
      const dateRegex = /(\d{4}[\/\-]\d{2}[\/\-]\d{2})/;

      // 3. Find All Anchors (Invoice Numbers)
      const anchors: { value: string, index: number }[] = [];
      let match;
      while ((match = invoiceAnchorRegex.exec(cleanText)) !== null) {
          anchors.push({ value: match[1], index: match.index });
      }

      if (anchors.length === 0) {
          // Fallback: Try just finding big numbers if they look like invoices (starts with 17/18/98 etc)
          const fallbackRegex = /\b(1[78]\d{8})\b/g;
          while ((match = fallbackRegex.exec(cleanText)) !== null) {
              anchors.push({ value: match[1], index: match.index });
          }
      }

      if (anchors.length === 0) return [];

      const results: ParsedSMS[] = [];
      const seenInvoices = new Set<string>();

      // 4. Process Each Anchor Window
      for (let i = 0; i < anchors.length; i++) {
          const currentAnchor = anchors[i];
          
          if (seenInvoices.has(currentAnchor.value)) continue;
          seenInvoices.add(currentAnchor.value);

          // Define Window:
          // Start: A bit before the anchor (to catch "Date" if it's header)
          // End: The start of the next anchor, or end of text.
          const startWindow = Math.max(0, currentAnchor.index - 50); 
          const endWindow = (i < anchors.length - 1) ? anchors[i+1].index : cleanText.length;
          
          const textBlock = cleanText.substring(startWindow, endWindow);

          // Extract Data from Block
          const weightMatch = textBlock.match(weightRegex);
          const cartonsMatch = textBlock.match(cartonsRegex);
          const dateMatch = textBlock.match(dateRegex);

          const weightVal = weightMatch ? parseFloat(weightMatch[1].replace(/,/g, '')) : 0;
          const cartonVal = cartonsMatch ? parseInt(cartonsMatch[1]) : 0;
          const dateVal = dateMatch ? normalizeDate(dateMatch[1]) : undefined;

          // Validity Check: Must have at least Weight OR Cartons to be useful
          if (weightVal > 0 || cartonVal > 0) {
              results.push({
                  invoiceNumber: currentAnchor.value,
                  weight: weightVal,
                  cartons: cartonVal,
                  date: dateVal,
                  farmName: undefined // Could be extracted if pattern known
              });
          }
      }

      return results;

    } catch (e) {
      console.error("Advanced Parser Error:", e);
      return [];
    }
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
      
      if (!text || text.trim().length < 5) {
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
