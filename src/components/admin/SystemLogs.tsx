
// ═════════════════════════════════════════════════════
// FILE: src/components/admin/SystemLogs.tsx
// DESCRIPTION: Main page for system logs
// ═════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useLogStore } from '../../store/logStore';
import { LogFilter } from './logs/LogFilter';
import { LogTable } from './logs/LogTable';
import { LogTestButton } from './logs/LogTestButton';
import { Icons } from '../common/Icons';

const SystemLogs: React.FC = () => {
  const { logs, fetchLogs, isLoading, setFilter, filter, subscribeToLogs } = useLogStore();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Initial Load & Realtime
  useEffect(() => {
    fetchLogs();
    const unsubscribe = subscribeToLogs();
    return () => unsubscribe();
  }, []);

  // Filter Effect
  useEffect(() => {
    // In a real app, we would pass filter params to fetchLogs
    // For now, we fetch latest and the store/selector handles it, or we rely on client-side filtering if small
    // But per LogStore implementation, fetchLogs gets 100 latest.
    // For this implementation, we will just refetch.
    fetchLogs();
  }, [filter]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(), 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Client-side filtering for display (since API is simple latest 100)
  const filteredLogs = logs.filter(log => {
      if (filter.levels.length > 0 && !filter.levels.includes(log.level)) return false;
      if (filter.categories.length > 0 && !filter.categories.includes(log.category)) return false;
      if (filter.searchTerm) {
          const term = filter.searchTerm.toLowerCase();
          return log.messageFa.toLowerCase().includes(term) || 
                 log.messageEn.toLowerCase().includes(term) ||
                 (log.userFullName || '').toLowerCase().includes(term);
      }
      return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-metro-purple/10 text-metro-purple rounded-xl">
                <Icons.HardDrive className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-black dark:text-white">مانیتورینگ و لاگ‌های سیستم</h2>
                <p className="text-xs text-gray-500 font-bold mt-1">نسخه ۳.۰ • معماری NEXUS • Real-time</p>
            </div>
        </div>
        
        <div className="flex gap-2">
            <LogTestButton />
            <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
            >
                {autoRefresh ? 'بروزرسانی خودکار: فعال' : 'بروزرسانی خودکار: متوقف'}
            </button>
        </div>
      </div>

      <LogFilter 
        filter={filter} 
        onChange={setFilter} 
        onRefresh={fetchLogs} 
      />

      <LogTable 
        logs={filteredLogs} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default SystemLogs;
