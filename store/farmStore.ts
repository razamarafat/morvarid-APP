
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Farm, Product, FarmType, ProductUnit } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface FarmState {
  farms: Farm[];
  products: Product[];
  addFarm: (farm: Omit<Farm, 'id'>) => void;
  updateFarm: (farm: Farm) => void;
  deleteFarm: (farmId: string) => void;
  addProduct: (product: Omit<Product, 'id'| 'isDefault' | 'isCustom'>) => Product;
  getProductById: (id: string) => Product | undefined;
}

// Default products with descriptions
const initialProducts: Product[] = [
  { id: '1', name: 'شیرینگ پک ۶ شانه ساده', description: '(بدون جداسازی)', isDefault: true, isCustom: false, unit: ProductUnit.CARTON, hasKilogramUnit: false },
  { id: '2', name: 'شیرینگ پک ۶ شانه پرینتی', description: '(با جداسازی)', isDefault: true, isCustom: false, unit: ProductUnit.CARTON, hasKilogramUnit: false },
  { id: '3', name: 'کودی', description: '(تولید + جداسازی)', isDefault: true, isCustom: false, unit: ProductUnit.CARTON, hasKilogramUnit: false },
  { id: '4', name: 'نوکی', description: '(تولید + جداسازی)', isDefault: true, isCustom: false, unit: ProductUnit.CARTON, hasKilogramUnit: false },
  { id: '5', name: 'دوزرده', description: '(تولید + جداسازی)', isDefault: true, isCustom: false, unit: ProductUnit.CARTON, hasKilogramUnit: false },
  { id: '6', name: 'مایع', description: '(تولید + جداسازی)', isDefault: true, isCustom: false, unit: ProductUnit.CARTON, hasKilogramUnit: true },
];

export const useFarmStore = create<FarmState>()(
  persist(
    (set, get) => ({
      farms: [],
      products: initialProducts,
      addFarm: (farm) => set((state) => ({ farms: [...state.farms, { ...farm, id: uuidv4() }] })),
      updateFarm: (updatedFarm) =>
        set((state) => ({
          farms: state.farms.map((farm) => (farm.id === updatedFarm.id ? updatedFarm : farm)),
        })),
      deleteFarm: (farmId) => set((state) => ({ farms: state.farms.filter((farm) => farm.id !== farmId) })),
      addProduct: (productData) => {
        const newProduct: Product = {
          ...productData,
          id: uuidv4(),
          isDefault: false,
          isCustom: true,
        };
        set((state) => ({ products: [...state.products, newProduct]}));
        return newProduct;
      },
      getProductById: (id) => get().products.find(p => p.id === id),
    }),
    {
      name: 'farm-storage',
      partialize: (state) => ({ farms: state.farms, products: state.products }), // Persist farms and custom products
    }
  )
);
