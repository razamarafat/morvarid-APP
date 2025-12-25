
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { useSyncStore, SyncItem } from '../../store/syncStore';
import Modal from './Modal';
import Button from './Button';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits } from '../../utils/dateUtils';
import { useOfflineSync } from '../../hooks/useOfflineSync';

const OnlineStatusBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { queue, syncLogs, clearQueue, clearSyncLogs, isProcessing } = useSyncStore();
  const { processQueue } = useOfflineSync();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'logs'>('queue');
  const { confirm } = useConfirm();
  const { addToast } = useToastStore();

  const failedItemsCount = queue.filter(i => i.retryCount > 0).length;
  
  // FIX: Only show syncing state if ACTUALLY processing, otherwise show queue status
  const isSyncingActive = isProcessing && isOnline;

  useEffect(() => {
    const updateOnlineStatus = () => {
        setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
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
      processQueue(true); // Force retry
  };

  const handleClearLogs = () => {
      clearSyncLogs();
      addToast('تاریخچه خطاها پاک شد', 'info');
  };

  const getStatusColor = () => {
      if (!isOnline) return 'bg-red-500 text-white animate-pulse shadow-red-500/30';
      if (failedItemsCount > 0) return 'bg-orange-500 text-white shadow-orange-500/30';
      if (isSyncingActive) return 'bg-blue-500 text-white shadow-blue-500/30'; // Only blue when processing
      if (queue.length > 0) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'; // Pending but waiting
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

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="مدیریت همگام‌سازی">
            <div className="h-[450px] flex flex-col">
                
                <div className={`p-2 rounded-lg mb-3 text-center text-xs font-bold ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isOnline ? 'وضعیت شبکه: متصل (آنلاین)' : 'وضعیت شبکه: قطع (آفلاین)'}
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4 shrink-0">
                    <button 
                        onClick={() => setActiveTab('queue')} 
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'queue' ? 'bg-white dark:bg-gray-700 shadow text-metro-blue' : 'text-gray-500'}`}
                    >
                        تغییرات در انتظار ({toPersianDigits(queue.length)})
                    </button>
                    <button 
                        onClick={() => setActiveTab('logs')} 
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'logs' ? 'bg-white dark:bg-gray-700 shadow text-metro-orange' : 'text-gray-500'}`}
                    >
                        لاگ خطاها ({toPersianDigits(syncLogs.length)})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
                    {activeTab === 'queue' ? (
                        queue.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Icons.Check className="w-12 h-12 mb-2 opacity-20" />
                                <span className="text-sm font-bold">همه تغییرات با موفقیت ارسال شده‌اند</span>
                            </div>
                        ) : (
                            queue.map(renderQueueItem)
                        )
                    ) : (
                        syncLogs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Icons.FileText className="w-12 h-12 mb-2 opacity-20" />
                                <span className="text-sm font-bold">هیچ خطایی ثبت نشده است</span>
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

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-2 shrink-0 flex flex-col gap-2">
                    {activeTab === 'queue' && queue.length > 0 && isOnline && (
                        <Button variant="primary" size="sm" onClick={handleManualRetry} disabled={isProcessing} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                            <Icons.Refresh className={`w-4 h-4 ml-2 ${isProcessing ? 'animate-spin' : ''}`} />
                            تلاش مجدد آنی (نادیده گرفتن زمان‌بندی)
                        </Button>
                    )}

                    {activeTab === 'queue' && queue.length > 0 && (
                        <Button variant="danger" size="sm" onClick={handleClearQueue} className="w-full">
                            <Icons.Trash className="w-4 h-4 ml-2" />
                            حذف کل صف (انصراف از تغییرات)
                        </Button>
                    )}
                    
                    {activeTab === 'logs' && syncLogs.length > 0 && (
                        <Button variant="secondary" size="sm" onClick={handleClearLogs} className="w-full text-gray-500">
                            <Icons.Trash className="w-4 h-4 ml-2" />
                            پاکسازی گزارشات
                        </Button>
                    )}
                    
                    <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)} className="w-full">
                        بستن پنجره
                    </Button>
                </div>
            </div>
        </Modal>
    </>
  );
};

export default OnlineStatusBadge;
