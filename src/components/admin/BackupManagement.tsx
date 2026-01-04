
import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { getTodayJalali } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';
import { APP_VERSION } from '../../constants';

const BackupManagement: React.FC = () => {
  const { confirm } = useConfirm();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
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
        // Fetch all data from Supabase Tables with individual error handling
        const [
            farmsRes,
            productsRes,
            profilesRes,
            userFarmsRes,
            statsRes,
            invoicesRes
        ] = await Promise.all([
            supabase.from('farms').select('*'),
            supabase.from('products').select('*'),
            supabase.from('profiles').select('*'),
            supabase.from('user_farms').select('*'),
            supabase.from('daily_statistics').select('*'),
            supabase.from('invoices').select('*')
        ]);

        // Strict Validation
        if (farmsRes.error) throw new Error(`Farms Error: ${farmsRes.error.message}`);
        if (productsRes.error) throw new Error(`Products Error: ${productsRes.error.message}`);
        if (profilesRes.error) throw new Error(`Profiles Error: ${profilesRes.error.message}`);
        if (userFarmsRes.error) throw new Error(`UserFarms Error: ${userFarmsRes.error.message}`);
        if (statsRes.error) throw new Error(`Stats Error: ${statsRes.error.message}`);
        if (invoicesRes.error) throw new Error(`Invoices Error: ${invoicesRes.error.message}`);

        const timestamp = new Date().toISOString();
        const userName = user?.username || 'unknown_admin';

        const backupData = {
          _metadata: {
              version: '2.0',
              appVersion: APP_VERSION,
              timestamp: timestamp,
              exportedBy: user?.fullName || 'System Admin',
              exporterUsername: userName,
              exporterRole: user?.role || 'ADMIN',
              recordCounts: {
                  farms: farmsRes.data?.length || 0,
                  products: productsRes.data?.length || 0,
                  users: profilesRes.data?.length || 0,
                  statistics: statsRes.data?.length || 0,
                  invoices: invoicesRes.data?.length || 0
              }
          },
          data: {
              farms: farmsRes.data,
              products: productsRes.data,
              profiles: profilesRes.data,
              userFarms: userFarmsRes.data,
              stats: statsRes.data,
              invoices: invoicesRes.data
          }
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Secure and informative filename
        const safeDate = getTodayJalali().replace(/\//g, '-');
        const safeTime = new Date().getHours() + '-' + new Date().getMinutes();
        a.download = `Morvarid_Backup_${safeDate}_${safeTime}_${userName}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addToast('نسخه پشتیبان کامل با موفقیت دانلود شد', 'success');
      } catch (error: any) {
          addToast(`خطا در دریافت اطلاعات: ${error.message}`, 'error');
          console.error('Backup Failed:', error);
      } finally {
          setIsLoading(false);
      }
    }
  };

  const handleRestoreWarning = async () => {
      await confirm({
        title: 'بازگردانی نسخه پشتیبان',
        message: 'بازگردانی نسخه پشتیبان در نسخه وب غیرفعال است. جهت بازگردانی اطلاعات لطفا فایل JSON را به تیم فنی تحویل دهید تا از طریق پنل دیتابیس اعمال شود.',
        confirmText: 'متوجه شدم',
        cancelText: '',
        type: 'info'
      });
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
             <p className="text-sm text-gray-500">تمامی داده‌ها به صورت خودکار و لحظه‌ای در سرورهای ابری ذخیره می‌شوند. نسخه پشتیبان دستی شامل واترمارک زمانی و نام کاربر است.</p>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
