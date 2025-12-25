
import { useEffect, useRef } from 'react';
import { useSyncStore } from '../store/syncStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useStatisticsStore } from '../store/statisticsStore';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';

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
    
    // Prevent double execution in React Strict Mode
    const processingRef = useRef(false);

    useEffect(() => {
        const handleOnline = () => {
            if (queue.length > 0) {
                console.log('[Sync] Network connected. Processing queue...');
                processQueue();
            }
        };

        window.addEventListener('online', handleOnline);
        
        // Also try processing on mount if online and queue has items
        if (navigator.onLine && queue.length > 0) {
            processQueue();
        }

        return () => window.removeEventListener('online', handleOnline);
    }, [queue.length]);

    const checkConflict = async (table: string, id: string, offlineTime: number): Promise<boolean> => {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('updated_at')
                .eq('id', id)
                .single();
            
            if (error || !data) return false;

            const serverTime = new Date(data.updated_at).getTime();
            // Conflict Rule: Server Wins (Last Write Wins Logic)
            if (serverTime > offlineTime) {
                console.warn(`[Sync] Conflict detected for ${table}:${id}. Server time: ${serverTime}, Offline time: ${offlineTime}. Skipping offline update.`);
                return true; 
            }
            return false;
        } catch (e) {
            console.error('[Sync] Conflict check failed', e);
            return false; 
        }
    };

    const processQueue = async (force: boolean = false) => {
        // Guard clauses
        if (isProcessing || processingRef.current || queue.length === 0 || !navigator.onLine) return;
        
        try {
            setIsProcessing(true);
            processingRef.current = true;

            const queueSnapshot = [...queue]; 
            let successCount = 0;
            let conflictCount = 0;
            let failCount = 0;

            for (const item of queueSnapshot) {
                
                // --- EXPONENTIAL BACKOFF LOGIC ---
                // Skip backoff check if forced
                if (!force && item.retryCount > 0 && item.lastAttempt) {
                    const backoffDelay = 2000 * Math.pow(2, Math.min(item.retryCount, 6)); 
                    const timeSinceLast = Date.now() - item.lastAttempt;
                    
                    if (timeSinceLast < backoffDelay) {
                        continue; // Skip this item, still in cooldown
                    }
                }

                let result: { success: boolean; error?: string } = { success: false };
                let isConflict = false;

                // Syncing logic...
                // Using try/catch specifically for the ITEM operation to not break the LOOP
                try {
                    switch (item.type) {
                        case 'STAT':
                            result = await bulkUpsertStatistics([item.payload], true);
                            break;
                        case 'INVOICE':
                            result = await bulkAddInvoices([item.payload], true);
                            break;
                        case 'UPDATE_INVOICE':
                            isConflict = await checkConflict('invoices', item.payload.id, item.timestamp);
                            if (!isConflict) {
                                result = await updateInvoice(item.payload.id, item.payload.updates, true);
                            }
                            break;
                        case 'UPDATE_STAT':
                            isConflict = await checkConflict('daily_statistics', item.payload.id, item.timestamp);
                            if (!isConflict) {
                                result = await updateStatistic(item.payload.id, item.payload.updates, true);
                            }
                            break;
                        case 'DELETE_INVOICE':
                            result = await deleteInvoice(item.payload.id, true);
                            break;
                        case 'DELETE_STAT':
                            result = await deleteStatistic(item.payload.id, true);
                            break;
                    }

                    if (isConflict) {
                        removeFromQueue(item.id); 
                        conflictCount++;
                        addSyncLog({
                            itemId: item.id,
                            itemType: item.type,
                            message: 'تضاد با سرور: این رکورد در سرور تغییر کرده است. تغییرات آفلاین نادیده گرفته شد.',
                            timestamp: Date.now()
                        });
                    } else if (result.success) {
                        removeFromQueue(item.id);
                        successCount++;
                    } else {
                        // Operation Failed (Logic Error or Server Error)
                        console.error(`[Sync] Failed item ${item.id}:`, result.error);
                        incrementRetry(item.id);
                        updateItemAttempt(item.id, Date.now());
                        addSyncLog({
                            itemId: item.id,
                            itemType: item.type,
                            message: result.error || 'خطای ناشناخته در همگام‌سازی',
                            timestamp: Date.now()
                        });
                        failCount++;
                    }
                } catch (itemErr: any) {
                    // Exception processing item
                    console.error(`[Sync] Exception processing ${item.id}:`, itemErr);
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

            if (successCount > 0) {
                addToast(`${successCount} مورد با موفقیت همگام‌سازی شد.`, 'success');
            }
            if (conflictCount > 0) {
                addToast(`${conflictCount} مورد به دلیل تضاد با سرور حذف شد.`, 'warning');
            }

        } catch (e) {
            console.error('[Sync] Critical Loop Error:', e);
        } finally {
            // CRITICAL: Always reset flags even if the loop crashes
            setIsProcessing(false);
            processingRef.current = false;
        }
    };

    return { isSyncing: isProcessing, processQueue };
};
