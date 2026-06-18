
import React, { useState, useMemo, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { User, UserRole } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import UserFormModal from './UserFormModal';
import AdminResetPasswordModal from './AdminResetPasswordModal';
import { useConfirm } from '../../hooks/useConfirm';
import { matchesMultiField, SearchAccessor } from '../../utils/searchUtils';

const UserManagement: React.FC = () => {
  const { users, deleteUser, adminListVisiblePasswords } = useUserStore();
  const { user: currentUser } = useAuthStore();
  const { addToast } = useToastStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { confirm } = useConfirm();

  // 20260620 — Admin-visible password vault. Fetched via the SEC-DEF RPC
  // `admin_list_visible_passwords` on mount. If the current caller is NOT
  // an admin, the RPC throws FORBIDDEN and we fall back to an empty map
  // (the column is hidden anyway). `revealedSet` is per-row UI state that
  // does NOT touch the database — defaults reveal=false so passwords
  // render as bullet dots until the Admin clicks the Eye icon.
  const [passwordMap, setPasswordMap] = useState<Record<string, string>>({});
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);

  useEffect(() => {
    // Only fetch when the caller is admin \u2014 userStore.adminListVisiblePasswords
    // also gates this server-side (throws FORBIDDEN on non-admin), so the
    // client-side role check is just a UX optim + a no-op-skip for non-admins.
    if (currentUser?.role === UserRole.ADMIN) {
      adminListVisiblePasswords().then(map => setPasswordMap(map));
    }
  }, [currentUser, users, adminListVisiblePasswords]);

  const toggleReveal = (userId: string) => {
    setRevealedSet(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCopyPassword = async (password: string, username: string) => {
    try {
      await navigator.clipboard.writeText(password);
      addToast(`رمز عبور ${username} کپی شد`, 'success');
    } catch (_) {
      addToast('کپی در حافظه ناموفق بود', 'error');
    }
  };

  // 20260619 — Multi-field fuzzy search across every visible column.
  // Both the English role enum AND the Persian display label are indexed
  // so typing "مدیر" or "ADMIN" both match all admins.
  const userAccessors: SearchAccessor<User>[] = useMemo(() => [
    u => u.fullName,
    u => u.username,
    u => u.phoneNumber,
    u => u.role,
    u => u.role === UserRole.ADMIN ? 'مدیر' : u.role === UserRole.REGISTRATION ? 'مسئول ثبت' : u.role === UserRole.SALES ? 'مسئول فروش' : '',
    u => u.isActive ? 'فعال' : 'غیرفعال',
  ], []);

  const filteredUsers = useMemo(
    () => users.filter(u => matchesMultiField(u, userAccessors, searchTerm)),
    [users, searchTerm]
  );

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
      addToast('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.', 'warning');
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
    switch (role) {
      case UserRole.ADMIN: return <span className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">مدیر</span>;
      case UserRole.REGISTRATION: return <span className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800">مسئول ثبت</span>;
      case UserRole.SALES: return <span className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">مسئول فروش</span>;
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

      {/* 20260619 — Universal instant search across user rows */}
      <div className="mb-4">
        <div className="relative">
          <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="جستجوی کاربر (نام، نام کاربری، نقش، شماره تماس...)"
            className="w-full h-12 pr-10 pl-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white text-sm font-bold focus:outline-none focus:border-metro-blue"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-allow-latin="true"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-[24px] overflow-hidden border border-gray-200 dark:border-gray-700 w-full relative">
        <div className="overflow-x-auto max-w-full custom-scrollbar relative">
          <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400 min-w-[700px]">
            <thead className="text-xs lg:text-base text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 font-bold">
              <tr>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">نام کامل</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">نام کاربری</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">نقش</th>
                {/* 20260620 — Plain-text password column. Hidden
                    client-side for non-admin callers via the conditional
                    render below (server-side RLS + SEC-DEF RPC ensure
                    that the data itself is unreachable for non-admins). */}
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">رمز عبور</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">وضعیت</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap text-center">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  <th scope="row" className="px-6 py-5 lg:py-7 font-black text-gray-900 whitespace-nowrap dark:text-white lg:text-lg">
                    {user.fullName}
                  </th>
                  <td className="px-6 py-5 lg:py-7 font-mono lg:text-lg font-bold tracking-wide">{user.username}</td>
                  <td className="px-6 py-5 lg:py-7 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                  {/* 20260620 — Password cell (admin only). Renders bullet
                      asterisks by default. Admins can click the Eye icon
                      to reveal; Copy icon copies the plaintext to the
                      clipboard. Empty state shown for users whose vault
                      entry is missing (e.g. legacy users predating the
                      20260620 migration). */}
                  <td className="px-3 py-5 lg:py-7 whitespace-nowrap">
                    {currentUser?.role === UserRole.ADMIN ? (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const storedPwd = passwordMap[user.id];
                          const isRevealed = revealedSet.has(user.id);
                          if (!storedPwd) {
                            return <span className="text-xs text-gray-400 font-mono select-none">—</span>;
                          }
                          return (
                            <>
                              <span
                                dir="ltr"
                                className={`font-mono text-sm font-bold select-all ${isRevealed ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}
                                style={{ letterSpacing: isRevealed ? '0' : '0.1em' }}
                              >
                                {isRevealed ? storedPwd : '••••••••'}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleReveal(user.id)}
                                title={isRevealed ? 'پنهان‌سازی' : 'نمایش'}
                                className="lg:w-9 lg:h-9 w-7 h-7 rounded-full text-gray-500 hover:text-blue-600"
                              >
                                {isRevealed ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                              </Button>
                              {isRevealed && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleCopyPassword(storedPwd, user.username)}
                                  title="کپی"
                                  className="lg:w-9 lg:h-9 w-7 h-7 rounded-full text-gray-500 hover:text-green-600"
                                >
                                  <Icons.FileText className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setResetTargetUser(user)}
                                title="بازنشانی رمز عبور"
                                className="lg:w-9 lg:h-9 w-7 h-7 rounded-full text-gray-500 hover:text-violet-600"
                              >
                                <Icons.Refresh className="w-4 h-4" />
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-mono select-none">••••••</span>
                    )}
                  </td>
                  <td className="px-6 py-5 lg:py-7 whitespace-nowrap">
                    <span className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold ${user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {user.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-6 py-5 lg:py-7 flex items-center justify-center gap-3">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(user)} title="ویرایش" className="lg:w-10 lg:h-10 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600">
                      <Icons.Edit className="w-4 h-4 lg:w-6 lg:h-6" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 lg:w-10 lg:h-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(user)} title="حذف">
                      <Icons.Trash className="w-4 h-4 lg:w-6 lg:h-6" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={editingUser}
      />

      {/* 20260620 — Admin password-reset modal. Triggered by the
          Refresh icon in the password cell. Calls the
          reset-user-password Edge Function which writes to BOTH
          auth.users (via auth.admin.updateUserById on service_role)
          and visible_password (via SEC-DEF RPC). After a successful
          reset the passwordMap is re-fetched so the new value shows
          up in the table without a manual page refresh. */}
      <AdminResetPasswordModal
        isOpen={!!resetTargetUser}
        targetUser={resetTargetUser}
        onClose={() => setResetTargetUser(null)}
        onSuccess={async () => {
          // Re-fetch vault so the freshly reset password is shown.
          const map = await adminListVisiblePasswords();
          setPasswordMap(map);
          setResetTargetUser(null);
        }}
      />
    </div>
  );
};

export default UserManagement;
