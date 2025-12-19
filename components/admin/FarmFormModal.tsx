
import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Farm, FarmType } from '../../types';
import { useFarmStore } from '../../store/farmStore';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';

const farmSchema = z.object({
  name: z.string().min(1, 'نام فارم الزامی است'),
  type: z.nativeEnum(FarmType, { errorMap: () => ({ message: 'نوع فارم الزامی است' }) }),
  isActive: z.boolean(),
  productIds: z.array(z.string()).min(1, 'حداقل یک محصول باید انتخاب شود'),
});

type FarmFormValues = z.infer<typeof farmSchema>;

interface FarmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  farm: Farm | null;
}

const FarmFormModal: React.FC<FarmFormModalProps> = ({ isOpen, onClose, farm }) => {
  const { addFarm, updateFarm, products: allProducts, addProduct } = useFarmStore();
  const { confirm } = useConfirm();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      isActive: true,
      productIds: []
    }
  });

  const selectedType = watch('type');

  // Defined IDs for Motefereghe defaults
  const MOTEFEREGHE_DEFAULT_IDS = ['1', '2']; 

  useEffect(() => {
    if (isOpen) {
      setIsAddingProduct(false);
      if (farm) {
        reset(farm);
      } else {
        reset({
          name: '',
          type: undefined,
          isActive: true,
          productIds: [],
        });
      }
    }
  }, [farm, isOpen, reset]);

  // Strict logic for Farm Type selection
  useEffect(() => {
    if (selectedType === FarmType.MOTEFEREGHE) {
       // Auto select simple and printi, disable others
       setValue('productIds', MOTEFEREGHE_DEFAULT_IDS);
    } else if (selectedType === FarmType.MORVARIDI && !farm) {
       // Reset if switching to Morvaridi on new form
       setValue('productIds', []);
    }
  }, [selectedType, farm, setValue]);

  const handleSaveProduct = () => {
    if (newProductName.trim()) {
      const newProduct = addProduct({ 
        name: newProductName, 
        unit: 'CARTON' as any, 
        hasKilogramUnit: false 
      });
      const currentIds = watch('productIds') || [];
      setValue('productIds', [...currentIds, newProduct.id]);
      setNewProductName('');
      setIsAddingProduct(false);
    }
  };

  const onSubmit = async (data: FarmFormValues) => {
    const confirmed = await confirm({
        title: farm ? 'ویرایش فارم' : 'ایجاد فارم',
        message: 'آیا از ذخیره تغییرات اطمینان دارید؟',
        confirmText: 'بله، ذخیره شود',
        type: 'info'
    });
    
    if (confirmed) {
        if (farm) {
          updateFarm({ ...data, id: farm.id });
        } else {
          addFarm(data);
        }
        onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={farm ? 'ویرایش فارم' : 'ایجاد فارم جدید'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="farmName" className="block text-sm font-medium mb-1 dark:text-gray-300">نام فارم</label>
          <input 
            id="farmName" 
            {...register('name')} 
            className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white focus:ring-violet-500" 
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">نوع فارم</label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <div className="flex gap-4">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-violet-50 dark:hover:bg-gray-700 transition-colors has-[:checked]:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:ring-1 has-[:checked]:ring-violet-500">
                  <input type="radio" {...field} value={FarmType.MORVARIDI} className="hidden"/>
                  <span className="font-bold">مرواریدی</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-violet-50 dark:hover:bg-gray-700 transition-colors has-[:checked]:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:ring-1 has-[:checked]:ring-violet-500">
                  <input type="radio" {...field} value={FarmType.MOTEFEREGHE} className="hidden"/>
                  <span className="font-bold">متفرقه</span>
                </label>
              </div>
            )}
          />
          {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-md font-semibold dark:text-gray-200">محصولات</h3>
                 {selectedType === FarmType.MORVARIDI && (
                     <button type="button" onClick={() => setIsAddingProduct(true)} className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline">
                         <Icons.Plus className="w-3 h-3" />
                         محصول جدید
                     </button>
                 )}
             </div>

             {isAddingProduct && (
                 <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 rounded-md flex gap-2">
                     <input 
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="نام محصول..."
                        className="flex-1 p-1 text-sm border rounded bg-white dark:bg-gray-600 dark:border-gray-500"
                     />
                     <Button size="sm" type="button" onClick={handleSaveProduct}>افزودن</Button>
                     <Button size="sm" type="button" variant="secondary" onClick={() => setIsAddingProduct(false)}>لغو</Button>
                 </div>
             )}

             {errors.productIds && <p className="text-red-500 text-sm mb-2">{errors.productIds.message}</p>}
             
             <Controller
                name="productIds"
                control={control}
                render={({ field }) => (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar border rounded-lg p-2 bg-white dark:bg-gray-800">
                        {allProducts.map(p => {
                            // If Motefereghe, only show default items 1 & 2
                            if (selectedType === FarmType.MOTEFEREGHE && !MOTEFEREGHE_DEFAULT_IDS.includes(p.id)) return null;
                            
                            const isReadOnly = selectedType === FarmType.MOTEFEREGHE;
                            
                            return (
                                <label key={p.id} className={`flex items-center gap-3 p-2 rounded-md ${isReadOnly ? 'opacity-80' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                    <input 
                                        type="checkbox" 
                                        id={`prod-${p.id}`}
                                        className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-gray-300"
                                        checked={field.value.includes(p.id)}
                                        disabled={isReadOnly}
                                        onChange={(e) => {
                                            if(isReadOnly) return;
                                            const newValues = e.target.checked
                                                ? [...field.value, p.id]
                                                : field.value.filter(id => id !== p.id);
                                            field.onChange(newValues);
                                        }}
                                    />
                                    <span className="dark:text-gray-300 font-medium">{p.name}</span>
                                </label>
                            );
                        })}
                        {!selectedType && <p className="text-sm text-gray-500 italic text-center py-4">لطفا ابتدا نوع فارم را انتخاب کنید.</p>}
                    </div>
                )}
             />
        </div>

        <div className="flex items-center gap-2">
            <input id="isActive" type="checkbox" {...register('isActive')} className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-gray-300"/>
            <label htmlFor="isActive" className="dark:text-gray-300 font-medium select-none cursor-pointer">فعال</label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>لغو</Button>
          <Button type="submit" isLoading={isSubmitting}>ذخیره</Button>
        </div>
      </form>
    </Modal>
  );
};

export default FarmFormModal;
