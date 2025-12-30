
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useStatisticsStore } from '../store/statisticsStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useAlertStore } from '../store/alertStore';
import { useToastStore } from '../store/toastStore';
import { UserRole } from '../types';

const CHECK_INTERVAL = 60 * 1000; // Check every minute
const EDIT_WINDOW_MS = 18000000; // 5 Hours
const ALERT_THRESHOLD_START = 14400000; // 4 Hours (1 hour remaining)
const ALERT_THRESHOLD_END = 15000000; // 4 Hours 10 Mins (Window to trigger alert)

export const useExpirationAlert = () => {
    const { user } = useAuthStore();
    const { statistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { sendLocalNotification } = useAlertStore();
    const { addToast } = useToastStore();
    
    // Store IDs that have already triggered an alert to avoid spam
    const alertedIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!user || user.role === UserRole.ADMIN) return;

        const checkExpiration = () => {
            const now = Date.now();
            const relevantStats = statistics.filter(s => s.createdBy === user.id);
            const relevantInvoices = invoices.filter(i => i.createdBy === user.id);

            const allRecords = [
                ...relevantStats.map(s => ({ id: s.id, type: 'آمار', createdAt: s.createdAt })),
                ...relevantInvoices.map(i => ({ id: i.id, type: 'حواله', createdAt: i.createdAt }))
            ];

            for (const record of allRecords) {
                const elapsed = now - record.createdAt;
                
                // If elapsed time is between 4h and 4h10m (approx 1 hour remaining)
                // We use a range to ensure we catch it but don't spam if page reloads
                if (elapsed >= ALERT_THRESHOLD_START && elapsed <= ALERT_THRESHOLD_END) {
                    if (!alertedIds.current.has(record.id)) {
                        alertedIds.current.add(record.id);
                        
                        const msg = `کاربر گرامی، فقط یک ساعت تا پایان زمان مجاز ویرایش ${record.type} باقی مانده است.`;
                        
                        addToast(msg, 'warning');
                        sendLocalNotification('هشدار انقضای ویرایش', msg, 'expiration-alert');
                    }
                }
            }
        };

        const interval = setInterval(checkExpiration, CHECK_INTERVAL);
        checkExpiration(); // Initial check

        return () => clearInterval(interval);
    }, [user, statistics, invoices]);
};
