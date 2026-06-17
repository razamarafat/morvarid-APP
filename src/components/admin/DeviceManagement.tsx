import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { toPersianDigits, formatJalali } from '../../utils/dateUtils';
import { SkeletonRow } from '../common/Skeleton';
import { useToastStore } from '../../store/toastStore';
import { useConfirm } from '../../hooks/useConfirm';
import { matchesMultiField, SearchAccessor } from '../../utils/searchUtils';

interface DeviceSubscription {
    id: string;
    user_id: string;
    user_agent: string;
    created_at: string;
    profiles?: Array<{
        full_name: string;
        username: string;
        role: string;
    }>;
}

const DeviceManagement: React.FC = () => {
    const [devices, setDevices] = useState<DeviceSubscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();

    const parseUserAgent = (ua: string) => {
        if (!ua) return 'نامشخص';
        if (ua.includes('Android')) return 'گوشی اندروید';
        if (ua.includes('iPhone')) return 'گوشی آیفون';
        if (ua.includes('Windows')) return 'کامپیوتر ویندوز';
        if (ua.includes('Macintosh')) return 'کامپیوتر مک';
        return 'دستگاه دیگر';
    };

    const fetchDevices = async () => {
        setIsLoading(true);
        // Join with profiles to get user names. FK: push_subscriptions.user_id -> profiles.id
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select(`
                id,
                user_id,
                user_agent,
                created_at,
                profiles!user_id (full_name, username, role)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch Devices Error:', error.message || error);

            if (error.code === '42P01') {
                addToast('جدول اشتراک‌ها (push_subscriptions) یافت نشد. لطفاً اسکریپت SQL را اجرا کنید.', 'error');
            } else if (error.code === 'PGRST200') {
                addToast('رابطه بین جداول یافت نشد. لطفاً Foreign Key را بررسی کنید.', 'error');
            } else {
                addToast(`خطا در دریافت لیست دستگاه‌ها: ${error.message}`, 'error');
            }
        } else {
            setDevices((data ?? []) as DeviceSubscription[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchDevices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 20260619 — Multi-field fuzzy search across device + nested-profile fields.
    // Accessors cover IDs (Latin), Persian device-type labels, user names, role enum
    // and Persian role label so the same row matches "گوشی", "مدیر", "ADMIN", "ali", etc.
    const deviceAccessors: SearchAccessor<DeviceSubscription>[] = useMemo(() => [
        d => d.id,
        d => d.user_id,
        d => d.user_agent,
        d => parseUserAgent(d.user_agent),
        d => d.profiles?.[0]?.full_name,
        d => d.profiles?.[0]?.username,
        d => d.profiles?.[0]?.role,
        d => d.profiles?.[0]?.role === 'ADMIN' ? 'مدیر' : d.profiles?.[0]?.role === 'REGISTRATION' ? 'ثبت' : d.profiles?.[0]?.role === 'SALES' ? 'فروش' : '',
        d => d.created_at,
        d => formatJalali(d.created_at),
        d => toPersianDigits(d.created_at),
    ], []);

    const filteredDevices = useMemo(
        () => devices.filter(d => matchesMultiField(d, deviceAccessors, searchTerm)),
        [devices, searchTerm]
    );

    const handleDelete = async (id: string, userName: string) => {
        const confirmed = await confirm({
            title: 'حذف دستگاه',
            message: `آیا از حذف دستگاه کاربر ${userName} اطمینان دارید؟`,
            confirmText: 'حذف',
            type: 'danger'
        });

        if (confirmed) {
            const { error } = await supabase.from('push_subscriptions').delete().eq('id', id);
            if (error) {
                addToast(`خطا در حذف دستگاه: ${error.message}`, 'error');
            } else {
                addToast('دستگاه با موفقیت حذف شد', 'success');
                fetchDevices();
            }
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            // 20260619 — Dark mode variants on the role pill so it stays
            // legible when the dashboard switches to dark theme.
            case 'ADMIN': return <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-xs px-2 py-0.5 rounded font-bold">مدیر</span>;
            case 'REGISTRATION': return <span className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 text-xs px-2 py-0.5 rounded font-bold">ثبت</span>;
            case 'SALES': return <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-2 py-0.5 rounded font-bold">فروش</span>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                    <Icons.Globe className="text-metro-blue" />
                    مدیریت دستگاه‌های متصل (Push)
                </h2>
                <Button onClick={fetchDevices} variant="secondary" size="sm">
                    <Icons.Refresh className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
                    بروزرسانی
                </Button>
            </div>

            {/* 20260619 — Instant multi-field search across device rows. */}
            <div className="mb-2">
                <div className="relative">
                    <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="جستجو (نام کاربر، نام کاربری، نوع دستگاه، نقش...)"
                        className="w-full h-12 pr-10 pl-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white text-sm font-bold focus:outline-none focus:border-metro-blue"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        data-allow-latin="true"
                    />
                </div>
                {searchTerm && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                        {filteredDevices.length} از {devices.length} دستگاه نمایش داده می‌شود
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 w-full relative">
                <div className="overflow-x-auto max-w-full custom-scrollbar relative">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs font-black uppercase">
                            <tr>
                                <th className="px-6 py-4">کاربر</th>
                                <th className="px-6 py-4">نقش</th>
                                <th className="px-6 py-4">نوع دستگاه</th>
                                <th className="px-6 py-4">تاریخ ثبت</th>
                                <th className="px-6 py-4 text-center">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {isLoading ? (
                                <>
                                    <tr><td colSpan={5} className="p-0"><SkeletonRow cols={5} /></td></tr>
                                    <tr><td colSpan={5} className="p-0"><SkeletonRow cols={5} /></td></tr>
                                    <tr><td colSpan={5} className="p-0"><SkeletonRow cols={5} /></td></tr>
                                </>
                            ) : filteredDevices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400 font-bold">
                                        {devices.length === 0
                                            ? 'هیچ دستگاهی ثبت نشده است. (کاربران باید اجازه نوتیفیکیشن را در مرورگر بدهند)'
                                            : 'هیچ دستگاهی با جستجوی فعلی مطابقت ندارد.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredDevices.map((dev) => (
                                    <tr key={dev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 dark:text-white">{dev.profiles?.[0]?.full_name || 'ناشناس'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{dev.profiles?.[0]?.username}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getRoleBadge(dev.profiles?.[0]?.role ?? '')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {dev.user_agent.includes('Mobile') ? <Icons.User className="w-4 h-4 text-gray-400" /> : <Icons.HardDrive className="w-4 h-4 text-gray-400" />}
                                                <span className="text-sm font-medium dark:text-gray-300">{parseUserAgent(dev.user_agent)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm font-medium text-gray-600 dark:text-gray-300">
                                            {toPersianDigits(formatJalali(dev.created_at))}
                                            <span className="mx-1 text-gray-400 dark:text-gray-500">•</span>
                                            <span className="text-gray-500 dark:text-gray-400">
                                                {new Date(dev.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleDelete(dev.id, dev.profiles?.[0]?.full_name ?? '')}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                title="حذف دستگاه"
                                            >
                                                <Icons.Trash className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800 leading-loose">
                <strong>نکته فنی:</strong> لیست بالا شامل دستگاه‌هایی است که اجازه دریافت نوتیفیکیشن را در مرورگر تایید کرده‌اند.
                <br />
                اگر خطای "relation does not exist" دریافت کردید، فایل <code>supabase_setup.sql</code> موجود در روت پروژه را در SQL Editor پنل Supabase اجرا کنید.
            </div>
        </div>
    );
};

export default DeviceManagement;
