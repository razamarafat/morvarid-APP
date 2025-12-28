
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { useSyncStore, SyncItem } from '../../store/syncStore';
import Button from './Button';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits } from '../../utils/dateUtils';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { AnimatePresence, motion } from 'framer-motion';

const OnlineStatusBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { queue, syncLogs, clearQueue, clearSyncLogs, isProcessing } = useSyncStore();
  const { processQueue } = useOfflineSync();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'logs'>('queue');
  const { confirm } = useConfirm();
  const { addToast } = useToastStore();
  
  // Ref to hold the timeout ID for debouncing
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const failedItemsCount = queue.filter(i => i.retryCount > 0).length;
  
  const isSyncingActive = isProcessing && isOnline;

  useEffect(() => {
    const handleStatusChange = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setIsOnline(navigator.onLine);
      }, 1000); 
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    
    handleStatusChange();

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClearQueue = async () => {
      const yes = await confirm({
          title: 'پاکسازی صف آفلاین',
          message: 'آیا اطمینان دارید؟ تمام تغییرات ذخیره نشده حذف خواهند شد و قابل بازگشت نیستند.',
          confirmText: 'بله، حذف کن',
          cancelText: 'انصراف',
          type: 'danger'
      });
      if (yes) {
          clearQueue();
          addToast('صف تغییرات با موفقیت پاکسازی شد', 'info');
          setIsModalOpen(false);
      }
  };

  const handleManualRetry = () => {
      if (!isOnline) {
          addToast('برای تلاش مجدد باید آنلاین باشید.', 'warning');
          return;
      }
      addToast('در حال تلاش مجدد برای ارسال...', 'info');
      processQueue(true); 
  };

  const handleClearLogs = () => {
      clearSyncLogs();
      addToast('تاریخچه خطاها پاک شد', 'info');
  };

  const getStatusColor = () => {
      if (!isOnline) return 'bg-red-500 text-white animate-pulse shadow-red-500/30';
      if (failedItemsCount > 0) return 'bg-orange-500 text-white shadow-orange-500/30';
      if (isSyncingActive) return 'bg-blue-500 text-white shadow-blue-500/30'; 
      if (queue.length > 0) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'; 
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  };

  const getStatusText = () => {
      if (!isOnline) return 'آفلاین';
      if (failedItemsCount > 0) return 'خطا در همگام‌سازی';
      if (isSyncingActive) return 'در حال ارسال...';
      if (queue.length > 0) return 'در انتظار ارسال';
      return 'آنلاین';
  };

  const getIcon = () => {
      if (!isOnline) return Icons.Globe;
      if (failedItemsCount > 0) return Icons.AlertCircle;
      if (queue.length > 0) return Icons.Refresh;
      return Icons.Check;
  };

  const StatusIcon = getIcon();

  const renderQueueItem = (item: SyncItem) => {
      const typeLabel: Record<string, string> = {
          'STAT': 'ثبت آمار تولید',
          'INVOICE': 'ثبت حواله فروش',
          'UPDATE_STAT': 'ویرایش آمار',
          'UPDATE_INVOICE': 'ویرایش حواله',
          'DELETE_STAT': 'حذف آمار',
          'DELETE_INVOICE': 'حذف حواله'
      };

      const backoffDelay = 2000 * Math.pow(2, Math.min(item.retryCount, 6));
      const nextAttemptTime = (item.lastAttempt || 0) + backoffDelay;
      const secondsRemaining = Math.max(0, Math.ceil((nextAttemptTime - Date.now()) / 1000));

      return (
          <div key={item.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 mb-2 relative overflow-hidden">
              <div className="flex justify-between items-start mb-1 relative z-10">
                  <span className="font-bold text-sm text-gray-800 dark:text-white">{typeLabel[item.type] || item.type}</span>
                  <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                      {new Date(item.timestamp).toLocaleTimeString('fa-IR')}
                  </span>
              </div>
              
              <div className="flex justify-between items-center text-xs relative z-10 mt-1">
                  <div className="flex items-center gap-2">
                      <span className={`${item.retryCount > 0 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                          تلاش: {toPersianDigits(item.retryCount)}
                      </span>
                      {secondsRemaining > 0 && isOnline && !isProcessing && (
                          <span className="text-orange-600 dark:text-orange-400 font-bold">
                              (تلاش مجدد: {toPersianDigits(secondsRemaining)} ثانیه)
                          </span>
                      )}
                  </div>
                  {item.retryCount === 0 && <span className="text-blue-500 font-bold">در انتظار ارسال</span>}
              </div>
              
              {secondsRemaining > 0 && isOnline && !isProcessing && (
                  <div 
                    className="absolute bottom-0 right-0 h-1 bg-orange-500/20 transition-all duration-1000 ease-linear" 
                    style={{ width: `${Math.min(100, (secondsRemaining / (backoffDelay/1000)) * 100)}%` }}
                  />
              )}
          </div>
      );
  };

  if (isOnline && queue.length === 0 && syncLogs.length === 0) return null;

  return (
    <>
        <button 
            onClick={() => setIsModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 shadow-sm active:scale-95 ${getStatusColor()}`}
        >
            <StatusIcon className={`w-4 h-4 ${isSyncingActive ? 'animate-spin' : ''}`} />
            <span>{getStatusText()}</span>
            
            {queue.length > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {toPersianDigits(queue.length)}
                </span>
            )}
        </button>

        {/* CUSTOM MODAL FOR OFFLINE STATUS - Z-INDEX 9999 TO OVERLAY EVERYTHING */}
        <AnimatePresence>
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsModalOpen(false)}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />
                    
                    {/* Modal Content - Centered properly using flexbox */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-[#FDFBFF] dark:bg-[#1E1E1E] rounded-[24px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-black/20 shrink-0">
                            <h3 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                                <Icons.Refresh className="w-5 h-5 text-metro-blue" />
                                مدیریت همگام‌سازی
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <Icons.X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            <div className={`p-3 rounded-xl mb-4 text-center text-sm font-bold flex items-center justify-center gap-2 ${isOnline ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                {isOnline ? <Icons.Check className="w-4 h-4" /> : <Icons.Globe className="w-4 h-4" />}
                                {isOnline ? 'وضعیت شبکه: متصل (آنلاین)' : 'وضعیت شبکه: قطع (آفلاین)'}
                            </div>

                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4 shrink-0">
                                <button 
                                    onClick={() => setActiveTab('queue')} 
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-white dark:bg-gray-600 shadow text-metro-blue' : 'text-gray-500'}`}
                                >
                                    صف ارسال ({toPersianDigits(queue.length)})
                                </button>
                                <button 
                                    onClick={() => setActiveTab('logs')} 
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-gray-600 shadow text-metro-orange' : 'text-gray-500'}`}
                                >
                                    گزارش خطاها ({toPersianDigits(syncLogs.length)})
                                </button>
                            </div>

                            <div className="min-h-[150px]">
                                {activeTab === 'queue' ? (
                                    queue.length === 0 ? (
                                        <div className="h-40 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                            <Icons.Check className="w-10 h-10 mb-2 opacity-30" />
                                            <span className="text-xs font-bold">همه تغییرات با موفقیت ارسال شده‌اند</span>
                                        </div>
                                    ) : (
                                        queue.map(renderQueueItem)
                                    )
                                ) : (
                                    syncLogs.length === 0 ? (
                                        <div className="h-40 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                            <Icons.FileText className="w-10 h-10 mb-2 opacity-30" />
                                            <span className="text-xs font-bold">هیچ خطایی ثبت نشده است</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {syncLogs.map(log => (
                                                <div key={log.id} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border-r-4 border-red-400 border-t border-b border-l border-gray-100 dark:border-gray-800">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="font-bold text-xs text-red-800 dark:text-red-300">{log.itemType}</span>
                                                        <span className="font-mono text-[10px] text-red-600/70">{new Date(log.timestamp).toLocaleTimeString('fa-IR')}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-700 dark:text-gray-300 break-words leading-relaxed">{log.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2 shrink-0">
                            {activeTab === 'queue' && queue.length > 0 && isOnline && (
                                <Button variant="primary" onClick={handleManualRetry} disabled={isProcessing} className="w-full h-12 text-sm bg-orange-500 hover:bg-orange-600 text-white">
                                    <Icons.Refresh className={`w-4 h-4 ml-2 ${isProcessing ? 'animate-spin' : ''}`} />
                                    تلاش مجدد آنی
                                </Button>
                            )}

                            {activeTab === 'queue' && queue.length > 0 && (
                                <Button variant="danger" onClick={handleClearQueue} className="w-full h-12 text-sm">
                                    <Icons.Trash className="w-4 h-4 ml-2" />
                                    حذف کل صف (انصراف)
                                </Button>
                            )}
                            
                            {activeTab === 'logs' && syncLogs.length > 0 && (
                                <Button variant="secondary" onClick={handleClearLogs} className="w-full h-12 text-sm text-gray-500">
                                    <Icons.Trash className="w-4 h-4 ml-2" />
                                    پاکسازی گزارشات
                                </Button>
                            )}
                            
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full h-12 text-sm">
                                بستن پنجره
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </>
  );
};

export default OnlineStatusBadge;
