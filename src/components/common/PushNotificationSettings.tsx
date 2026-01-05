import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import Button from './Button';
import { useToastStore } from '../../store/toastStore';
import {
  pushNotificationService,
  isPushSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  notifyEvent
} from '../../services/pushNotificationService';

const PushNotificationSettings: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { addToast } = useToastStore();

  useEffect(() => {
    checkSubscriptionStatus();
    checkPermissionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  const checkPermissionStatus = () => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      await subscribeToPushNotifications();
      setIsSubscribed(true);
      setPermission('granted');
      addToast('اعلان‌های فوری فعال شد', 'success');

      // Send a test notification
      setTimeout(() => {
        notifyEvent('login');
      }, 1000);
    } catch (error: any) {
      console.error('Failed to subscribe:', error);
      addToast(error.message || 'خطا در فعال‌سازی اعلان‌ها', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      await unsubscribeFromPushNotifications();
      setIsSubscribed(false);
      addToast('اعلان‌های فوری غیرفعال شد', 'info');
    } catch (error: any) {
      console.error('Failed to unsubscribe:', error);
      addToast(error.message || 'خطا در غیرفعال‌سازی اعلان‌ها', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await pushNotificationService.sendTestNotification();
      addToast('اعلان آزمایشی ارسال شد', 'info');
    } catch (error: any) {
      addToast(error.message || 'خطا در ارسال اعلان آزمایشی', 'error');
    }
  };

  if (!isPushSupported()) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <Icons.Bell className="w-5 h-5" />
          <span className="text-sm">اعلان‌های فوری در این مرورگر پشتیبانی نمی‌شود</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icons.Bell className="w-5 h-5 text-metro-blue" />
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">اعلان‌های فوری</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              اعلان‌های مهم را در زمان واقعی دریافت کنید
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div className={`w-3 h-3 rounded-full ${
            permission === 'granted' && isSubscribed
              ? 'bg-green-500'
              : permission === 'denied'
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`} />

          <span className="text-xs font-bold">
            {permission === 'granted' && isSubscribed
              ? 'فعال'
              : permission === 'denied'
              ? 'مسدود'
              : 'غیرفعال'
            }
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {permission === 'default' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              برای فعال‌سازی اعلان‌ها، ابتدا اجازه مرورگر را بدهید.
            </p>
          </div>
        )}

        {permission === 'denied' && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              اعلان‌ها توسط مرورگر مسدود شده‌اند. لطفاً تنظیمات مرورگر را بررسی کنید.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {!isSubscribed ? (
            <Button
              onClick={handleSubscribe}
              isLoading={isLoading}
              disabled={permission === 'denied'}
              className="w-full bg-metro-blue hover:bg-metro-cobalt"
            >
              <Icons.Bell className="w-4 h-4 ml-2" />
              فعال‌سازی اعلان‌ها
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleUnsubscribe}
                isLoading={isLoading}
                variant="secondary"
                className="flex-1"
              >
                <Icons.BellOff className="w-4 h-4 ml-2" />
                غیرفعال‌سازی
              </Button>

              <Button
                onClick={handleTestNotification}
                variant="ghost"
                className="flex-1"
              >
                <Icons.Send className="w-4 h-4 ml-2" />
                تست اعلان
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>• اعلان‌های ورود و خروج از سیستم</p>
          <p>• وضعیت همگام‌سازی داده‌ها</p>
          <p>• بروزرسانی‌های مهم مزرعه</p>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationSettings;
