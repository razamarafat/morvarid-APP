
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Farm, Product, ProductUnit } from '../types';
import { compareFarms, compareProducts } from '../utils/sortUtils';

interface FarmState {
  farms: Farm[];
  products: Product[];
  isLoading: boolean;
  fetchFarms: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  addFarm: (farm: Omit<Farm, 'id'>) => Promise<{ success: boolean; error?: string }>;
  updateFarm: (farm: Farm) => Promise<{ success: boolean; error?: string }>;
  deleteFarm: (farmId: string) => Promise<{ success: boolean; error?: string }>;
  addProduct: (product: Omit<Product, 'id' | 'isDefault' | 'isCustom'>) => Promise<Product | null>;
  getProductById: (id: string) => Product | undefined;
}

import { mapLegacyProductId } from '../utils/productUtils';

const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

export const useFarmStore = create<FarmState>((set, get) => ({
  farms: [],
  products: [],
  isLoading: false,

  fetchFarms: async () => {
    set({ isLoading: true });
    // Fetch ALL farms, even inactive ones if you want to show them in reports
    const { data, error } = await supabase.from('farms').select('*');
    if (error) {
      console.error('Fetch Farms Failed:', error);
      set({ isLoading: false });
      return;
    }
    if (data) {
      const mappedFarms = data.map((f: any) => {
        let pIds = (f.product_ids || []).map(mapLegacyProductId);
        if (f.type === 'MOTEFEREGHE' && pIds.length === 0) {
          pIds = [DEFAULT_PROD_2, DEFAULT_PROD_1];
        }
        return { id: f.id, name: f.name, type: f.type, isActive: f.is_active, productIds: pIds };
      });

      // TASK 2: Sort farms alphabetically
      mappedFarms.sort(compareFarms);

      set({ farms: mappedFarms, isLoading: false });
    }
  },

  fetchProducts: async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('Fetch Products Failed:', error);
      return;
    }
    let mappedProducts: Product[] = [];
    if (data) {
      mappedProducts = data
        .filter((p: any) => String(p.id) !== '1' && String(p.id) !== '2')
        .filter((p: any) => !p.name.includes('6'))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          unit: p.unit,
          hasKilogramUnit: p.has_kilogram_unit, // Fixed typo: removed double underscore
          isDefault: p.is_default,
          isCustom: p.is_custom
        }));
    }

    const defaultProducts: Product[] = [
      { id: DEFAULT_PROD_2, name: 'شیرینگ پک ۶ شانه پرینتی', description: 'مخصوص فارم‌های متفرقه', unit: ProductUnit.CARTON, hasKilogramUnit: false, isDefault: true, isCustom: false },
      { id: DEFAULT_PROD_1, name: 'شیرینگ پک ۶ شانه ساده', description: 'مخصوص فارم‌های متفرقه', unit: ProductUnit.CARTON, hasKilogramUnit: false, isDefault: true, isCustom: false }
    ];

    const missingDefaults = defaultProducts.filter(dp => !mappedProducts.find(p => p.id === dp.id));
    if (missingDefaults.length > 0) {
      mappedProducts = [...mappedProducts, ...missingDefaults];
      for (const p of missingDefaults) {
        const { error: upsertError } = await supabase.from('products').upsert({
          id: p.id, name: p.name, description: p.description, unit: p.unit,
          has_kilogram_unit: p.hasKilogramUnit, is_default: p.isDefault, is_custom: p.isCustom
        });
        if (upsertError) console.error(`Error restoring default product ${p.name}:`, upsertError);
      }
    }

    // TASK 1: Apply strict product sorting
    mappedProducts.sort(compareProducts);

    set({ products: mappedProducts });
  },

  addFarm: async (farm) => {
    try {
      // Ensure productIds is properly formatted as an array
      const productIds = Array.isArray(farm.productIds) ? farm.productIds : [];
      
      const { error } = await supabase.from('farms').insert({
        name: farm.name,
        type: farm.type,
        is_active: farm.isActive,
        product_ids: productIds
      });
      
      if (error) {
        console.error('Add Farm Error:', error);
        return { success: false, error: error.message };
      }
      
      get().fetchFarms();
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error in addFarm:', error);
      return { success: false, error: error.message || 'خطای ناشناخته' };
    }
  },

  updateFarm: async (farm) => {
    try {
      // Ensure productIds is properly formatted as an array
      const productIds = Array.isArray(farm.productIds) ? farm.productIds : [];
      
      const { error } = await supabase.from('farms').update({
        name: farm.name,
        type: farm.type,
        is_active: farm.isActive,
        product_ids: productIds
      }).eq('id', farm.id);
      
      if (error) {
        console.error('Update Farm Error:', error);
        return { success: false, error: error.message };
      }
      
      get().fetchFarms();
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error in updateFarm:', error);
      return { success: false, error: error.message || 'خطای ناشناخته' };
    }
  },

  deleteFarm: async (farmId) => {
    // Soft Delete: Just mark as inactive to preserve data relations
    try {
      const { error } = await supabase.from('farms').update({ is_active: false }).eq('id', farmId);
      if (error) {
        console.error('Delete Farm Error:', error);
        return { success: false, error: error.message };
      }
      get().fetchFarms();
      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error in deleteFarm:', error);
      return { success: false, error: error.message || 'خطای ناشناخته' };
    }
  },

  addProduct: async (productData) => {
    const { data, error } = await supabase.from('products').insert({
      name: productData.name, description: productData.description, unit: productData.unit,
      has_kilogram_unit: productData.hasKilogramUnit, is_default: false, is_custom: true
    }).select().single();
    if (error) {
      console.error('Add Product Error:', error);
      return null;
    }
    if (data) {
      get().fetchProducts();
      return { id: data.id, name: data.name, description: data.description, unit: data.unit, hasKilogramUnit: data.has_kilogram_unit, isDefault: data.is_default, isCustom: data.is_custom };
    }
    return null;
  },

  getProductById: (id) => get().products.find(p => p.id === id),
}));
