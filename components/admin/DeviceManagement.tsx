
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { toPersianDigits } from '../../utils/dateUtils';
import { SkeletonRow } from '../common/Skeleton';
import { useToastStore } from '../../store/toastStore';
import { useConfirm } from '../../hooks/useConfirm';

interface DeviceSubscription {
    id: string;
    user_id: string;
    user_agent: string;
    created_at: string;
    profiles: {
        full_name: string;
        username: string;
        role: string;
    };
}

const DeviceManagement: React.FC = () => {
    const [devices, setDevices] = useState<DeviceSubscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();

    const fetchDevices = async () => {
        setIsLoading(true);
        // Join with profiles to get user names
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select(`
                id,
                user_id,
                user_agent,
                created_at,
                profiles (full_name, username, role)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch Devices Error:', error);
            // If error is 404/relation does not exist, it means the user hasn't run the SQL yet.
            if (error.code === '42P01') {
                addToast('جدول اشتراک‌ها یافت نشد. لطفاً اسکریپت SQL را اجرا کنید.', 'error');
            }
        } else {
            setDevices(data as any || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchDevices();
    }, []);

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
                addToast('خطا در حذف دستگاه', 'error');
            } else {
                addToast('دستگاه با موفقیت حذف شد', 'success');
                fetchDevices();
            }
        }
    };

    const parseUserAgent = (ua: string) => {
        if (!ua) return 'نامشخص';
        if (ua.includes('Android')) return 'گوشی اندروید';
        if (ua.includes('iPhone')) return 'گوشی آیفون';
        if (ua.includes('Windows')) return 'کامپیوتر ویندوز';
        if (ua.includes('Macintosh')) return 'کامپیوتر مک';
        return 'دستگاه دیگر';
    };

    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'ADMIN': return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">مدیر</span>;
            case 'REGISTRATION': return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">ثبت</span>;
            case 'SALES': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">فروش</span>;
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

            <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs font-black uppercase">
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
                            ) : devices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400 font-bold">
                                        هیچ دستگاهی ثبت نشده است. (کاربران باید اجازه نوتیفیکیشن را در مرورگر بدهند)
                                    </td>
                                </tr>
                            ) : (
                                devices.map((dev) => (
                                    <tr key={dev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 dark:text-white">{dev.profiles?.full_name || 'ناشناس'}</div>
                                            <div className="text-xs text-gray-500">{dev.profiles?.username}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getRoleBadge(dev.profiles?.role)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {dev.user_agent.includes('Mobile') ? <Icons.User className="w-4 h-4 text-gray-400" /> : <Icons.HardDrive className="w-4 h-4 text-gray-400" />}
                                                <span className="text-sm font-medium dark:text-gray-300">{parseUserAgent(dev.user_agent)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-gray-500">
                                            {new Date(dev.created_at).toLocaleDateString('fa-IR')} - {new Date(dev.created_at).toLocaleTimeString('fa-IR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleDelete(dev.id, dev.profiles?.full_name)}
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
                <br/>
                برای ارسال پیام به این دستگاه‌ها در حالت بسته بودن برنامه، باید <code>Edge Function</code> در Supabase فعال باشد.
            </div>
        </div>
    );
};

export default DeviceManagement;
