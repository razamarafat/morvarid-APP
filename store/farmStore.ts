
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

// Legacy ID mapping helper - NOW HANDLES NUMBERS AND STRINGS
const mapLegacyProductId = (id: string | number): string => {
    const strId = String(id);
    if (strId === '1') return '11111111-1111-1111-1111-111111111111';
    if (strId === '2') return '22222222-2222-2222-2222-222222222222';
    return strId;
};

// Default UUIDs for Motefereghe
const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

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
      const mappedFarms = data.map((f: any) => {
          let pIds = (f.product_ids || []).map(mapLegacyProductId);
          
          // FIX: Force default products for MOTEFEREGHE if list is empty
          if (f.type === 'MOTEFEREGHE' && pIds.length === 0) {
              pIds = [DEFAULT_PROD_1, DEFAULT_PROD_2];
          }

          return {
              id: f.id,
              name: f.name,
              type: f.type,
              isActive: f.is_active,
              productIds: pIds
          };
      });
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
          mappedProducts = data
            .filter((p: any) => String(p.id) !== '1' && String(p.id) !== '2')
            .map((p: any) => ({
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
              id: DEFAULT_PROD_1,
              name: 'شیرینگ پک ۶ شانه ساده',
              description: 'مخصوص فارم‌های متفرقه',
              unit: ProductUnit.CARTON,
              hasKilogramUnit: false,
              isDefault: true,
              isCustom: false
          },
          {
              id: DEFAULT_PROD_2,
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
