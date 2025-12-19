
import { useState } from 'react';
import { useToastStore } from '../store/toastStore';

interface ParsedSMS {
  date?: string;
  invoiceNumber?: string;
  weight?: number;
  cartons?: number;
  productName?: string;
}

export const useSMS = () => {
  const { addToast } = useToastStore();

  const parseInvoiceSMS = (text: string): ParsedSMS | null => {
    try {
      // Regex based on the prompt's SMS format:
      // ۱۴۰۴/۰۹/۲۶
      // حواله بارگیری: 
      // 1766001029
      // وزن تقریبی: 12.3
      // تعداد كارتن: 100
      // نوع بار: شیرینگ پک 6 شانه 
      
      // We look for patterns flexibly (ignoring whitespace)
      const invoiceRegex = /حواله بارگیری[:\s]*(\d+)/;
      const weightRegex = /وزن تقریبی[:\s]*([\d.]+)/;
      const cartonsRegex = /تعداد كارتن[:\s]*(\d+)/;
      const typeRegex = /نوع بار[:\s]*(.+)/;
      const dateRegex = /(\d{4}\/\d{2}\/\d{2})/;

      const invoiceMatch = text.match(invoiceRegex);
      const weightMatch = text.match(weightRegex);
      const cartonsMatch = text.match(cartonsRegex);
      const typeMatch = text.match(typeRegex);
      const dateMatch = text.match(dateRegex);

      if (invoiceMatch) {
        return {
          date: dateMatch ? dateMatch[1] : undefined,
          invoiceNumber: invoiceMatch[1],
          weight: weightMatch ? parseFloat(weightMatch[1]) : undefined,
          cartons: cartonsMatch ? parseInt(cartonsMatch[1]) : undefined,
          productName: typeMatch ? typeMatch[1].trim() : undefined,
        };
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const readFromClipboard = async (): Promise<ParsedSMS | null> => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseInvoiceSMS(text);
      if (parsed) {
        addToast('اطلاعات از حافظه موقت خوانده شد', 'info');
        return parsed;
      } else {
        addToast('فرمت متن کپی شده معتبر نیست', 'warning');
        return null;
      }
    } catch (err) {
      addToast('عدم دسترسی به حافظه موقت (مجوز را بررسی کنید)', 'error');
      return null;
    }
  };

  return { readFromClipboard, parseInvoiceSMS };
};
