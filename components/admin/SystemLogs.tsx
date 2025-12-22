
import React, { useState, useEffect } from 'react';
import { useLogStore } from '../../store/logStore.ts';
import { Icons } from '../common/Icons.tsx';
import Button from '../common/Button.tsx';
import { toPersianDigits } from '../../utils/dateUtils.ts';

const SystemLogs: React.FC = () => {
  const { logs, clearLogs } = useLogStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'SUCCESS': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'ERROR': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'WARNING': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20';
      default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 shadow-sm border-b-2 border-metro-blue">
        <div className="flex items-center gap-3">
          <Icons.HardDrive className="text-metro-blue w-6 h-6" />
          <h2 className="text-lg font-black dark:text-white">کنسول نظارت لایو (Admin Context)</h2>
        </div>
        <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-red-500 font-bold" onClick={clearLogs}>پاکسازی نشست</Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-xl overflow-hidden min-h-[500px] border border-gray-200 dark:border-gray-700">
        {logs.length === 0 ? (
          <div className="p-24 text-center text-gray-400">
            <Icons.FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="font-bold">تراکنشی در نشست فعلی ثبت نشده است.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {logs.map((log) => (
              <div key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                <div 
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className={`text-[10px] font-black px-2 py-1 uppercase rounded tracking-tighter ${getLevelStyle(log.level)}`}>
                      {log.level}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{log.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400 font-black uppercase">{log.category}</span>
                        <span className="text-[10px] text-gray-400 font-mono tracking-tighter">{toPersianDigits(new Date(log.timestamp).toLocaleTimeString('fa-IR'))}</span>
                      </div>
                    </div>
                  </div>
                  <Icons.ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`} />
                </div>

                {expandedId === log.id && (
                  <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-1">
                    <div className="flex justify-between items-center mb-2">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase">Technical Payload (JSON)</h5>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {log.id}</span>
                    </div>
                    <pre className="text-[11px] font-mono bg-gray-900 text-green-400 p-4 overflow-x-auto dir-ltr text-left shadow-inner border border-white/5">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-[10px] text-gray-500 text-center font-bold">
          تمامی داده‌ها در حافظه محلی (Secure Sandbox) ذخیره می‌شوند و با خروج از حساب پاک نمی‌شوند مگر به صورت دستی.
      </div>
    </div>
  );
};

export default SystemLogs;
