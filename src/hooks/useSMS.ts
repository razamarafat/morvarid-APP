
import { useToastStore } from '../store/toastStore';
import { normalizeDate, toEnglishDigits } from '../utils/dateUtils';
import { usePermissionStore } from '../store/permissionStore';

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
  const { requestPermission, permissions, checkPermission, setPermissionStatus } = usePermissionStore();
  const TARGET_SENDER = '9830007650001521';

  /**
   * Advanced Parser for Multiple Invoices
   */
  const parseMultipleInvoices = (text: string): ParsedSMS[] => {
    try {
      if (!text) return [];

      if (text.length > 50000) {
        addToast('متن کپی شده بسیار طولانی است. فقط ۵۰,۰۰۰ کاراکتر اول پردازش می‌شود.', 'warning');
        text = text.substring(0, 50000);
      }

      const cleanText = toEnglishDigits(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
        .replace(/ك/g, 'ک')
        .replace(/ي/g, 'ی')
        .replace(/[\r\n]+/g, '\n');

      const invoiceAnchorRegex = /(?:حواله|بارنامه|کد|شماره|بارگیری).*?[:\s-]*(\d{8,12})/gi;
      const weightRegex = /(?:وزن|ثقل|کیلو|net).*?[:\s-]*([\d.,]+)/i;
      const cartonsRegex = /(?:تعداد|کارتن|عدد|count).*?[:\s-]*(\d+)/i;
      const dateRegex = /(\d{4}[/-]\d{2}[/-]\d{2})/;

      const anchors: { value: string, index: number }[] = [];
      let match;
      while ((match = invoiceAnchorRegex.exec(cleanText)) !== null) {
        anchors.push({ value: match[1], index: match.index });
      }

      if (anchors.length === 0) {
        const fallbackRegex = /\b(1[78]\d{8})\b/g;
        while ((match = fallbackRegex.exec(cleanText)) !== null) {
          anchors.push({ value: match[1], index: match.index });
        }
      }

      if (anchors.length === 0) return [];

      const results: ParsedSMS[] = [];
      const seenInvoices = new Set<string>();

      for (let i = 0; i < anchors.length; i++) {
        const currentAnchor = anchors[i];
        if (seenInvoices.has(currentAnchor.value)) continue;
        seenInvoices.add(currentAnchor.value);

        const startWindow = Math.max(0, currentAnchor.index - 50);
        const endWindow = (i < anchors.length - 1) ? anchors[i + 1].index : cleanText.length;
        const textBlock = cleanText.substring(startWindow, endWindow);

        const weightMatch = textBlock.match(weightRegex);
        const cartonsMatch = textBlock.match(cartonsRegex);
        const dateMatch = textBlock.match(dateRegex);

        const weightVal = weightMatch ? parseFloat(weightMatch[1].replace(/,/g, '')) : 0;
        const cartonVal = cartonsMatch ? parseInt(cartonsMatch[1]) : 0;
        const dateVal = dateMatch ? normalizeDate(dateMatch[1]) : undefined;

        if (weightVal > 0 || cartonVal > 0) {
          results.push({
            invoiceNumber: currentAnchor.value,
            weight: weightVal,
            cartons: cartonVal,
            date: dateVal,
            farmName: undefined
          });
        }
      }

      return results;

    } catch (e) {
      console.error("Advanced Parser Error:", e);
      return [];
    }
  };

  const readFromClipboard = async (): Promise<ParsedSMS[]> => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        addToast('مرورگر شما از قابلیت خواندن حافظه موقت پشتیبانی نمی‌کند.', 'error');
        return [];
      }

      // Smart Permission Check
      let status = permissions['clipboard-read'];

      if (status === 'unknown') {
        // Re-check status just in case
        status = await checkPermission('clipboard-read');
      }

      if (status === 'denied') {
        addToast('دسترسی به کلیپ‌بورد مسدود شده است. لطفاً از تنظیمات مرورگر (کنار آدرس بار) آن را فعال کنید.', 'error');
        return [];
      }

      // Try to read. If 'prompt', browser will show prompt.
      // We assume this function is called via a user gesture (button click).
      const text = await navigator.clipboard.readText();

      // Update status to granted if successful
      if (status !== 'granted') {
        setPermissionStatus('clipboard-read', 'granted');
      }

      if (!text || text.trim().length < 5) {
        addToast('متن کپی شده معتبر نیست یا حافظه موقت خالی است.', 'warning');
        return [];
      }

      const results = parseMultipleInvoices(text);
      return results;

    } catch (err: any) {
      console.error('Clipboard Read Error:', err);
      if (err.name === 'NotAllowedError' || err.message.includes('denied')) {
        // This usually happens if user dismissed the prompt or denied it
        setPermissionStatus('clipboard-read', 'denied');
        addToast('اجازه دسترسی به حافظه داده نشد. برای استفاده از این ویژگی باید اجازه دهید.', 'warning');
      } else {
        addToast('خطا در خواندن حافظه موقت. لطفاً دوباره تلاش کنید.', 'error');
      }
      return [];
    }
  };

  return { readFromClipboard, parseMultipleInvoices };
};
