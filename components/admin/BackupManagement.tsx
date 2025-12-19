
import React from 'react';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { getTodayJalali } from '../../utils/dateUtils';
import { useLogStore } from '../../store/logStore';

const BackupManagement: React.FC = () => {
  const { confirm } = useConfirm();
  const { addToast } = useToastStore();
  const { addLog } = useLogStore();

  const handleCreateBackup = async () => {
    const confirmed = await confirm({
      title: 'ایجاد نسخه پشتیبان',
      message: 'آیا می‌خواهید یک نسخه پشتیبان از تمام اطلاعات سیستم دانلود کنید؟',
      confirmText: 'دانلود فایل',
      type: 'info'
    });

    if (confirmed) {
      // Dump RAW storage strings to ensure structure preservation
      const data = {
        auth: localStorage.getItem('auth-storage'),
        farm: localStorage.getItem('farm-storage'),
        user: localStorage.getItem('user-storage'), // This was the issue, now capturing raw string
        theme: localStorage.getItem('theme-storage'),
        stats: localStorage.getItem('statistics-storage'), 
        invoices: localStorage.getItem('invoice-storage'),
        logs: localStorage.getItem('system-logs')
      };

      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Morvarid_Backup_${getTodayJalali().replace(/\//g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addToast('نسخه پشتیبان با موفقیت دانلود شد', 'success');
      addLog('info', 'database', 'نسخه پشتیبان ایجاد شد');
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = await confirm({
      title: 'بازگردانی نسخه پشتیبان',
      message: `آیا از بازگردانی فایل ${file.name} اطمینان دارید؟ تمام تغییرات فعلی جایگزین خواهند شد.`,
      confirmText: 'بازگردانی',
      type: 'warning'
    });

    if (confirmed) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          // Helper to restore if data exists
          const restore = (key: string, val: string | null) => {
              if (val) localStorage.setItem(key, val);
          };

          restore('auth-storage', data.auth);
          restore('farm-storage', data.farm);
          restore('user-storage', data.user);
          restore('theme-storage', data.theme);
          restore('statistics-storage', data.stats);
          restore('invoice-storage', data.invoices);
          restore('system-logs', data.logs);
          
          addToast('بازگردانی با موفقیت انجام شد. صفحه رفرش می‌شود.', 'success');
          addLog('warn', 'database', `بازگردانی سیستم با فایل ${file.name}`);
          
          setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
          addToast('فایل پشتیبان معتبر نیست', 'error');
          addLog('error', 'database', 'خطا در بازگردانی فایل پشتیبان');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFactoryReset = async () => {
    const confirmed1 = await confirm({
      title: 'بازگشت به تنظیمات کارخانه',
      message: 'هشدار: این عملیات تمام داده‌ها را حذف می‌کند. فقط حساب مدیر اصلی باقی می‌ماند.',
      confirmText: 'ادامه',
      type: 'danger'
    });

    if (confirmed1) {
        localStorage.clear();
        addToast('سیستم ریست شد. صفحه رفرش می‌شود.', 'success');
        setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold dark:text-white">پشتیبان‌گیری و بازیابی</h2>
        <Button onClick={handleCreateBackup}>
          <Icons.HardDrive className="ml-2 h-4 w-4" />
          دانلود نسخه پشتیبان
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[24px] shadow-lg border-l-8 border-blue-500 transform hover:scale-[1.02] transition-transform">
            <h3 className="font-bold text-xl mb-3 dark:text-white">بازگردانی اطلاعات</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">فایل .json پشتیبان را برای بازگردانی تمام کاربران و اطلاعات انتخاب کنید.</p>
            <div className="relative">
                <input 
                    type="file" 
                    accept=".json"
                    onChange={handleRestore}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
                />
            </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[24px] shadow-lg border-l-8 border-red-500 flex flex-col justify-between transform hover:scale-[1.02] transition-transform">
            <div>
                <h3 className="font-bold text-xl mb-3 text-red-600">منطقه خطر</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">بازگشت به تنظیمات کارخانه و حذف تمام داده‌ها (کاربران، آمار، فارم‌ها)</p>
            </div>
            <Button variant="danger" className="mt-6 w-full py-3 rounded-xl font-bold" onClick={handleFactoryReset}>
                <Icons.Trash className="ml-2 h-4 w-4" />
                بازنشانی کارخانه
            </Button>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
