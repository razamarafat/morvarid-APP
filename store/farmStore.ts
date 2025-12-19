
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Farm, Product, ProductUnit } from '../types';

interface FarmState {
  farms: Farm[];
  products: Product[];
  isLoading: boolean;
  fetchFarms: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  addFarm: (farm: Omit<Farm, 'id'>) => Promise<void>;
  updateFarm: (farm: Farm) => Promise<void>;
  deleteFarm: (farmId: string) => Promise<void>;
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
    if (!error && data) {
      // Map DB snake_case to CamelCase types
      const mappedFarms = data.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          isActive: f.is_active,
          productIds: f.product_ids || []
      }));
      set({ farms: mappedFarms, isLoading: false });
    } else {
        set({ isLoading: false });
    }
  },

  fetchProducts: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
          const mappedProducts = data.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              unit: p.unit,
              hasKilogramUnit: p.has_kilogram_unit,
              isDefault: p.is_default,
              isCustom: p.is_custom
          }));
          set({ products: mappedProducts });
      }
  },

  addFarm: async (farm) => {
    const dbFarm = {
        name: farm.name,
        type: farm.type,
        is_active: farm.isActive,
        product_ids: farm.productIds
    };
    const { error } = await supabase.from('farms').insert(dbFarm);
    if (!error) get().fetchFarms();
  },

  updateFarm: async (farm) => {
    const dbFarm = {
        name: farm.name,
        type: farm.type,
        is_active: farm.isActive,
        product_ids: farm.productIds
    };
    const { error } = await supabase.from('farms').update(dbFarm).eq('id', farm.id);
    if (!error) get().fetchFarms();
  },

  deleteFarm: async (farmId) => {
    const { error } = await supabase.from('farms').delete().eq('id', farmId);
    if (!error) get().fetchFarms();
  },

  addProduct: async (productData) => {
      const dbProduct = {
          name: productData.name,
          description: productData.description,
          unit: productData.unit,
          has_kilogram_unit: productData.hasKilogramUnit,
          is_default: false,
          is_custom: true
      };
      const { data, error } = await supabase.from('products').insert(dbProduct).select().single();
      if (!error && data) {
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
