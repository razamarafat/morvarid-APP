
import React, { useState } from 'react';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore'; 
import { useAlertStore } from '../../store/alertStore'; 
import { useFarmStore } from '../../store/farmStore';
import { usePwaStore } from '../../store/pwaStore';
import { supabase } from '../../lib/supabase';
import { Icons } from '../common/Icons';
import * as XLSX from 'xlsx';

const FeatureTesting: React.FC = () => {
  const { addToast } = useToastStore();
  const { addLog } = useLogStore(); 
  const { sendAlert } = useAlertStore();
  const { farms } = useFarmStore();
  const { deferredPrompt } = usePwaStore();
  const [results, setResults] = useState<Record<string, string>>({});

  const runTest = async (feature: string) => {
    setResults(prev => ({ ...prev, [feature]: 'running' }));
    await new Promise(resolve => setTimeout(resolve, 500)); // UI delay

    let success = false;
    let logMessage = '';

    try {
        switch(feature) {
            case 'pwa_status':
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    success = true;
                    logMessage = 'برنامه در حالت نصب شده (Standalone) اجرا شده است.';
                } else if (deferredPrompt) {
                    success = true;
                    logMessage = 'قابلیت نصب PWA فعال است (DeferredPrompt موجود است).';
                } else {
                    success = false;
                    logMessage = 'PWA قابل نصب نیست یا قبلا نصب شده است (مرورگر دسکتاپ معمولی).';
                }
                break;

            case 'alert_system':
                const target = farms[0] || { id: 'test-uuid', name: 'Test Farm' };
                const response = await sendAlert(target.id, target.name, `تست فنی هشدار - ${new Date().toLocaleTimeString('fa-IR')}`);
                if (response.success) {
                    success = true;
                    logMessage = `هشدار ارسال شد. کانال: ${response.detail}`;
                } else {
                    success = false;
                    logMessage = `خطا در ارسال: ${response.detail}`;
                }
                break;

            case 'notification':
                if (!('Notification' in window)) throw new Error('مرورگر پشتیبانی نمیکند');
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    success = true;
                    new Notification('تست اعلان مروارید', { body: 'این یک اعلان آزمایشی است.', dir: 'rtl' });
                    logMessage = 'اعلان با موفقیت نمایش داده شد.';
                } else {
                    success = false;
                    logMessage = `دسترسی اعلان رد شد: ${permission}`;
                }
                break;

            case 'excel':
                if (XLSX && XLSX.utils) {
                    success = true;
                    logMessage = 'کتابخانه Excel (SheetJS) بارگذاری شد.';
                } else {
                    success = false;
                    logMessage = 'کتابخانه XLSX یافت نشد.';
                }
                break;

            case 'database':
                const { status } = await supabase.from('products').select('count', { count: 'exact', head: true });
                if (status >= 200 && status < 300) {
                    success = true;
                    logMessage = `اتصال دیتابیس برقرار است (Status: ${status})`;
                } else {
                    success = false;
                    logMessage = 'خطا در اتصال به دیتابیس.';
                }
                break;
        }
    } catch(e: any) {
        success = false;
        logMessage = `خطای غیرمنتظره: ${e.message}`;
    }
    
    addLog(success ? 'info' : 'error', 'frontend', `[TEST:${feature}] ${logMessage}`, 'TESTER');
    setResults(prev => ({ ...prev, [feature]: success ? 'success' : 'failed' }));
    addToast(logMessage, success ? 'success' : 'error');
  };
  
  const TestCard = ({ title, icon: Icon, id, desc }: any) => (
    <div className="bg-white dark:bg-gray-800 p-6 shadow-md flex justify-between items-center border-r-4 border-violet-500 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold dark:text-white text-lg">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {results[id] === 'running' && <Icons.Refresh className="w-6 h-6 animate-spin text-blue-500" />}
            {results[id] === 'success' && <Icons.Check className="w-6 h-6 text-green-500" />}
            {results[id] === 'failed' && <Icons.X className="w-6 h-6 text-red-500" />}
            <Button size="sm" onClick={() => runTest(id)} disabled={results[id] === 'running'} className="font-bold">شروع تست</Button>
        </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
          <h2 className="text-2xl font-bold dark:text-white mb-2">سنجش ویژگی‌های فنی</h2>
          <p className="text-gray-500">بررسی سلامت ماژول‌های حیاتی سیستم</p>
      </div>

      <div className="grid gap-4">
        <TestCard id="pwa_status" title="وضعیت PWA" icon={Icons.HardDrive} desc="بررسی قابلیت نصب و Service Worker" />
        <TestCard id="alert_system" title="سیستم هشدار (Realtime)" icon={Icons.AlertCircle} desc="تست ارسال و دریافت آنی پیام" />
        <TestCard id="notification" title="اعلان مرورگر" icon={Icons.Bell} desc="بررسی مجوز Push Notification" />
        <TestCard id="excel" title="موتور اکسل" icon={Icons.FileText} desc="بررسی کتابخانه پردازش فایل‌های XLSX" />
        <TestCard id="database" title="دیتابیس ابری" icon={Icons.HardDrive} desc="تست پینگ و اتصال به Supabase" />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 border-2 border-dashed border-blue-300 dark:border-blue-700 mt-8">
          <h3 className="font-bold text-lg text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Icons.BarChart className="w-6 h-6" />
              نمودارها و تحلیل‌ها کجاست؟
          </h3>
          <p className="mt-2 text-blue-700 dark:text-blue-400 text-sm leading-relaxed">
              بخش <strong>تحلیل نموداری</strong> و داشبوردهای گرافیکی در پنل <strong>مسئول فروش (Sales Dashboard)</strong> قرار دارند. 
              شما به عنوان ادمین می‌توانید از طریق منوی مدیریت کاربران، نقش یک کاربر تستی را به "Sales" تغییر دهید تا نمودارها را بررسی کنید، 
              یا مستقیماً کد `SalesDashboard.tsx` را بازبینی نمایید.
          </p>
      </div>
    </div>
  );
};

export default FeatureTesting;
