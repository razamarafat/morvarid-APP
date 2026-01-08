
import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Farm, FarmType } from '../../types';
import { useFarmStore } from '../../store/farmStore';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import { useToastStore } from '../../store/toastStore';
import { sanitizeString } from '../../utils/sanitizers';

const farmNameRegex = /^[\u0600-\u06FF\s0-9]+$/;

const farmSchema = z.object({
  name: z.string()
    .min(1, 'نام فارم الزامی است')
    .regex(farmNameRegex, 'نام فارم باید فقط شامل حروف فارسی و اعداد باشد'),
  type: z.nativeEnum(FarmType),
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
  const { addToast } = useToastStore();

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
  const PRINTI_ID = '22222222-2222-2222-2222-222222222222';
  const SADEH_ID = '11111111-1111-1111-1111-111111111111';

  const MOTEFEREGHE_DEFAULT_IDS = [PRINTI_ID, SADEH_ID];
  const MORVARIDI_DEFAULT_IDS = [PRINTI_ID, SADEH_ID];

  // Sort products: Printed first, then Simple, then others
  const sortedProducts = useMemo(() => {
    return [...allProducts].sort((a, b) => {
      if (a.id === PRINTI_ID) return -1;
      if (b.id === PRINTI_ID) return 1;
      if (a.id === SADEH_ID) return -1;
      if (b.id === SADEH_ID) return 1;
      return 0;
    });
  }, [allProducts]);

  useEffect(() => {
    if (isOpen) {
      setIsAddingProduct(false);
      if (farm) {
        reset(farm);
      } else {
        reset({
          name: '',
          type: undefined as any,
          isActive: true,
          productIds: [],
        });
      }
    }
  }, [farm, isOpen, reset]);

  useEffect(() => {
    if (selectedType === FarmType.MOTEFEREGHE) {
      setValue('productIds', MOTEFEREGHE_DEFAULT_IDS);
    } else if (selectedType === FarmType.MORVARIDI && !farm) {
      // Pre-select Printed & Simple for Morvaridi too, but allowing edits
      setValue('productIds', MORVARIDI_DEFAULT_IDS);
    }
  }, [selectedType, farm, setValue]);

  const handleSaveProduct = () => {
    const cleanName = sanitizeString(newProductName);
    if (cleanName.trim()) {
      const newProduct = addProduct({
        name: cleanName,
        unit: 'CARTON' as any,
        hasKilogramUnit: false
      });

      newProduct.then((p: any) => {
        if (p) {
          const currentIds = watch('productIds') || [];
          setValue('productIds', [...currentIds, p.id]);
          setNewProductName('');
          setIsAddingProduct(false);
          addToast('محصول جدید اضافه شد', 'success');
        } else {
          addToast('خطا در افزودن محصول', 'error');
        }
      });
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
      let result;
      const cleanName = sanitizeString(data.name);

      const payload = {
        name: cleanName,
        type: data.type,
        isActive: data.isActive,
        productIds: data.productIds
      };

      if (farm) {
        result = await updateFarm({ ...payload, id: farm.id });
      } else {
        result = await addFarm(payload);
      }

      if (result.success) {
        addToast(farm ? 'فارم با موفقیت ویرایش شد' : 'فارم جدید ایجاد شد', 'success');
        onClose();
      } else {
        addToast(`خطا: ${result.error}`, 'error');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={farm ? 'ویرایش فارم' : 'ایجاد فارم جدید'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="نام فارم (فقط فارسی)"
          autoFocus
          {...register('name')}
          error={errors.name?.message}
          placeholder=""
        />

        <div>
          <label className="block text-sm font-bold mb-2 dark:text-gray-300 px-1">نوع فارم</label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <div className="flex gap-4">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer hover:bg-violet-50 dark:hover:bg-gray-800 transition-colors has-[:checked]:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:text-violet-700">
                  <input type="radio" {...field} value={FarmType.MORVARIDI} className="hidden" />
                  <span className="font-bold">مرواریدی</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer hover:bg-violet-50 dark:hover:bg-gray-800 transition-colors has-[:checked]:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:text-violet-700">
                  <input type="radio" {...field} value={FarmType.MOTEFEREGHE} className="hidden" />
                  <span className="font-bold">متفرقه</span>
                </label>
              </div>
            )}
          />
          {errors.type && <p className="text-red-500 text-xs mt-1 font-bold px-1">{errors.type.message}</p>}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-sm font-bold dark:text-gray-200">محصولات</h3>
            {selectedType === FarmType.MORVARIDI && (
              <button type="button" onClick={() => setIsAddingProduct(true)} className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:bg-violet-50 dark:hover:bg-violet-900/30 px-2 py-1 rounded-full transition-colors">
                <Icons.Plus className="w-3 h-3" />
                محصول جدید
              </button>
            )}
          </div>

          {isAddingProduct && (
            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl flex gap-2 border border-gray-200 dark:border-gray-700">
              <input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="نام محصول..."
                className="flex-1 p-2 text-sm border-none bg-transparent outline-none dark:text-white"
              />
              <Button size="sm" type="button" onClick={handleSaveProduct} className="rounded-lg">افزودن</Button>
              <Button size="sm" type="button" variant="secondary" onClick={() => setIsAddingProduct(false)} className="rounded-lg">لغو</Button>
            </div>
          )}

          {errors.productIds && <p className="text-red-500 text-xs mb-2 font-bold px-1">{errors.productIds.message}</p>}

          <Controller
            name="productIds"
            control={control}
            render={({ field }) => (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar border-2 border-gray-100 dark:border-gray-700 rounded-xl p-2 bg-gray-50 dark:bg-gray-800">
                {sortedProducts.map(p => {
                  if (selectedType === FarmType.MOTEFEREGHE && !MOTEFEREGHE_DEFAULT_IDS.includes(p.id)) return null;
                  const isReadOnly = selectedType === FarmType.MOTEFEREGHE;
                  const isChecked = field.value.includes(p.id);

                  return (
                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isReadOnly ? 'opacity-80' : 'cursor-pointer hover:bg-white dark:hover:bg-gray-700'} ${isChecked ? 'bg-white shadow-sm dark:bg-gray-700' : ''}`}>
                      <input
                        type="checkbox"
                        id={`prod-${p.id}`}
                        className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-gray-300"
                        checked={isChecked}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          if (isReadOnly) return;
                          const newValues = e.target.checked
                            ? [...field.value, p.id]
                            : field.value.filter(id => id !== p.id);
                          field.onChange(newValues);
                        }}
                      />
                      <span className={`text-sm font-medium dark:text-gray-200 ${isChecked ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>{p.name}</span>
                    </label>
                  );
                })}
                {!selectedType && <p className="text-sm text-gray-400 italic text-center py-4">لطفا ابتدا نوع فارم را انتخاب کنید.</p>}
              </div>
            )}
          />
        </div>

        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <input id="isActive" type="checkbox" {...register('isActive')} className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-gray-300 cursor-pointer" />
          <label htmlFor="isActive" className="dark:text-gray-300 font-bold select-none cursor-pointer">فارم فعال است</label>
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
