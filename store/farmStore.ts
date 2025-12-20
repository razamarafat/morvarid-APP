
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Farm, Product, ProductUnit } from '../types';
import { useLogStore } from './logStore';

interface FarmState {
  farms: Farm[];
  products: Product[];
  isLoading: boolean;
  fetchFarms: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  addFarm: (farm: Omit<Farm, 'id'>) => Promise<{ success: boolean; error?: string }>;
  updateFarm: (farm: Farm) => Promise<{ success: boolean; error?: string }>;
  deleteFarm: (farmId: string) => Promise<{ success: boolean; error?: string }>;
  addProduct: (product: Omit<Product, 'id'| 'isDefault' | 'isCustom'>) => Promise<Product | null>;
  getProductById: (id: string) => Product | undefined;
}

export const useFarmStore = create<FarmState>((set, get) => ({
  farms: [],
  products: [],
  isLoading: false,

  fetchFarms: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase.from('farms').select('*');
    
    if (error) {
        useLogStore.getState().addLog('error', 'database', `Fetch Farms Failed: ${error.message} (${error.code})`, 'SYSTEM');
        set({ isLoading: false });
        return;
    }

    if (data) {
      const mappedFarms = data.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          isActive: f.is_active,
          productIds: f.product_ids || []
      }));
      set({ farms: mappedFarms, isLoading: false });
    }
  },

  fetchProducts: async () => {
      const { data, error } = await supabase.from('products').select('*');
      
      if (error) {
          useLogStore.getState().addLog('error', 'database', `Fetch Products Failed: ${error.message}`, 'SYSTEM');
          return;
      }

      let mappedProducts: Product[] = [];
      
      if (data) {
          mappedProducts = data.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              unit: p.unit,
              hasKilogramUnit: p.has_kilogram_unit,
              isDefault: p.is_default,
              isCustom: p.is_custom
          }));
      }

      // Default Products Logic Updated with Valid UUIDs
      const defaultProducts: Product[] = [
          {
              id: '11111111-1111-1111-1111-111111111111',
              name: 'شیرینگ پک ۶ شانه ساده',
              description: 'مخصوص فارم‌های متفرقه',
              unit: ProductUnit.CARTON,
              hasKilogramUnit: false,
              isDefault: true,
              isCustom: false
          },
          {
              id: '22222222-2222-2222-2222-222222222222',
              name: 'شیرینگ پک ۶ شانه پرینتی',
              description: 'مخصوص فارم‌های متفرقه',
              unit: ProductUnit.CARTON,
              hasKilogramUnit: false,
              isDefault: true,
              isCustom: false
          }
      ];

      const missingDefaults = defaultProducts.filter(dp => !mappedProducts.find(p => p.id === dp.id));

      if (missingDefaults.length > 0) {
          mappedProducts = [...mappedProducts, ...missingDefaults];
          for (const p of missingDefaults) {
              try {
                  // Explicitly await and capture error to avoid unhandled rejections or "catch is not a function"
                  const { error: upsertError } = await supabase.from('products').upsert({
                      id: p.id,
                      name: p.name,
                      description: p.description,
                      unit: p.unit,
                      has_kilogram_unit: p.hasKilogramUnit,
                      is_default: p.isDefault,
                      is_custom: p.isCustom
                  });
                  if (upsertError) {
                       useLogStore.getState().addLog('warn', 'database', `Failed to restore default product ${p.name}: ${upsertError.message}`, 'SYSTEM');
                  }
              } catch (e: any) {
                  useLogStore.getState().addLog('error', 'database', `Exception restoring product ${p.name}: ${e.message}`, 'SYSTEM');
              }
          }
      }

      set({ products: mappedProducts });
  },

  addFarm: async (farm) => {
    const user = (await supabase.auth.getUser()).data.user;
    const userId = user?.id || 'UNKNOWN';

    useLogStore.getState().addLog('info', 'database', `Attempting to add farm: ${farm.name}`, userId);

    const dbFarm = {
        name: farm.name,
        type: farm.type,
        is_active: farm.isActive,
        product_ids: farm.productIds
    };
    
    const { data, error } = await supabase.from('farms').insert(dbFarm).select();
    
    if (error) {
        useLogStore.getState().addLog('error', 'database', `Add Farm Error: ${error.message} - Details: ${JSON.stringify(error)}`, userId);
        return { success: false, error: error.message };
    }

    useLogStore.getState().addLog('info', 'database', `Farm created successfully: ${farm.name}`, userId);
    get().fetchFarms();
    return { success: true };
  },

  updateFarm: async (farm) => {
    const user = (await supabase.auth.getUser()).data.user;
    const userId = user?.id || 'UNKNOWN';

    useLogStore.getState().addLog('info', 'database', `Attempting to update farm: ${farm.id}`, userId);

    const dbFarm = {
        name: farm.name,
        type: farm.type,
        is_active: farm.isActive,
        product_ids: farm.productIds
    };
    const { error } = await supabase.from('farms').update(dbFarm).eq('id', farm.id);
    
    if (error) {
        useLogStore.getState().addLog('error', 'database', `Update Farm Error: ${error.message}`, userId);
        return { success: false, error: error.message };
    }

    useLogStore.getState().addLog('info', 'database', `Farm updated: ${farm.name}`, userId);
    get().fetchFarms();
    return { success: true };
  },

  deleteFarm: async (farmId) => {
    const user = (await supabase.auth.getUser()).data.user;
    const userId = user?.id || 'UNKNOWN';
    
    const { error } = await supabase.from('farms').delete().eq('id', farmId);
    
    if (error) {
        useLogStore.getState().addLog('error', 'database', `Delete Farm Error: ${error.message}`, userId);
        return { success: false, error: error.message };
    }

    useLogStore.getState().addLog('info', 'database', `Farm deleted: ${farmId}`, userId);
    get().fetchFarms();
    return { success: true };
  },

  addProduct: async (productData) => {
      const user = (await supabase.auth.getUser()).data.user;
      
      const dbProduct = {
          name: productData.name,
          description: productData.description,
          unit: productData.unit,
          has_kilogram_unit: productData.hasKilogramUnit,
          is_default: false,
          is_custom: true
      };
      
      const { data, error } = await supabase.from('products').insert(dbProduct).select().single();
      
      if (error) {
          useLogStore.getState().addLog('error', 'database', `Add Product Error: ${error.message}`, user?.id);
          return null;
      }
      
      if (data) {
          useLogStore.getState().addLog('info', 'database', `Product created: ${data.name}`, user?.id);
          get().fetchProducts();
          return {
              id: data.id,
              name: data.name,
              description: data.description,
              unit: data.unit,
              hasKilogramUnit: data.has_kilogram_unit,
              isDefault: data.is_default,
              isCustom: data.is_custom
          };
      }
      return null;
  },

  getProductById: (id) => get().products.find(p => p.id === id),
}));
