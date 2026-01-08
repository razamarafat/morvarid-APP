import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';

export const useAdminActions = () => {
    const { addToast } = useToastStore();

    const hardDeleteFarm = async (farmId: string): Promise<boolean> => {
        try {
            const { error } = await supabase.rpc('admin_hard_delete_farm', { p_farm_id: farmId });

            if (error) {
                console.error('[Admin] Hard delete failed:', error);
                addToast(`خطا در حذف کامل فارم: ${error.message}`, 'error');
                return false;
            }

            addToast('فارم و تمامی اطلاعات وابسته با موفقیت حذف شدند.', 'success');
            return true;
        } catch (e: any) {
            console.error('[Admin] Hard delete exception:', e);
            addToast(`خطای سیستم: ${e.message}`, 'error');
            return false;
        }
    };

    return {
        hardDeleteFarm
    };
};
