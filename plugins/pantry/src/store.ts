import { create } from 'zustand';
import type { Recipe } from './types/recipe.js';
import type { ShoppingListItem } from './types/shopping.js';

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: 'g' | 'kg' | 'ml' | 'L' | 'pieces' | 'can' | 'box' | 'bag';
  storage_location: 'fridge' | 'freezer' | 'pantry';
  food_category: 'fruits' | 'vegetables' | 'meat' | 'fish_seafood' | 'dairy' | 'eggs' | 'grains_pasta' | 'snacks' | 'drinks' | 'other';
  expiration_date: string | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
}

interface PantryStore {
  items: PantryItem[];
  loading: boolean;
  setItems: (items: PantryItem[]) => void;
  setLoading: (loading: boolean) => void;
  addItem: (item: PantryItem) => void;
  updateItem: (id: string, updates: Partial<PantryItem>) => void;
  removeItem: (id: string) => void;
  getItemsByLocation: (location: PantryItem['storage_location']) => PantryItem[];

  // Recipe suggestion state (D-16)
  recipes: Recipe[];
  recipesLoading: boolean;
  recipesError: string | null;
  setRecipes: (recipes: Recipe[]) => void;
  setRecipesLoading: (loading: boolean) => void;
  setRecipesError: (error: string | null) => void;

  // Shopping list state (Phase 9)
  shoppingItems: ShoppingListItem[];
  shoppingLoading: boolean;
  setShoppingItems: (items: ShoppingListItem[]) => void;
  setShoppingLoading: (loading: boolean) => void;
  addShoppingItem: (item: ShoppingListItem) => void;
  removeShoppingItem: (id: string) => void;
}

export const usePantryStore = create<PantryStore>((set, get) => ({
  items: [],
  loading: false,

  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),

  addItem: (item) => set((s) => ({ items: [item, ...s.items] })),

  updateItem: (id, updates) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((item) => item.id !== id),
    })),

  getItemsByLocation: (location) =>
    get().items.filter((item) => item.storage_location === location),

  recipes: [],
  recipesLoading: false,
  recipesError: null,
  setRecipes: (recipes) => set({ recipes }),
  setRecipesLoading: (recipesLoading) => set({ recipesLoading }),
  setRecipesError: (recipesError) => set({ recipesError }),

  // Shopping list (Phase 9)
  shoppingItems: [],
  shoppingLoading: false,
  setShoppingItems: (shoppingItems) => set({ shoppingItems }),
  setShoppingLoading: (shoppingLoading) => set({ shoppingLoading }),
  addShoppingItem: (item) => set((s) => ({ shoppingItems: [item, ...s.shoppingItems] })),
  removeShoppingItem: (id) =>
    set((s) => ({ shoppingItems: s.shoppingItems.filter((i) => i.id !== id) })),
}));
