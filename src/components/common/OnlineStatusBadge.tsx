
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { useSyncStore, SyncItem } from '../../store/syncStore';
import Button from './Button';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits } from '../../utils/dateUtils';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { AnimatePresenceWrapper as AnimatePresence, MotionDivWrapper as motion } from './MotionWrapper';

const OnlineStatusBadge: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { queue, syncLogs, clearQueue, clearSyncLogs, isProcessing } = useSyncStore();
    const { processQueue } = useOfflineSync();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'queue' | 'logs'>('queue');
    const { confirm } = useConfirm();
    const { addToast } = useToastStore();

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const failedItemsCount = queue.filter(i => i.retryCount > 0).length;
    const isSyncingActive = isProcessing && isOnline;

    useEffect(() => {
        const handleStatusChange = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
            message: 'آیا اطمینان دارید؟ تمام تغییرات ذخیره نشده حذف خواهند شد.',
            confirmText: 'بله، حذف کن',
            type: 'danger'
        });
        if (yes) {
            clearQueue();
            addToast('صف تغییرات پاکسازی شد', 'info');
            setIsModalOpen(false);
        }
    };

    const handleManualRetry = () => {
        if (!isOnline) {
            addToast('برای تلاش مجدد باید آنلاین باشید.', 'warning');
            return;
        }
        addToast('در حال تلاش مجدد...', 'info');
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
        if (failedItemsCount > 0) return 'خطا';
        if (isSyncingActive) return 'در حال ارسال';
        if (queue.length > 0) return 'در صف';
        return 'آنلاین';
    };

    const getIcon = () => {
        if (!isOnline) return Icons.Globe;
        if (failedItemsCount > 0) return Icons.AlertCircle;
        if (queue.length > 0) return Icons.Refresh;
        return Icons.Check;
    };

    const StatusIcon = getIcon();

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

            {/* REWRITTEN MODAL OVERLAY & CONTAINER - FIXED POSITIONING */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <AnimatePresence>
                        {/* Dark Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />

                        {/* Modal Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-sm bg-white dark:bg-[#1E1E1E] rounded-lg p-4 shadow-xl flex flex-col overflow-hidden max-h-[85vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-black/20 shrink-0">
                                <h3 className="font-black text-base text-gray-800 dark:text-white flex items-center gap-2">
                                    <Icons.Refresh className="w-5 h-5 text-metro-blue" />
                                    وضعیت همگام‌سازی
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                                    <Icons.X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body - Scrollable */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                <div className={`p-3 rounded-xl mb-4 text-center text-sm font-bold flex items-center justify-center gap-2 ${isOnline ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                                    {isOnline ? <Icons.Check className="w-4 h-4" /> : <Icons.Globe className="w-4 h-4" />}
                                    <span>{isOnline ? 'ارتباط با سرور برقرار است' : 'اتصال اینترنت قطع است'}</span>
                                </div>

                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4 shrink-0">
                                    <button onClick={() => setActiveTab('queue')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-white dark:bg-gray-600 shadow text-metro-blue' : 'text-gray-500'}`}>
                                        صف ({toPersianDigits(queue.length)})
                                    </button>
                                    <button onClick={() => setActiveTab('logs')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-gray-600 shadow text-metro-orange' : 'text-gray-500'}`}>
                                        لاگ‌ها ({toPersianDigits(syncLogs.length)})
                                    </button>
                                </div>

                                <div className="space-y-2 min-h-[100px]">
                                    {activeTab === 'queue' ? (
                                        queue.length === 0 ? (
                                            <div className="h-32 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                                                <Icons.Check className="w-8 h-8 mb-2 opacity-20" />
                                                <span className="text-xs">همه تغییرات ارسال شده‌اند</span>
                                            </div>
                                        ) : (
                                            queue.map(item => (
                                                <div key={item.id} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-xs font-bold block text-gray-700 dark:text-gray-200">{item.type}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleTimeString('fa-IR')}</span>
                                                    </div>
                                                    {item.retryCount > 0 && <span className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">تلاش: {toPersianDigits(item.retryCount)}</span>}
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        syncLogs.length === 0 ? (
                                            <div className="h-32 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                                                <span className="text-xs">بدون خطا</span>
                                            </div>
                                        ) : (
                                            syncLogs.map(log => (
                                                <div key={log.id} className="p-2 bg-red-50/50 dark:bg-red-900/10 rounded-lg text-[10px] border-r-2 border-red-400">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="font-bold text-red-700 dark:text-red-300">{log.itemType}</span>
                                                        <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString('fa-IR')}</span>
                                                    </div>
                                                    <p className="text-gray-600 dark:text-gray-400">{log.message}</p>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-black/10 shrink-0 flex flex-col gap-2">
                                {activeTab === 'queue' && queue.length > 0 && (
                                    <div className="flex gap-2">
                                        <Button disabled={!isOnline || isProcessing} onClick={handleManualRetry} size="sm" className="flex-1 bg-metro-blue">
                                            ارسال مجدد
                                        </Button>
                                        <Button onClick={handleClearQueue} variant="danger" size="sm" className="flex-1">
                                            حذف صف
                                        </Button>
                                    </div>
                                )}
                                {activeTab === 'logs' && syncLogs.length > 0 && (
                                    <Button onClick={handleClearLogs} variant="secondary" size="sm" className="w-full">
                                        پاکسازی لاگ‌ها
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>,
                document.body
            )}
        </>
    );
};

export default OnlineStatusBadge;
