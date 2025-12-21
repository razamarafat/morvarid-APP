
import React, { useState, useEffect } from 'react';
import { useLogStore } from '../../store/logStore';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { toPersianDigits } from '../../utils/dateUtils';

const SystemLogs: React.FC = () => {
  const { logs, fetchLogs, logAction, isLoading } = useLogStore();
  const { users, fetchUsers } = useUserStore();
  const { addToast } = useToastStore();
  
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [viewDetails, setViewDetails] = useState<any | null>(null);

  // Initial Fetch
  useEffect(() => {
      fetchUsers();
      fetchLogs({ userId: selectedUser });
  }, []);

  // AUTO-REFRESH System: Every 15 Seconds
  useEffect(() => {
      const interval = setInterval(() => {
          fetchLogs({ userId: selectedUser });
      }, 15000);
      return () => clearInterval(interval);
  }, [selectedUser]);

  const handleRefresh = () => {
      fetchLogs({ userId: selectedUser });
      addToast('لاگ‌ها به‌روزرسانی شدند', 'info');
  };

  const handleManualTest = async () => {
      addToast('در حال ارسال لاگ تستی...', 'info');
      await logAction('info', 'user_action', 'تست دستی ثبت لاگ توسط مدیر (Manual Test)', { 
          test_time: new Date().toLocaleTimeString(),
          browser: navigator.userAgent 
      });
      setTimeout(() => {
          fetchLogs({ userId: 'all' });
          addToast('لاگ ارسال شد. لیست بروزرسانی گردید.', 'success');
      }, 1000);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full"><Icons.Check className="w-4 h-4" /></div>;
      case 'warn': return <div className="p-1.5 bg-amber-100 text-amber-600 rounded-full"><Icons.AlertCircle className="w-4 h-4" /></div>;
      case 'error': return <div className="p-1.5 bg-red-100 text-red-600 rounded-full"><Icons.X className="w-4 h-4" /></div>;
      default: return <Icons.FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
            <div className="bg-metro-red p-3 rounded-xl text-white shadow-lg">
                <Icons.AlertCircle className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-black dark:text-white">پایش فعالیت‌های زنده</h2>
                <p className="text-xs text-gray-500 font-bold mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    به‌روزرسانی خودکار هر ۱۵ ثانیه
                </p>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <Button onClick={handleManualTest} variant="secondary" size="sm">
                تست ثبت لاگ
            </Button>

            <div className="relative flex-1 md:flex-none md:w-56">
                <Icons.User className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                <select 
                    value={selectedUser} 
                    onChange={(e) => {
                        setSelectedUser(e.target.value);
                        fetchLogs({ userId: e.target.value });
                    }}
                    className="w-full pr-9 pl-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold outline-none transition-all focus:border-metro-purple"
                >
                    <option value="all">همه کاربران</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                </select>
            </div>
            
            <Button onClick={handleRefresh} variant="ghost" size="icon" isLoading={isLoading}>
                <Icons.Refresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border overflow-hidden min-h-[500px] flex flex-col relative">
        {isLoading && logs.length === 0 && (
            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-metro-purple border-t-transparent rounded-full"></div>
            </div>
        )}

        {logs.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 opacity-40">
            <Icons.FileText className="w-20 h-20 mb-4 text-gray-300" />
            <p className="font-bold text-lg text-gray-500">داده‌ای برای نمایش وجود ندارد.</p>
            <p className="text-xs text-gray-400 mt-2">روی دکمه "تست ثبت لاگ" کلیک کنید تا از اتصال دیتابیس مطمئن شوید.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {logs.map((log) => (
              <div 
                key={log.id} 
                onClick={() => setViewDetails(log)}
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                    {getLevelIcon(log.level)}
                    <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm text-gray-800 dark:text-gray-200 truncate">{log.message}</span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            <span className="font-bold bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-metro-purple">{log.category.toUpperCase()}</span>
                            <span className="flex items-center gap-1 font-bold"><Icons.User className="w-2.5 h-2.5" />{log.user_full_name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 pl-2">
                    <span className="font-mono text-[10px] font-bold text-gray-400 group-hover:text-metro-purple dir-ltr">
                        {toPersianDigits(new Date(log.timestamp).toLocaleTimeString('fa-IR'))}
                    </span>
                    <Icons.ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-metro-purple transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal 
        isOpen={!!viewDetails} 
        onClose={() => setViewDetails(null)} 
        title="مشخصات فنی و رهگیری اقدام"
      >
          {viewDetails && (
              <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b pb-4">
                      {getLevelIcon(viewDetails.level)}
                      <div>
                          <h3 className="font-black text-lg">{viewDetails.message}</h3>
                          <p className="text-xs text-gray-500 font-bold">توسط: {viewDetails.user_full_name} در تاریخ {new Date(viewDetails.timestamp).toLocaleString('fa-IR')}</p>
                      </div>
                  </div>

                  <div className="bg-gray-900 text-green-400 p-5 rounded-xl font-mono text-xs dir-ltr overflow-x-auto max-h-[400px] shadow-inner border-2 border-green-900/50">
                      <div className="mb-2 text-white font-bold border-b border-gray-700 pb-1">// TECHNICAL PAYLOAD</div>
                      <pre>{JSON.stringify(viewDetails.details, null, 2)}</pre>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                      <Button onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(viewDetails.details, null, 2));
                          addToast('اطلاعات فنی کپی شد', 'success');
                      }} variant="secondary" size="sm">کپی جزییات</Button>
                      <Button onClick={() => setViewDetails(null)}>بستن</Button>
                  </div>
              </div>
          )}
      </Modal>
    </div>
  );
};

export default SystemLogs;
