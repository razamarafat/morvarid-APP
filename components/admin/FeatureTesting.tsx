
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
  const { logAction } = useLogStore(); 
  const { sendAlert } = useAlertStore();
  const { farms } = useFarmStore();
  const { deferredPrompt } = usePwaStore();
  const [results, setResults] = useState<Record<string, string>>({});

  const runTest = async (feature: string) => {
    setResults(prev => ({ ...prev, [feature]: 'running' }));
    
    let success = false;
    let detail = '';
    let technicalResponse: any = {};

    try {
        switch(feature) {
            case 'pwa_status':
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
                success = true;
                detail = isStandalone ? 'برنامه نصب شده است.' : 'تحت وب در حال اجراست.';
                technicalResponse = { isStandalone, hasPrompt: !!deferredPrompt };
                break;

            case 'alert_system':
                const target = farms[0] || { id: '000', name: 'TEST_FARM' };
                const resp = await sendAlert(target.id, target.name, `تست لایو هشدار مروارید - ${new Date().toLocaleTimeString('fa-IR')}`);
                success = resp.success;
                detail = success ? 'ارسال با موفقیت انجام شد.' : 'خطا در شبکه لایو.';
                technicalResponse = resp;
                break;

            case 'database':
                const start = performance.now();
                const { status, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
                const end = performance.now();
                success = !error && status >= 200 && status < 300;
                detail = success ? `اتصال برقرار است (تاخیر: ${Math.round(end-start)}ms)` : 'ارتباط با سرور قطع است.';
                technicalResponse = { status, error, latency: end - start };
                break;

            case 'excel':
                success = !!XLSX && !!XLSX.utils;
                detail = success ? 'کتابخانه اکسل بارگذاری شده است.' : 'کتابخانه اکسل یافت نشد.';
                technicalResponse = { version: (XLSX as any).version };
                break;
        }
    } catch(e: any) {
        success = false;
        detail = 'خطای غیرمنتظره در تست ویژگی.';
        technicalResponse = { error: e.message, stack: e.stack };
    }
    
    // LOG EVERYTHING TO DB
    await logAction(
        success ? 'info' : 'error', 
        'frontend', 
        `[تست فنی] ${feature}: ${detail}`, 
        technicalResponse
    );

    setResults(prev => ({ ...prev, [feature]: success ? 'success' : 'failed' }));
    addToast(detail, success ? 'success' : 'error');
  };
  
  const TestCard = ({ title, icon: Icon, id, desc }: any) => (
    <div className="bg-white dark:bg-gray-800 p-6 shadow-md flex justify-between items-center border-r-4 border-metro-purple hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-metro-purple/10 rounded-full text-metro-purple">
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
            <Button size="sm" onClick={() => runTest(id)} disabled={results[id] === 'running'}>تست فنی</Button>
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border-l-8 border-metro-purple shadow-sm">
          <h2 className="text-2xl font-black dark:text-white mb-2">عیب‌یابی زیرساخت</h2>
          <p className="text-gray-500 font-bold">تمام نتایج این تست‌ها به صورت خودکار با جزییات کامل فنی در بخش لاگ‌ها ثبت می‌گردد.</p>
      </div>

      <div className="grid gap-4">
        <TestCard id="pwa_status" title="سرویس PWA" icon={Icons.HardDrive} desc="بررسی وضعیت نصب و کنترلر سرویس ورکر" />
        <TestCard id="alert_system" title="شبکه Realtime" icon={Icons.AlertCircle} desc="تست ارسال سیگنال لایو در دیتابیس" />
        <TestCard id="database" title="دیتابیس ابری" icon={Icons.Globe} desc="پینگ دیتابیس و وضعیت جدول محصولات" />
        <TestCard id="excel" title="پردازشگر فایل" icon={Icons.FileText} desc="بررسی درستی عملکرد کتابخانه SheetJS" />
      </div>
    </div>
  );
};

export default FeatureTesting;
