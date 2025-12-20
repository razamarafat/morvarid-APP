
import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { useLogStore } from '../../store/logStore';
import { useAuthStore } from '../../store/authStore';
import { User, UserRole } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import UserFormModal from './UserFormModal';
import Modal from '../common/Modal';
import { useConfirm } from '../../hooks/useConfirm';

const UserManagement: React.FC = () => {
  const { users, deleteUser } = useUserStore();
  const { logs } = useLogStore();
  const { user: currentUser } = useAuthStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // History Modal State
  const [historyUser, setHistoryUser] = useState<User | null>(null);

  const { confirm } = useConfirm();

  const handleAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleHistory = (user: User) => {
      setHistoryUser(user);
  };

  const handleDelete = async (userToDelete: User) => {
    // Prevent self-deletion
    if (currentUser?.id === userToDelete.id) {
        alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.');
        return;
    }

    const confirmed = await confirm({
      title: `حذف کاربر ${userToDelete.fullName}`,
      message: 'آیا از حذف این کاربر اطمینان دارید؟ تمام لاگ‌ها و پروفایل کاربر حذف خواهند شد اما آمارهای ثبت شده باقی می‌مانند.',
      confirmText: 'بله، حذف کن',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (confirmed) {
      deleteUser(userToDelete.id);
    }
  };

  const getRoleBadge = (role: UserRole) => {
      switch(role) {
          case UserRole.ADMIN: return <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">مدیر</span>;
          case UserRole.REGISTRATION: return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">مسئول ثبت</span>;
          case UserRole.SALES: return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">مسئول فروش</span>;
      }
  };

  // Filter logs for the history modal (Last 50 logs for simplicity)
  const userLogs = historyUser ? logs.filter(l => l.userId === historyUser.id).slice(0, 50) : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">مدیریت کاربران</h2>
        <Button onClick={handleAdd}>
          <Icons.Plus className="ml-2 h-4 w-4" />
          ایجاد کاربر جدید
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">نام کامل</th>
              <th scope="col" className="px-6 py-3">نام کاربری</th>
              <th scope="col" className="px-6 py-3">نقش</th>
              <th scope="col" className="px-6 py-3">آخرین بازدید</th>
              <th scope="col" className="px-6 py-3">وضعیت</th>
              <th scope="col" className="px-6 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                  {user.fullName}
                </th>
                <td className="px-6 py-4 font-mono">{user.username}</td>
                <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                <td className="px-6 py-4 text-xs">{user.lastVisit || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                    {user.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td className="px-6 py-4 flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleHistory(user)} title="آخرین اقدامات (۲۴ ساعت)">
                    <Icons.FileText className="w-4 h-4 text-blue-500" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(user)} title="ویرایش">
                    <Icons.Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(user)} title="حذف">
                    <Icons.Trash className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
      />

      {/* History Modal */}
      <Modal 
        isOpen={!!historyUser} 
        onClose={() => setHistoryUser(null)} 
        title={`آخرین اقدامات: ${historyUser?.fullName}`}
      >
          <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
              {userLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                      <Icons.FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>هیچ فعالیتی در بازه اخیر ثبت نشده است.</p>
                  </div>
              ) : (
                  userLogs.map(log => (
                      <div key={log.id} className="text-sm border-b border-gray-100 dark:border-gray-700 pb-3 mb-2 last:border-0">
                          <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                              <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{log.timestamp}</span>
                              <span className={`uppercase font-bold text-[10px] px-1.5 py-0.5 rounded border ${
                                  log.category === 'auth' ? 'border-blue-200 text-blue-600' : 
                                  log.category === 'database' ? 'border-purple-200 text-purple-600' : 'border-gray-200 text-gray-500'
                              }`}>{log.category}</span>
                          </div>
                          <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{log.message}</p>
                      </div>
                  ))
              )}
          </div>
          <div className="mt-6 flex justify-end">
              <Button onClick={() => setHistoryUser(null)}>بستن</Button>
          </div>
      </Modal>
    </div>
  );
};

export default UserManagement;
