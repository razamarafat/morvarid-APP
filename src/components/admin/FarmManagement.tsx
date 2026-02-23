
import React, { useState } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { Farm, FarmType } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import FarmFormModal from './FarmFormModal';
import { useConfirm } from '../../hooks/useConfirm';
import { useAdminActions } from '../../hooks/useAdminActions';

const FarmManagement: React.FC = () => {
  const { farms, deleteFarm } = useFarmStore();
  const { hardDeleteFarm } = useAdminActions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const { confirm } = useConfirm();

  const handleAdd = () => {
    setEditingFarm(null);
    setIsModalOpen(true);
  };

  const handleEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setIsModalOpen(true);
  };

  const handleDelete = async (farm: Farm) => {
    const confirmed = await confirm({
      title: `حذف فارم ${farm.name}`,
      message: 'آیا از حذف این فارم اطمینان دارید؟ این عملیات قابل بازگشت نیست.',
      confirmText: 'بله، حذف کن',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (confirmed) {
      deleteFarm(farm.id);
    }
  };

  const handleHardDelete = async (farm: Farm) => {
    const confirmed = await confirm({
      title: `حذف کامل ${farm.name}`,
      message: '⚠️ هشدار: این عملیات فارم و تمامی آمار، فاکتورها و سوابق آن را برای همیشه حذف می‌کند. آیا مطمئن هستید؟',
      confirmText: 'بله، حذف کامل',
      cancelText: 'لغو',
      type: 'danger',
    });

    if (confirmed) {
      await hardDeleteFarm(farm.id);
      // Refresh farms list logic is handled by store subscription usually, but we might need to manually trigger or just rely on global sync
      // Assuming useFarmStore subscription updates it, or we call fetchFarms
      // For now, let's rely on deleteFarm(id) locally to update UI immediately if needed, or better, just reload
      deleteFarm(farm.id);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 lg:mb-8">
        <h2 className="text-2xl lg:text-3xl font-bold dark:text-white">لیست فارم‌ها</h2>
        <Button onClick={handleAdd} className="lg:h-12 lg:text-lg lg:px-8">
          <Icons.Plus className="ml-2 h-4 w-4 lg:h-6 lg:w-6" />
          ایجاد فارم جدید
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-[24px] overflow-hidden border border-gray-200 dark:border-gray-700 w-full relative">
        <div className="overflow-x-auto max-w-full custom-scrollbar relative">
          <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400 min-w-[600px]">
            <thead className="text-xs lg:text-base text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 font-bold">
              <tr>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">نام فارم</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">نوع</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap">وضعیت</th>
                <th scope="col" className="px-6 py-4 lg:py-6 whitespace-nowrap text-center">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {farms.map((farm) => (
                <tr key={farm.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  <th scope="row" className="px-6 py-5 lg:py-7 font-black text-gray-900 whitespace-nowrap dark:text-white lg:text-lg">
                    {farm.name}
                  </th>
                  <td className="px-6 py-5 lg:py-7 whitespace-nowrap">
                    <span className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold ${farm.type === FarmType.MORVARIDI ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                      {farm.type === FarmType.MORVARIDI ? 'مرواریدی' : 'متفرقه'}
                    </span>
                  </td>
                  <td className="px-6 py-5 lg:py-7 whitespace-nowrap">
                    <span className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold ${farm.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {farm.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-6 py-5 lg:py-7 flex items-center justify-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(farm)} className="lg:w-12 lg:h-12 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600">
                      <Icons.Edit className="w-4 h-4 lg:w-6 lg:h-6" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 lg:w-12 lg:h-12 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(farm)}>
                      <Icons.Trash className="w-4 h-4 lg:w-6 lg:h-6" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-800 hover:text-red-900 lg:w-12 lg:h-12 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"
                      onClick={() => handleHardDelete(farm)}
                      title="حذف کامل (Hard Delete)"
                    >
                      <Icons.Trash className="w-4 h-4 lg:w-6 lg:h-6" strokeWidth={3} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FarmFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        farm={editingFarm}
      />
    </div>
  );
};

export default FarmManagement;
