
import React, { useState, useEffect } from 'react';
import { useLogStore } from '../../store/logStore';
import { useUserStore } from '../../store/userStore';
import { LogLevel, LogCategory, LogEntry } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { getLevelColor, getLevelIconColor } from '../../utils/logUtils';
import { toPersianDigits } from '../../utils/dateUtils';

const SystemLogs: React.FC = () => {
  const { logs, fetchLogs, isLoading, info, success, warn, error } = useLogStore();
  const { users, fetchUsers } = useUserStore();
  
  // Filters
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [filterUser, setFilterUser] = useState<string>('ALL');
  
  // UI State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchLogs({ level: filterLevel, category: filterCategory, userId: filterUser });
  }, []);

  // Auto Refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
        fetchLogs({ level: filterLevel, category: filterCategory, userId: filterUser });
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, filterLevel, filterCategory, filterUser]);

  // Self Test Logic
  const runSelfTest = async () => {
    const timestamp = new Date().toLocaleTimeString();
    info('SYSTEM', `شروع تست خودکار سیستم لاگ...`, { step: 1 });
    await new Promise(r => setTimeout(r, 200));
    success('SYSTEM', `تست لاگ موفقیت آمیز`, { step: 2, status: 'OK' });
    await new Promise(r => setTimeout(r, 200));
    warn('SYSTEM', `تست لاگ هشدار آزمایشی`, { step: 3, memory_usage: 'Normal' });
    await new Promise(r => setTimeout(r, 200));
    error('SYSTEM', `تست لاگ خطای آزمایشی`, { step: 4, error: 'Simulated Error', stack: 'TestStack...' });
    
    fetchLogs(); // Force immediate refresh to show results
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('کپی شد!');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* --- HEADER & CONTROLS --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-metro-purple/10 text-metro-purple rounded-xl">
                    <Icons.HardDrive className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">مانیتورینگ و لاگ‌های سیستم</h2>
                    <p className="text-xs text-gray-500 font-bold mt-1">نسخه ۲.۰ • ذخیره‌سازی دوگانه • Real-time</p>
                </div>
            </div>
            
            <div className="flex gap-2">
                <Button onClick={runSelfTest} variant="secondary" size="sm">
                    <Icons.Refresh className="w-4 h-4 ml-2" />
                    تست سلامت سیستم
                </Button>
                <button 
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                    {autoRefresh ? 'بروزرسانی خودکار: فعال' : 'بروزرسانی خودکار: متوقف'}
                </button>
            </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select 
                value={filterLevel} 
                onChange={(e) => setFilterLevel(e.target.value as any)}
                className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold outline-none"
            >
                <option value="ALL">همه سطوح (Level)</option>
                <option value="INFO">INFO (اطلاعات)</option>
                <option value="SUCCESS">SUCCESS (موفق)</option>
                <option value="WARNING">WARNING (هشدار)</option>
                <option value="ERROR">ERROR (خطا)</option>
            </select>

            <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold outline-none"
            >
                <option value="ALL">همه دسته‌ها (Category)</option>
                <option value="SYSTEM">SYSTEM</option>
                <option value="USER">USER</option>
                <option value="DATABASE">DATABASE</option>
                <option value="NETWORK">NETWORK</option>
                <option value="UI">UI</option>
                <option value="AUTH">AUTH</option>
                <option value="SECURITY">SECURITY</option>
            </select>

            <select 
                value={filterUser} 
                onChange={(e) => setFilterUser(e.target.value)}
                className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold outline-none"
            >
                <option value="ALL">همه کاربران</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>

            <Button onClick={() => fetchLogs({ level: filterLevel, category: filterCategory, userId: filterUser })}>
                <Icons.Search className="w-4 h-4 ml-2" />
                اعمال فیلتر
            </Button>
        </div>
      </div>

      {/* --- LOG TABLE --- */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px] flex flex-col">
        {isLoading && logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-metro-purple border-t-transparent rounded-full"></div>
            </div>
        ) : logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Icons.FileText className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-bold">هیچ لاگی یافت نشد</p>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {logs.map((log) => (
                    <div key={log.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        {/* Summary Row */}
                        <div 
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="p-4 flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg ${getLevelIconColor(log.level)} bg-opacity-10`}>
                                    {log.level === 'SUCCESS' ? <Icons.Check className="w-5 h-5" /> : 
                                     log.level === 'ERROR' ? <Icons.X className="w-5 h-5" /> :
                                     log.level === 'WARNING' ? <Icons.AlertCircle className="w-5 h-5" /> :
                                     <Icons.FileText className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${getLevelColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                                            {log.category}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono dir-ltr">
                                            {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate dir-rtl text-right">
                                        {log.message}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 pl-2">
                                <div className="text-right hidden sm:block">
                                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1 justify-end">
                                        <Icons.User className="w-3 h-3" />
                                        {log.user_full_name}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dir-ltr">{new Date(log.timestamp).toLocaleDateString('fa-IR')}</div>
                                </div>
                                <Icons.ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {/* Details Row (Expandable) */}
                        {expandedLogId === log.id && (
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Technical Details (JSON)</span>
                                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(log); }} className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1">
                                        <Icons.FileText className="w-3 h-3" />
                                        کپی کامل
                                    </button>
                                </div>
                                <pre className="text-[10px] md:text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto dir-ltr text-left leading-relaxed">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                                <div className="mt-2 text-[10px] text-gray-400 font-mono">ID: {log.id} | Synced: {log.synced ? 'Yes' : 'Pending'}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;
