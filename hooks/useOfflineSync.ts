
import { useEffect, useState, useRef } from 'react';
import { useSyncStore, SyncItem } from '../store/syncStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useStatisticsStore } from '../store/statisticsStore';
import { useToastStore } from '../store/toastStore';
import { supabase } from '../lib/supabase';

export const useOfflineSync = () => {
    const { queue, removeFromQueue } = useSyncStore();
    const { bulkAddInvoices, updateInvoice, deleteInvoice } = useInvoiceStore();
    const { bulkUpsertStatistics, updateStatistic, deleteStatistic } = useStatisticsStore();
    const { addToast } = useToastStore();
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Prevent double execution in React Strict Mode
    const processingRef = useRef(false);

    useEffect(() => {
        const handleOnline = () => {
            console.log('[Sync] Network connected. Processing queue...');
            processQueue();
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
            // If server was updated AFTER our offline action, we skip our stale update
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

    const processQueue = async () => {
        if (isSyncing || processingRef.current || queue.length === 0) return;
        
        setIsSyncing(true);
        processingRef.current = true;

        const queueSnapshot = [...queue]; // Snapshot to avoid index shifting issues
        let successCount = 0;
        let conflictCount = 0;

        addToast(`شروع همگام‌سازی ${queueSnapshot.length} آیتم آفلاین...`, 'info');

        // --- STEP 1: BATCH PROCESSING FOR CREATES ---
        
        // 1.1 Process Stats (Batch Upsert)
        const statsItems = queueSnapshot.filter(i => i.type === 'STAT');
        if (statsItems.length > 0) {
            const payloads = statsItems.map(i => i.payload);
            const res = await bulkUpsertStatistics(payloads, true);
            if (res.success) {
                statsItems.forEach(i => removeFromQueue(i.id));
                successCount += statsItems.length;
            } else {
                console.error('[Sync] Bulk Stat Failed:', res.error);
            }
        }

        // 1.2 Process Invoices (Batch Insert)
        const invoiceItems = queueSnapshot.filter(i => i.type === 'INVOICE');
        if (invoiceItems.length > 0) {
            const payloads = invoiceItems.map(i => i.payload);
            const res = await bulkAddInvoices(payloads, true);
            if (res.success) {
                invoiceItems.forEach(i => removeFromQueue(i.id));
                successCount += invoiceItems.length;
            } else {
                console.error('[Sync] Bulk Invoice Failed:', res.error);
            }
        }

        // --- STEP 2: SEQUENTIAL PROCESSING FOR UPDATES/DELETES (With Conflict Resolution) ---
        
        const otherItems = queueSnapshot.filter(i => !['STAT', 'INVOICE'].includes(i.type));
        
        for (const item of otherItems) {
            // Explicitly type result to allow optional error string
            let result: { success: boolean; error?: string } = { success: false };
            let isConflict = false;

            try {
                switch (item.type) {
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
                        // Deletes usually force through unless already deleted
                        result = await deleteInvoice(item.payload.id, true);
                        break;
                    case 'DELETE_STAT':
                        result = await deleteStatistic(item.payload.id, true);
                        break;
                }

                if (isConflict) {
                    removeFromQueue(item.id); // Remove conflicting item to unblock queue
                    conflictCount++;
                } else if (result.success) {
                    removeFromQueue(item.id);
                    successCount++;
                } else {
                    console.error(`[Sync] Failed item ${item.id}:`, result.error);
                    // Keep in queue for retry? Or limit retries?
                    // Currently keeping in queue indefinitely until next sync attempt
                }
            } catch (e) {
                console.error(`[Sync] Exception processing ${item.id}:`, e);
            }
        }

        setIsSyncing(false);
        processingRef.current = false;

        if (successCount > 0) {
            addToast(`همگام‌سازی ${successCount} مورد با موفقیت انجام شد.`, 'success');
        }
        if (conflictCount > 0) {
            addToast(`${conflictCount} مورد به دلیل تضاد با سرور نادیده گرفته شد.`, 'warning');
        }
    };

    return { isSyncing, pendingCount: queue.length };
};
