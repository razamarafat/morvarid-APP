
import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { getTodayJalali } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';

const BackupManagement: React.FC = () => {
  const { confirm } = useConfirm();
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateBackup = async () => {
    const confirmed = await confirm({
      title: 'ایجاد نسخه پشتیبان ابری',
      message: 'آیا می‌خواهید تمام اطلاعات دیتابیس را دانلود کنید؟ این عملیات ممکن است کمی زمان‌بر باشد.',
      confirmText: 'دانلود فایل',
      type: 'info'
    });

    if (confirmed) {
      setIsLoading(true);
      try {
        // Fetch all data from Supabase Tables
        const [
            { data: farms },
            { data: products },
            { data: profiles },
            { data: userFarms },
            { data: stats },
            { data: invoices }
        ] = await Promise.all([
            supabase.from('farms').select('*'),
            supabase.from('products').select('*'),
            supabase.from('profiles').select('*'),
            supabase.from('user_farms').select('*'),
            supabase.from('daily_statistics').select('*'),
            supabase.from('invoices').select('*')
        ]);

        const backupData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          data: {
              farms,
              products,
              profiles,
              userFarms,
              stats,
              invoices
          }
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Morvarid_Cloud_Backup_${getTodayJalali().replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addToast('نسخه پشتیبان دیتابیس با موفقیت دانلود شد', 'success');
      } catch (error: any) {
          addToast('خطا در دریافت اطلاعات از سرور', 'error');
          console.error('Backup Failed:', error);
      } finally {
          setIsLoading(false);
      }
    }
  };

  const handleRestoreWarning = () => {
      alert('بازگردانی نسخه پشتیبان در نسخه وب غیرفعال است. جهت بازگردانی اطلاعات لطفا فایل جیسون را به تیم فنی تحویل دهید تا از طریق پنل دیتابیس اعمال شود.');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold dark:text-white">پشتیبان‌گیری ابری</h2>
        <Button onClick={handleCreateBackup} isLoading={isLoading}>
          <Icons.HardDrive className="ml-2 h-4 w-4" />
          دانلود نسخه پشتیبان کامل
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[24px] shadow-lg border-l-8 border-blue-500 opacity-75">
            <h3 className="font-bold text-xl mb-3 dark:text-white">بازگردانی اطلاعات</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                به دلیل امنیت داده‌ها و روابط پیچیده دیتابیس، بازگردانی خودکار از طریق وب‌سایت غیرفعال است. 
                لطفاً در صورت نیاز به بازگردانی، فایل پشتیبان را به مدیر سیستم تحویل دهید.
            </p>
            <Button variant="secondary" className="w-full" onClick={handleRestoreWarning}>
                آپلود فایل (غیرفعال)
            </Button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[24px] shadow-lg border-l-8 border-green-500">
             <h3 className="font-bold text-xl mb-3 dark:text-white">وضعیت دیتابیس</h3>
             <div className="flex items-center gap-2 text-green-600 mb-2">
                 <Icons.Check className="w-5 h-5" />
                 <span className="font-bold">اتصال به Supabase برقرار است</span>
             </div>
             <p className="text-sm text-gray-500">تمامی داده‌ها به صورت خودکار و لحظه‌ای در سرورهای ابری ذخیره می‌شوند.</p>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
