
import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { User, UserRole } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import UserFormModal from './UserFormModal';
import { useConfirm } from '../../hooks/useConfirm';

const UserManagement: React.FC = () => {
  const { users, deleteUser } = useUserStore();
  const { user: currentUser } = useAuthStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { confirm } = useConfirm();

  const handleAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (userToDelete: User) => {
    // Prevent self-deletion
    if (currentUser?.id === userToDelete.id) {
        alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.');
        return;
    }

    const confirmed = await confirm({
      title: `حذف کاربر ${userToDelete.fullName}`,
      message: 'آیا از حذف این کاربر اطمینان دارید؟',
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
          case UserRole.ADMIN: return <span className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">مدیر</span>;
          case UserRole.REGISTRATION: return <span className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">مسئول ثبت</span>;
          case UserRole.SALES: return <span className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">مسئول فروش</span>;
      }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 lg:mb-8">
        <h2 className="text-2xl lg:text-3xl font-bold dark:text-white">مدیریت کاربران</h2>
        <Button onClick={handleAdd} className="lg:h-12 lg:text-lg lg:px-8">
          <Icons.Plus className="ml-2 h-4 w-4 lg:h-6 lg:w-6" />
          ایجاد کاربر جدید
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs lg:text-base text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 font-bold">
            <tr>
              <th scope="col" className="px-6 py-3 lg:py-5 whitespace-nowrap">نام کامل</th>
              <th scope="col" className="px-6 py-3 lg:py-5 whitespace-nowrap">نام کاربری</th>
              <th scope="col" className="px-6 py-3 lg:py-5 whitespace-nowrap">نقش</th>
              <th scope="col" className="px-6 py-3 lg:py-5 whitespace-nowrap">وضعیت</th>
              <th scope="col" className="px-6 py-3 lg:py-5 whitespace-nowrap text-center">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <th scope="row" className="px-6 py-4 lg:py-6 font-bold text-gray-900 whitespace-nowrap dark:text-white lg:text-lg">
                  {user.fullName}
                </th>
                <td className="px-6 py-4 lg:py-6 font-mono lg:text-lg">{user.username}</td>
                <td className="px-6 py-4 lg:py-6 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                <td className="px-6 py-4 lg:py-6 whitespace-nowrap">
                  <span className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold ${user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                    {user.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td className="px-6 py-4 lg:py-6 flex items-center justify-center gap-3">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(user)} title="ویرایش" className="lg:w-10 lg:h-10">
                    <Icons.Edit className="w-4 h-4 lg:w-6 lg:h-6" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 lg:w-10 lg:h-10" onClick={() => handleDelete(user)} title="حذف">
                    <Icons.Trash className="w-4 h-4 lg:w-6 lg:h-6" />
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
    </div>
  );
};

export default UserManagement;
