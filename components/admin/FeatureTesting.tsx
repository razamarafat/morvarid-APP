
import React, { useState } from 'react';
import Button from '../common/Button.tsx';
import { useToastStore } from '../../store/toastStore.ts';
import { useAlertStore } from '../../store/alertStore.ts'; 
import { useFarmStore } from '../../store/farmStore.ts';
import { supabase } from '../../lib/supabase.ts';

const FeatureTesting: React.FC = () => {
  const { addToast } = useToastStore();
  const { sendAlert } = useAlertStore();
  const { farms } = useFarmStore();
  const [isRunning, setIsRunning] = useState<string | null>(null);

  const runTest = async (feature: string) => {
    setIsRunning(feature);
    let success = false;
    let detail = '';

    try {
        switch(feature) {
            case 'database_ping':
                const start = Date.now();
                const { error, status } = await supabase.from('farms').select('count', { count: 'exact', head: true });
                success = !error && status === 200;
                detail = success ? `اتصال برقرار است (${Date.now() - start}ms)` : 'خطا در دسترسی به دیتابیس';
                break;

            case 'realtime_broadcast':
                const target = farms[0] || { id: 'test', name: 'Test Farm' };
                const resp = await sendAlert(target.id, target.name, 'سیگنال تست مدیریت');
                success = resp.success;
                detail = success ? 'ارسال موفق سیگنال Realtime' : 'عدم پاسخگویی سرویس Broadcast';
                break;

            case 'pwa_environment':
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
                success = true;
                detail = isStandalone ? 'برنامه در حالت نصب شده (PWA) است' : 'برنامه در مرورگر باز شده است';
                break;
        }
    } catch(e: any) {
        success = false;
        detail = 'خطای بحرانی در اجرای تست فنی';
    }
    
    setIsRunning(null);
    addToast(detail, success ? 'success' : 'error');
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 border-r-8 border-metro-teal shadow-md">
          <h2 className="text-xl font-black dark:text-white">کنسول عیب‌یابی و سنجش ویژگی‌ها</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
                <h4 className="font-bold dark:text-white">پایداری اتصال دیتابیس</h4>
                <p className="text-xs text-gray-400">بررسی سلامت جداول پایه</p>
            </div>
            <Button size="sm" onClick={() => runTest('database_ping')} isLoading={isRunning === 'database_ping'}>تست</Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
                <h4 className="font-bold dark:text-white">سیستم Broadcast زنده</h4>
                <p className="text-xs text-gray-400">تست کانال‌های اطلاع‌رسانی</p>
            </div>
            <Button size="sm" onClick={() => runTest('realtime_broadcast')} isLoading={isRunning === 'realtime_broadcast'}>تست</Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
                <h4 className="font-bold dark:text-white">وضعیت محیط PWA</h4>
                <p className="text-xs text-gray-400">بررسی Manifest و Service Worker</p>
            </div>
            <Button size="sm" onClick={() => runTest('pwa_environment')} isLoading={isRunning === 'pwa_environment'}>تست</Button>
        </div>
      </div>
    </div>
  );
};

export default FeatureTesting;
