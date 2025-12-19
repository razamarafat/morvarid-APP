
import React, { useState } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { Farm, FarmType } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import FarmFormModal from './FarmFormModal';
import { useConfirm } from '../../hooks/useConfirm';

const FarmManagement: React.FC = () => {
  const { farms, deleteFarm } = useFarmStore();
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">لیست فارم‌ها</h2>
        <Button onClick={handleAdd}>
          <Icons.Plus className="ml-2 h-4 w-4" />
          ایجاد فارم جدید
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">نام فارم</th>
              <th scope="col" className="px-6 py-3">نوع</th>
              <th scope="col" className="px-6 py-3">وضعیت</th>
              <th scope="col" className="px-6 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {farms.map((farm) => (
              <tr key={farm.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                  {farm.name}
                </th>
                <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${farm.type === FarmType.MORVARIDI ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                        {farm.type === FarmType.MORVARIDI ? 'مرواریدی' : 'متفرقه'}
                    </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${farm.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                    {farm.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td className="px-6 py-4 flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(farm)}>
                    <Icons.Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(farm)}>
                    <Icons.Trash className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
