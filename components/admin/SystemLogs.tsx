
import React, { useState } from 'react';
import { useLogStore } from '../../store/logStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';

const SystemLogs: React.FC = () => {
  const { logs, clearLogs, fetchLogs } = useLogStore();
  const { addToast } = useToastStore();
  const { confirm } = useConfirm();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <Icons.Check className="w-4 h-4 text-blue-500" />;
      case 'warn': return <Icons.AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <Icons.X className="w-4 h-4 text-red-500" />;
      default: return <Icons.FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleRefresh = async () => {
      setIsRefreshing(true);
      await fetchLogs();
      setIsRefreshing(false);
      addToast('لیست لاگ‌ها بروزرسانی شد', 'info');
  };

  const handleCopyLogs = async () => {
    if (logs.length === 0) {
        addToast('لاگی برای کپی وجود ندارد', 'warning');
        return;
    }

    const logText = logs.map(log => {
        return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message} ${log.userId ? `(User: ${log.userId})` : ''}`;
    }).join('\n----------------------------------------\n');

    try {
        await navigator.clipboard.writeText(logText);
        addToast('لاگ‌ها در حافظه کپی شدند', 'success');
    } catch (err) {
        addToast('خطا در کپی لاگ‌ها', 'error');
    }
  };

  const handleClearLogs = async () => {
      const yes = await confirm({
          title: 'پاکسازی لاگ‌ها',
          message: 'آیا از پاک کردن تمام لاگ‌های محلی اطمینان دارید؟',
          type: 'danger',
          confirmText: 'پاکسازی'
      });
      
      if (yes) {
          clearLogs();
          addToast('لاگ‌های محلی پاک شدند', 'success');
      }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold dark:text-white">لاگ‌های تعاملات سیستم</h2>
        <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="ghost" size="sm" isLoading={isRefreshing}>
                <Icons.Refresh className={`w-4 h-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                بروزرسانی
            </Button>
            <Button onClick={handleCopyLogs} variant="secondary" size="sm">
                <Icons.FileText className="ml-2 h-4 w-4" />
                کپی
            </Button>
            <button onClick={handleClearLogs} className="text-sm text-red-500 hover:text-red-700 px-3 py-2 border border-red-200 rounded-md hover:bg-red-50 transition-colors">
                پاکسازی
            </button>
        </div>
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300 rounded-2xl p-4 font-mono text-sm h-[500px] overflow-y-auto shadow-inner custom-scrollbar border border-gray-200 dark:border-gray-700">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Icons.FileText className="w-16 h-16 mb-4" />
            <p className="font-bold">هیچ لاگی ثبت نشده است.</p>
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="border-b border-gray-200 dark:border-gray-800 py-3 flex flex-col md:flex-row gap-2 md:gap-4 items-start hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors px-2">
            <span className="text-gray-500 whitespace-nowrap text-[10px] select-none font-bold">{log.timestamp}</span>
            <div className="flex items-center gap-1 w-20 shrink-0">
                {getLevelIcon(log.level)}
                <span className={`uppercase font-black text-[10px] ${log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-yellow-600' : 'text-blue-600'}`}>
                {log.level}
                </span>
            </div>
            <span className="text-purple-600 dark:text-purple-400 w-24 text-[10px] font-black shrink-0">[{log.category}]</span>
            <span className="flex-1 text-xs leading-relaxed">{log.message.split('| METRICS:')[0]}</span>
            {log.userId && <span className="text-gray-400 text-[9px] whitespace-nowrap bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">ID: {log.userId.substring(0,8)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemLogs;
