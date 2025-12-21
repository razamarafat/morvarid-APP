
import React, { useState } from 'react';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore'; 
import { useAlertStore } from '../../store/alertStore'; 
import { useFarmStore } from '../../store/farmStore';
import { supabase } from '../../lib/supabase';
import { Icons } from '../common/Icons';
import * as XLSX from 'xlsx';

const FeatureTesting: React.FC = () => {
  const { addToast } = useToastStore();
  const { addLog } = useLogStore(); 
  const { sendAlert, channel } = useAlertStore();
  const { farms } = useFarmStore();
  const [results, setResults] = useState<Record<string, string>>({});

  const runTest = async (feature: string) => {
    // 1. Set State to Running
    setResults(prev => ({ ...prev, [feature]: 'running' }));
    
    // 2. Small Delay for UI
    await new Promise(resolve => setTimeout(resolve, 300));

    let success = false;
    let logMessage = '';
    let technicalDetails = '';

    try {
        switch(feature) {
            case 'alert_system':
                const realMehrabadFarm = farms.find(f => f.name.includes('مهرآباد'));
                const targetId = realMehrabadFarm ? realMehrabadFarm.id : 'NOT_FOUND_UUID';
                const targetName = realMehrabadFarm ? realMehrabadFarm.name : 'مهرآباد (یافت نشد)';

                const response = await sendAlert(
                    targetId, 
                    targetName, 
                    `تست فنی هشدار - ${new Date().toLocaleTimeString('fa-IR')}`
                );

                if (response.success) {
                    success = true;
                    logMessage = `هشدار ارسال شد (Channel: ${response.detail})`;
                    technicalDetails = `Bytes: ${response.bytes} | Target: ${targetName}`;
                } else {
                    success = false;
                    logMessage = `خطا در ارسال: ${response.detail}`;
                }
                break;

            case 'notification':
                // SIMPLIFIED LOGIC TO PREVENT HANGING
                if (!('Notification' in window)) {
                    throw new Error('This browser does not support notifications.');
                }

                // 1. Request Permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    success = false;
                    logMessage = `کاربر دسترسی را رد کرد (Status: ${permission})`;
                } else {
                    // 2. Try Service Worker (Preferred for Mobile)
                    let swReg = null;
                    if ('serviceWorker' in navigator) {
                        swReg = await navigator.serviceWorker.getRegistration();
                    }

                    try {
                        if (swReg) {
                            await swReg.showNotification('تست مروارید', {
                                body: 'این اعلان از طریق Service Worker ارسال شد (PWA Ready).',
                                icon: '/vite.svg',
                                badge: '/vite.svg',
                                dir: 'rtl'
                            } as any);
                            success = true;
                            logMessage = 'اعلان با موفقیت از طریق Service Worker ارسال شد.';
                            technicalDetails = `SW Scope: ${swReg.scope}`;
                        } else {
                            // 3. Fallback (Desktop / No SW)
                            // Note: This throws on Android Chrome if called directly without SW
                            new Notification('تست مروارید', {
                                body: 'این اعلان به صورت مستقیم ارسال شد (Desktop Mode).',
                                dir: 'rtl'
                            });
                            success = true;
                            logMessage = 'اعلان به صورت مستقیم (Direct) ارسال شد.';
                            technicalDetails = 'No Active Service Worker found, used constructor.';
                        }
                    } catch (err: any) {
                        success = false;
                        logMessage = `خطا در نمایش اعلان: ${err.message}`;
                        technicalDetails = `Error Name: ${err.name}`;
                    }
                }
                break;

            case 'excel':
                if (XLSX && XLSX.utils) {
                    success = true;
                    logMessage = 'کتابخانه Excel بارگذاری شد.';
                } else {
                    success = false;
                    logMessage = 'کتابخانه XLSX یافت نشد.';
                }
                break;

            case 'database':
                const { error, status } = await supabase.from('products').select('count', { count: 'exact', head: true });
                if (!error && status >= 200 && status < 300) {
                    success = true;
                    logMessage = 'اتصال دیتابیس برقرار است.';
                    technicalDetails = `Status: ${status}`;
                } else {
                    success = false;
                    logMessage = 'خطا در اتصال به دیتابیس.';
                }
                break;
        }
    } catch(e: any) {
        success = false;
        logMessage = `خطای غیرمنتظره: ${e.message}`;
        technicalDetails = e.stack ? e.stack.substring(0, 100) : 'No stack';
    }
    
    // Log Result
    addLog(
        success ? 'info' : 'error', 
        'frontend', 
        `[TEST:${feature}] ${logMessage}`, 
        'TESTER'
    );

    setResults(prev => ({ ...prev, [feature]: success ? 'success' : 'failed' }));
    addToast(success ? `تست ${feature} موفق بود` : `تست ${feature} شکست خورد`, success ? 'success' : 'error');
  };
  
  const TestCard = ({ title, icon: Icon, id, desc }: any) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex justify-between items-center transition-colors duration-200 border-r-4 border-violet-500">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold dark:text-white">{title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {results[id] === 'running' && <Icons.Refresh className="w-5 h-5 animate-spin text-blue-500" />}
            {results[id] === 'success' && <Icons.Check className="w-5 h-5 text-green-500" />}
            {results[id] === 'failed' && <Icons.X className="w-5 h-5 text-red-500" />}
            <Button size="sm" onClick={() => runTest(id)} disabled={results[id] === 'running'}>شروع تست</Button>
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">سنجش ویژگی‌های فنی</h2>
      <div className="grid gap-4">
        <TestCard id="alert_system" title="سیستم هشدار مهرآباد (Realtime)" icon={Icons.AlertCircle} desc="تست برادکست آنی و پایش متغیرهای شبکه و سوکت" />
        <TestCard id="notification" title="اعلان مرورگر" icon={Icons.Bell} desc="بررسی دسترسی‌های Push Notification" />
        <TestCard id="excel" title="خروجی اکسل" icon={Icons.FileText} desc="تست کتابخانه پردازش فایل‌های XLSX" />
        <TestCard id="database" title="دیتابیس ابری" icon={Icons.HardDrive} desc="تست پینگ و تراکنش‌های خواندنی Supabase" />
      </div>
    </div>
  );
};

export default FeatureTesting;
