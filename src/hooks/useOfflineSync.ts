
import { useEffect, useRef } from 'react';
import { useSyncStore } from '../store/syncStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useStatisticsStore } from '../store/statisticsStore';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';

const MAX_RETRIES = 5;

export const useOfflineSync = () => {
    const {
        queue,
        removeFromQueue,
        incrementRetry,
        updateItemAttempt,
        addSyncLog,
        isProcessing,
        setIsProcessing
    } = useSyncStore();

    const { bulkAddInvoices, updateInvoice, deleteInvoice } = useInvoiceStore();
    const { bulkUpsertStatistics, updateStatistic, deleteStatistic } = useStatisticsStore();
    const { addToast } = useToastStore();

    const processingRef = useRef(false);

    useEffect(() => {
        if (queue.length > 0 && 'serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                return (registration as any).sync.register('sync-queue');
            }).catch(err => {
                console.warn('[Sync] Background sync registration failed:', err);
            });
        }
    }, [queue.length]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && (event.data.type === 'PROCESS_QUEUE_BACKGROUND' || event.data.type === 'TRIGGER_SYNC')) {
                processQueue();
            }
        };
        navigator.serviceWorker?.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            if (queue.length > 0) {
                processQueue();
            }
        };

        window.addEventListener('online', handleOnline);

        if (navigator.onLine && queue.length > 0) {
            processQueue();
        }

        return () => window.removeEventListener('online', handleOnline);
    }, [queue.length]);

    const checkConflict = async (table: string, id: string, offlineTime: number): Promise<boolean> => {
        try {
            const { data, error } = await supabase.from(table).select('updated_at').eq('id', id).single();
            if (error || !data) return false;
            const serverTime = new Date(data.updated_at).getTime();
            return serverTime > offlineTime;
        } catch (e) {
            return false;
        }
    };

    const processQueue = async (force: boolean = false) => {
        if (isProcessing || processingRef.current || queue.length === 0 || !navigator.onLine) return;

        try {
            setIsProcessing(true);
            processingRef.current = true;

            const queueSnapshot = [...queue];
            let successCount = 0;
            let conflictCount = 0;
            let failCount = 0;
            let deadLetterCount = 0;

            for (const item of queueSnapshot) {
                // POISON PILL CHECK: If failed too many times, remove from queue to prevent infinite loop
                if (item.retryCount >= MAX_RETRIES) {
                    addSyncLog({
                        itemId: item.id,
                        itemType: item.type,
                        message: `توقف تلاش پس از ${MAX_RETRIES} بار شکست. آیتم از صف حذف شد.`,
                        timestamp: Date.now()
                    });
                    removeFromQueue(item.id);
                    deadLetterCount++;
                    continue;
                }

                if (!force && item.retryCount > 0 && item.lastAttempt) {
                    const backoffDelay = 2000 * Math.pow(2, Math.min(item.retryCount, 6));
                    const timeSinceLast = Date.now() - item.lastAttempt;
                    if (timeSinceLast < backoffDelay) continue;
                }

                let result: { success: boolean; error?: string } = { success: false };
                let isConflict = false;

                try {
                    switch (item.type) {
                        case 'STAT': result = await bulkUpsertStatistics([item.payload], true); break;
                        case 'INVOICE': result = await bulkAddInvoices([item.payload], true); break;
                        case 'UPDATE_INVOICE':
                            isConflict = await checkConflict('invoices', item.payload.id, item.timestamp);
                            if (!isConflict) result = await updateInvoice(item.payload.id, item.payload.updates, true);
                            break;
                        case 'UPDATE_STAT':
                            isConflict = await checkConflict('daily_statistics', item.payload.id, item.timestamp);
                            if (!isConflict) result = await updateStatistic(item.payload.id, item.payload.updates, true);
                            break;
                        case 'DELETE_INVOICE': result = await deleteInvoice(item.payload.id, true); break;
                        case 'DELETE_STAT': result = await deleteStatistic(item.payload.id, true); break;
                    }

                    if (isConflict) {
                        removeFromQueue(item.id);
                        conflictCount++;
                        addSyncLog({
                            itemId: item.id,
                            itemType: item.type,
                            message: 'تضاد با سرور: این رکورد در سرور تغییر کرده است.',
                            timestamp: Date.now()
                        });
                    } else if (result.success) {
                        removeFromQueue(item.id);
                        successCount++;
                    } else {
                        incrementRetry(item.id);
                        updateItemAttempt(item.id, Date.now());
                        addSyncLog({
                            itemId: item.id,
                            itemType: item.type,
                            message: result.error || 'خطای ناشناخته',
                            timestamp: Date.now()
                        });
                        failCount++;
                    }
                } catch (itemErr: any) {
                    incrementRetry(item.id);
                    updateItemAttempt(item.id, Date.now());
                    addSyncLog({
                        itemId: item.id,
                        itemType: item.type,
                        message: `خطای سیستمی: ${itemErr.message}`,
                        timestamp: Date.now()
                    });
                    failCount++;
                }
            }

            if (successCount > 0) addToast(`${successCount} مورد همگام‌سازی شد.`, 'success');
            if (deadLetterCount > 0) addToast(`${deadLetterCount} مورد ناموفق از صف حذف شد.`, 'error');

        } catch (e) {
            console.error('[Sync] Critical Loop Error:', e);
        } finally {
            setIsProcessing(false);
            processingRef.current = false;
        }
    };

    return { isSyncing: isProcessing, processQueue };
};
