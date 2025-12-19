
import React from 'react';
import { useLogStore } from '../../store/logStore';
import { Icons } from '../common/Icons';

const SystemLogs: React.FC = () => {
  const { logs, clearLogs } = useLogStore();

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <Icons.Check className="w-4 h-4 text-blue-500" />;
      case 'warn': return <Icons.AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <Icons.X className="w-4 h-4 text-red-500" />;
      default: return <Icons.FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">لاگ‌های سیستم</h2>
        <button onClick={clearLogs} className="text-sm text-red-500 hover:text-red-700">پاکسازی لاگ‌ها</button>
      </div>
      
      <div className="bg-gray-900 text-gray-300 rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto shadow-inner">
        {logs.length === 0 && <p className="text-gray-600 text-center py-10">هیچ لاگی ثبت نشده است.</p>}
        {logs.map((log) => (
          <div key={log.id} className="border-b border-gray-800 py-2 flex flex-wrap gap-2 md:gap-4 items-start hover:bg-gray-800/50 transition-colors">
            <span className="text-gray-500 whitespace-nowrap text-xs md:text-sm">{log.timestamp}</span>
            <div className="flex items-center gap-1 w-20">
                {getLevelIcon(log.level)}
                <span className={`uppercase font-bold text-xs ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-blue-400'}`}>
                {log.level}
                </span>
            </div>
            <span className="text-purple-400 w-24 text-xs">[{log.category}]</span>
            <span className="text-gray-200 flex-1">{log.message}</span>
            {log.userId && <span className="text-gray-600 text-xs">User: {log.userId}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemLogs;
