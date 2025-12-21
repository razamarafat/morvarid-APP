
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
    setResults(prev => ({ ...prev, [feature]: 'running' }));
    
    // Give UI a moment to update
    await new Promise(resolve => setTimeout(resolve, 100));

    let success = false;
    let logMessage = '';
    let technicalDetails = '';

    try {
        switch(feature) {
            case 'alert_system':
                const socketState = (channel as any)?.conn?.readyState || 'N/A';
                const startTime = Date.now();
                
                const realMehrabadFarm = farms.find(f => f.name.includes('مهرآباد'));
                const targetId = realMehrabadFarm ? realMehrabadFarm.id : 'NOT_FOUND_UUID';
                const targetName = realMehrabadFarm ? realMehrabadFarm.name : 'مهرآباد (یافت نشد)';

                const response = await sendAlert(
                    targetId, 
                    targetName, 
                    `تست فنی نفوذ هشدار آنی - هدف: ${targetName} - زمان: ${new Date().toLocaleTimeString('fa-IR')}`
                );
                
                const duration = Date.now() - startTime;

                if (response.success) {
                    success = true;
                    logMessage = `سیستم هشدار تایید شد (Broadcast: ${response.detail})`;
                    technicalDetails = `RTT: ${duration}ms | Payload: ${response.bytes}B | TargetID: ${targetId.substring(0,8)}... | Socket: ${socketState}`;
                } else {
                    success = false;
                    logMessage = `خطا در زیرساخت Realtime (${response.detail})`;
                    technicalDetails = `Status: ${response.detail} | SocketState: ${socketState}`;
                }
                break;

            case 'notification':
                if (!('Notification' in window)) {
                    success = false;
                    logMessage = 'API اعلان توسط مرورگر پشتیبانی نمی‌شود.';
                } else {
                   const permission = await Notification.requestPermission();
                   if (permission === 'granted') {
                       try {
                           // Timeout Promise to prevent hanging if SW isn't ready
                           const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
                           
                           // Check for SW support and Readiness
                           if ('serviceWorker' in navigator) {
                               // Race between SW ready and 3s timeout
                               const registration = await Promise.race([
                                   navigator.serviceWorker.ready,
                                   timeout
                               ]);

                               if (registration) {
                                   await registration.showNotification('تست فنی مروارید', { 
                                       body: `Notification System Check: OK (Via Service Worker)\nTimestamp: ${new Date().toISOString()}`,
                                       dir: 'rtl',
                                       icon: '/vite.svg',
                                       badge: '/vite.svg',
                                       tag: 'test-notification-sw',
                                       vibrate: [200, 100, 200]
                                   } as any);
                                   success = true;
                                   logMessage = 'مجوز اعلان تایید و تست از طریق Service Worker ارسال شد.';
                               } else {
                                   // Timed out or not found, fallback to standard
                                   throw new Error('SW not ready or timed out, trying fallback.');
                               }
                           } else {
                               throw new Error('SW not supported, trying fallback.');
                           }
                       } catch (swError: any) {
                           console.warn('SW Notification failed or timed out:', swError);
                           // Fallback for browsers without SW support (e.g. old Safari) OR if SW timed out
                           try {
                               new Notification('تست فنی مروارید', { 
                                   body: `Notification System Check: OK (Direct/Fallback)\nTimestamp: ${new Date().toISOString()}`,
                                   dir: 'rtl'
                               });
                               success = true;
                               logMessage = 'مجوز اعلان تایید و تست به صورت مستقیم ارسال شد (Fallback).';
                           } catch (directError: any) {
                               success = false;
                               logMessage = `خطا در نمایش اعلان: ${directError.message}`;
                               technicalDetails = `SW Error: ${swError.message} | Direct Error: ${directError.message}`;
                           }
                       }
                   } else {
                       success = false;
                       logMessage = `دسترسی اعلان رد شد (وضعیت: ${permission}).`;
                   }
                   if(!technicalDetails) technicalDetails = `State: ${permission} | Vendor: ${navigator.vendor}`;
                }
                break;

            case 'excel':
                if (XLSX && XLSX.utils) {
                    success = true;
                    logMessage = 'موتور SheetJS بارگذاری شد.';
                    technicalDetails = `v${XLSX.version} | Build: Browserify`;
                } else {
                    success = false;
                    logMessage = 'کتابخانه XLSX یافت نشد.';
                }
                break;

            case 'database':
                try {
                    const start = Date.now();
                    const { error, status } = await supabase.from('products').select('count', { count: 'exact', head: true });
                    const durationDb = Date.now() - start;

                    if (!error && (status >= 200 && status < 300)) {
                        success = true;
                        logMessage = `اتصال دیتابیس برقرار است (${durationDb}ms).`;
                        technicalDetails = `HTTP: ${status} | Latency: ${durationDb}ms | Mode: Head-Request`;
                    } else {
                        success = false;
                        logMessage = `خطا در اتصال Supabase: ${error?.message || 'Unknown'}`;
                        technicalDetails = `Code: ${error?.code || 'N/A'} | Status: ${status}`;
                    }
                } catch(e: any) {
                    success = false;
                    logMessage = `خطای استثنا در دیتابیس: ${e.name}`;
                    technicalDetails = e.message;
                }
                break;
        }
    } catch(e: any) {
        success = false;
        logMessage = `خطای سیستمی: ${e.message}`;
        technicalDetails = `Trace: ${e.stack?.substring(0, 50)}...`;
    }
    
    // ALWAYS Log and Update State
    addLog(
        success ? 'info' : 'error', 
        'frontend', 
        `[TEST:${feature.toUpperCase()}] ${logMessage} | جزئیات فنی: ${technicalDetails}`
    );

    setResults(prev => ({ ...prev, [feature]: success ? 'success' : 'failed' }));
    if(success) addToast(`تست ${feature} موفق بود`, 'success');
    else addToast(`تست ${feature} ناموفق بود.`, 'error');
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
