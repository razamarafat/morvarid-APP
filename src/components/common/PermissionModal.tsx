
import React, { useEffect, useState } from 'react';
import { usePermissionStore, PermissionType } from '../../store/permissionStore';
import Modal from './Modal';
import Button from './Button';
import { Icons } from './Icons';
import { AnimatePresence, motion } from 'framer-motion';

const PermissionModal: React.FC = () => {
  const { 
    checkPermission, 
    requestPermission, 
    permissions, 
    hasCheckedInitial, 
    setHasCheckedInitial 
  } = usePermissionStore();

  const [isOpen, setIsOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<PermissionType | null>(null);

  useEffect(() => {
    const initCheck = async () => {
        if (hasCheckedInitial) return;

        await Promise.all([
            checkPermission('notifications'),
            checkPermission('clipboard-read')
        ]);

        const currentPerms = usePermissionStore.getState().permissions;
        const needsAttention = 
            currentPerms['notifications'] === 'prompt' || 
            currentPerms['clipboard-read'] === 'prompt' ||
            currentPerms['clipboard-read'] === 'denied'; // If denied, we might want to guide them once

        if (needsAttention) {
            setIsOpen(true);
        } else {
            setHasCheckedInitial(true);
        }
    };

    // Small delay to allow app to load first
    const timer = setTimeout(initCheck, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleGrant = async (type: PermissionType) => {
      setLoadingType(type);
      await requestPermission(type);
      setLoadingType(null);
  };

  const handleClose = () => {
      setHasCheckedInitial(true);
      setIsOpen(false);
  };

  const renderItem = (type: PermissionType, title: string, desc: string, icon: any) => {
      const status = permissions[type];
      const Icon = icon;
      
      let statusBadge;
      if (status === 'granted') statusBadge = <span className="text-green-500 flex items-center gap-1 text-xs font-bold"><Icons.Check className="w-4 h-4" /> فعال شد</span>;
      else if (status === 'denied') statusBadge = <span className="text-red-500 text-xs font-bold">رد شده (نیاز به تنظیمات)</span>;
      else statusBadge = null;

      return (
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${status === 'granted' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'} dark:bg-white/10 dark:text-white`}>
                      <Icon className="w-6 h-6" />
                  </div>
                  <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px] leading-relaxed">{desc}</p>
                  </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                  {statusBadge}
                  {status !== 'granted' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGrant(type)} 
                        isLoading={loadingType === type}
                        disabled={status === 'denied'} // If denied, browser won't let us prompt again usually
                        className={status === 'denied' ? 'opacity-50 cursor-not-allowed bg-gray-400' : ''}
                      >
                          {status === 'denied' ? 'قفل شده' : 'فعال‌سازی'}
                      </Button>
                  )}
              </div>
          </div>
      );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="دسترسی‌های مورد نیاز">
        <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <Icons.AlertCircle className="w-5 h-5 inline-block ml-2 text-blue-600 align-middle" />
                برای عملکرد صحیح سامانه مروارید (ثبت پیامکی و هشدارها)، لطفاً دسترسی‌های زیر را تایید کنید.
            </p>

            <div className="space-y-3">
                {renderItem(
                    'notifications', 
                    'اعلان‌ها و هشدارها', 
                    'دریافت پیام‌های فوری مدیر و یادآوری انقضای ویرایش', 
                    Icons.Bell
                )}
                {renderItem(
                    'clipboard-read', 
                    'خواندن کلیپ‌بورد', 
                    'تشخیص خودکار و ثبت حواله‌ها از متن پیامک کپی شده', 
                    Icons.FileText
                )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <Button variant="secondary" onClick={handleClose}>
                    بعداً انجام می‌دهم
                </Button>
                <Button onClick={handleClose}>
                    متوجه شدم / بستن
                </Button>
            </div>
        </div>
    </Modal>
  );
};

export default PermissionModal;
