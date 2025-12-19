
import React, { useState } from 'react';
import Button from '../common/Button';
import { useBiometric } from '../../hooks/useBiometric';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore'; 
import { Icons } from '../common/Icons';
import * as XLSX from 'xlsx';

const FeatureTesting: React.FC = () => {
  const { isAvailable } = useBiometric();
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
            case 'biometric':
                if (window.PublicKeyCredential) {
                     const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                     if (available) {
                         success = true;
                         logMessage = 'WebAuthn API در دسترس است';
                     } else {
                         success = false;
                         logMessage = 'سخت‌افزار بیومتریک یافت نشد';
                     }
                } else {
                    success = false;
                    logMessage = 'مرورگر پشتیبانی نمی‌کند';
                }
                technicalDetails = `User Agent: ${navigator.userAgent}`;
                break;

            case 'notification':
                if (!('Notification' in window)) {
                    success = false;
                    logMessage = 'API اعلان پشتیبانی نمی‌شود';
                } else {
                   // Request permission explicitly on user click
                   const permission = await Notification.requestPermission();
                   if (permission === 'granted') {
                       success = true;
                       logMessage = 'مجوز اعلان صادر شد';
                       new Notification('تست اعلان مروارید', { body: 'سیستم اعلان به درستی کار می‌کند' });
                   } else {
                       success = false;
                       logMessage = 'مجوز اعلان توسط کاربر رد شد';
                   }
                   technicalDetails = `Permission State: ${permission}`;
                }
                break;

            case 'excel':
                if (XLSX && XLSX.utils) {
                    success = true;
                    logMessage = 'موتور اکسل بارگذاری شد';
                    technicalDetails = `Version: ${XLSX.version || 'Module Imported'}`;
                } else {
                    success = false;
                    logMessage = 'ماژول اکسل یافت نشد';
                }
                break;

            case 'database':
                try {
                    const testKey = 'morvarid_test_db';
                    const testVal = 'write_test_' + Date.now();
                    localStorage.setItem(testKey, testVal);
                    const readVal = localStorage.getItem(testKey);
                    
                    if (readVal === testVal) {
                        localStorage.removeItem(testKey);
                        success = true;
                        logMessage = 'پایگاه داده داخلی سالم است';
                    } else {
                        success = false;
                        logMessage = 'خطا در خواندن/نوشتن داده';
                    }
                    technicalDetails = "LocalStorage Functional"; 
                } catch(e: any) {
                    success = false;
                    logMessage = `خطا: ${e.name}`;
                }
                break;
        }
    } catch(e: any) {
        success = false;
        logMessage = `خطای پیش‌بینی نشده: ${e.message}`;
        technicalDetails = e.stack || 'No stack trace';
    }
    
    addLog(
        success ? 'info' : 'error', 
        'database', 
        `Test [${feature}]: ${logMessage}. Details: ${technicalDetails}`
    );

    setResults(prev => ({ ...prev, [feature]: success ? 'success' : 'failed' }));
    if(success) addToast(`تست ${feature} موفق بود`, 'success');
    else addToast(`تست ${feature} ناموفق بود: ${logMessage}`, 'error');
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
        <TestCard id="biometric" title="ماژول بیومتریک" icon={Icons.Fingerprint} desc="بررسی WebAuthn API" />
        <TestCard id="notification" title="سیستم اعلان" icon={Icons.Bell} desc="بررسی مجوزهای مرورگر" />
        <TestCard id="excel" title="موتور اکسل" icon={Icons.FileText} desc="بررسی کتابخانه SheetJS" />
        <TestCard id="database" title="پایگاه داده داخلی" icon={Icons.HardDrive} desc="بررسی LocalStorage/IndexedDB" />
      </div>
    </div>
  );
};

export default FeatureTesting;
