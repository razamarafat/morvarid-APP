
import React, { useState } from 'react';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore'; 
import { supabase } from '../../lib/supabase';
import { Icons } from '../common/Icons';
import * as XLSX from 'xlsx';

const FeatureTesting: React.FC = () => {
  const { addToast } = useToastStore();
  const { addLog } = useLogStore(); 
  const [results, setResults] = useState<Record<string, string>>({});

  const runTest = async (feature: string) => {
    setResults(prev => ({ ...prev, [feature]: 'running' }));
    
    // Slight delay to show UI state change
    await new Promise(resolve => setTimeout(resolve, 500));

    let success = false;
    let logMessage = '';
    let technicalDetails = '';

    try {
        switch(feature) {
            case 'notification':
                if (!('Notification' in window)) {
                    success = false;
                    logMessage = 'Notification API not supported.';
                } else {
                   // Request permission explicitly on user click
                   const permission = await Notification.requestPermission();
                   if (permission === 'granted') {
                       success = true;
                       logMessage = 'Notification Permission Granted.';
                       new Notification('تست فنی مروارید', { 
                           body: `Notification System Check: OK\nTimestamp: ${new Date().toISOString()}`,
                           dir: 'rtl'
                       });
                   } else {
                       success = false;
                       logMessage = `Notification Permission Denied (State: ${permission}).`;
                   }
                   technicalDetails = `Permission State: ${permission} | MaxActions: ${(Notification as any).maxActions || 'Unknown'}`;
                }
                break;

            case 'excel':
                if (XLSX && XLSX.utils) {
                    success = true;
                    logMessage = 'SheetJS Engine Loaded Successfully.';
                    technicalDetails = `Version: ${XLSX.version} | Cpus: ${navigator.hardwareConcurrency || 'Unknown'}`;
                } else {
                    success = false;
                    logMessage = 'XLSX Module not found.';
                }
                break;

            case 'database':
                try {
                    // Ping Supabase by selecting count of products
                    const start = Date.now();
                    const { data, error, status, statusText } = await supabase.from('products').select('count', { count: 'exact', head: true });
                    const duration = Date.now() - start;

                    // Accept any 2xx status code (200, 201, 204, 206) as success
                    // 206 Partial Content is often returned by PostgREST/Supabase even for head requests
                    if (!error && (status >= 200 && status < 300)) {
                        success = true;
                        logMessage = `Supabase Connection OK (${duration}ms).`;
                        technicalDetails = `Status: ${status} ${statusText || 'OK'} | Latency: ${duration}ms`;
                    } else {
                        success = false;
                        logMessage = `Supabase Connection Failed: ${error?.message || 'Unknown Error'}`;
                        technicalDetails = `Code: ${error?.code || 'N/A'} | Hint: ${error?.hint || 'N/A'} | Status: ${status}`;
                    }
                } catch(e: any) {
                    success = false;
                    logMessage = `Exception during DB Check: ${e.name}`;
                    technicalDetails = e.message;
                }
                break;
        }
    } catch(e: any) {
        success = false;
        logMessage = `Unexpected Runtime Error: ${e.message}`;
        technicalDetails = e.stack || 'No stack trace';
    }
    
    // Detailed System Log
    addLog(
        success ? 'info' : 'error', 
        'frontend', 
        `[TEST:${feature.toUpperCase()}] ${logMessage} || DETAILS: { ${technicalDetails} }`
    );

    setResults(prev => ({ ...prev, [feature]: success ? 'success' : 'failed' }));
    if(success) addToast(`تست ${feature} موفق بود`, 'success');
    else addToast(`تست ${feature} ناموفق بود. جزئیات در لاگ سیستم ثبت شد.`, 'error');
  };
  
  const TestCard = ({ title, icon: Icon, id, desc }: any) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex justify-between items-center transition-colors duration-200">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="font-bold dark:text-white">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {results[id] === 'running' && <Icons.Refresh className="w-5 h-5 animate-spin text-blue-500" />}
            {results[id] === 'success' && <Icons.Check className="w-5 h-5 text-green-500" />}
            {results[id] === 'failed' && <Icons.X className="w-5 h-5 text-red-500" />}
            <Button size="sm" onClick={() => runTest(id)} disabled={results[id] === 'running'}>بررسی فنی</Button>
        </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white">سنجش ویژگی‌های فنی</h2>
      <div className="grid gap-4">
        <TestCard id="notification" title="سیستم اعلان" icon={Icons.Bell} desc="بررسی مجوزهای مرورگر" />
        <TestCard id="excel" title="موتور اکسل" icon={Icons.FileText} desc="بررسی کتابخانه SheetJS" />
        <TestCard id="database" title="اتصال Supabase" icon={Icons.HardDrive} desc="بررسی پینگ و دسترسی دیتابیس" />
      </div>
    </div>
  );
};

export default FeatureTesting;
