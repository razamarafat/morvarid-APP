
import React, { useState, useEffect } from 'react';
import { useLogStore } from '../../store/logStore';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { toPersianDigits } from '../../utils/dateUtils';

const SystemLogs: React.FC = () => {
  const { logs, fetchLogs, subscribeToLogs, isLoading } = useLogStore();
  const { users, fetchUsers } = useUserStore();
  const { addToast } = useToastStore();
  
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [viewDetails, setViewDetails] = useState<any | null>(null);

  useEffect(() => {
      fetchUsers();
      fetchLogs(); // Fetch initial data
      const unsubscribe = subscribeToLogs(); // Start Live Listener
      return () => {
          unsubscribe();
      };
  }, []);

  useEffect(() => {
      fetchLogs({ userId: selectedUser });
  }, [selectedUser]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full"><Icons.Check className="w-4 h-4" /></div>;
      case 'warn': return <div className="p-1.5 bg-amber-100 text-amber-600 rounded-full"><Icons.AlertCircle className="w-4 h-4" /></div>;
      case 'error': return <div className="p-1.5 bg-red-100 text-red-600 rounded-full"><Icons.X className="w-4 h-4" /></div>;
      case 'debug': return <div className="p-1.5 bg-gray-100 text-gray-600 rounded-full"><Icons.TestTube className="w-4 h-4" /></div>;
      default: return <Icons.FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (isoString: string) => {
      return new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
            <div className="bg-metro-red p-3 rounded-xl text-white shadow-lg shadow-red-200 dark:shadow-none">
                <Icons.AlertCircle className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-black dark:text-white">لاگ‌های سیستمی (زنده)</h2>
                <p className="text-xs text-gray-500 font-bold mt-1">پایش لحظه‌ای عملکرد کاربران و خطاها</p>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none md:w-64">
                <Icons.User className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                <select 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full pr-9 pl-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold focus:ring-2 focus:ring-metro-purple outline-none transition-all"
                >
                    <option value="all">همه کاربران</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                </select>
            </div>
            
            <Button onClick={() => fetchLogs({ userId: selectedUser })} variant="ghost" size="icon" isLoading={isLoading}>
                <Icons.Refresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </div>
      
      {/* Logs List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[500px] flex flex-col">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 opacity-40">
            <Icons.FileText className="w-20 h-20 mb-4 text-gray-300" />
            <p className="font-bold text-lg text-gray-500">هیچ لاگی در ۲۴ ساعت گذشته ثبت نشده است.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {logs.map((log) => (
              <div 
                key={log.id} 
                onClick={() => setViewDetails(log)}
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                    {getLevelIcon(log.level)}
                    
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-800 dark:text-gray-200 truncate">{log.message}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-500 font-mono">
                                {log.category.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <Icons.User className="w-3 h-3" />
                            <span>{log.user_full_name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 pl-2">
                    <span className="font-mono text-xs font-bold text-gray-400 group-hover:text-metro-purple transition-colors dir-ltr">
                        {toPersianDigits(formatTime(log.timestamp))}
                    </span>
                    <Icons.ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-metro-purple -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Modal 
        isOpen={!!viewDetails} 
        onClose={() => setViewDetails(null)} 
        title="جزئیات فنی لاگ"
      >
          {viewDetails && (
              <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                      {getLevelIcon(viewDetails.level)}
                      <div>
                          <h3 className="font-black text-lg">{viewDetails.message}</h3>
                          <p className="text-sm text-gray-500">{viewDetails.user_full_name} | {new Date(viewDetails.timestamp).toLocaleString('fa-IR')}</p>
                      </div>
                  </div>

                  <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs dir-ltr overflow-x-auto max-h-[400px] shadow-inner">
                      <pre>{JSON.stringify(viewDetails.details, null, 2)}</pre>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                      <Button onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(viewDetails, null, 2));
                          addToast('کپی شد', 'success');
                      }} variant="secondary" size="sm">
                          <Icons.FileText className="ml-2 w-4 h-4" />
                          کپی JSON
                      </Button>
                      <Button onClick={() => setViewDetails(null)}>بستن</Button>
                  </div>
              </div>
          )}
      </Modal>
    </div>
  );
};

export default SystemLogs;
