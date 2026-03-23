import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────
export interface SupplementBrand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  country: string | null;
}

export interface SupplementCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  display_order: number;
}

export interface Supplement {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  ingredients: string | null;
  nutrition_per_serving: Record<string, number> | null;
  serving_size: string | null;
  servings_per_container: number | null;
  flavors: string[] | null;
  source_url: string | null;
  last_scraped_at: string | null;
  // Joined
  supplement_brands?: SupplementBrand;
  supplement_categories?: SupplementCategory;
  latest_price?: SupplementPrice | null;
}

export interface SupplementPrice {
  id: string;
  supplement_id: string;
  price: number;
  currency: string;
  source: string;
  source_url: string | null;
  in_stock: boolean;
  price_per_serving: number | null;
  scraped_at: string;
}

// ── Store ────────────────────────────────────────────────
interface SupplementsState {
  categories: SupplementCategory[];
  brands: SupplementBrand[];
  supplements: Supplement[];
  compareList: Supplement[];
  favorites: string[]; // supplement IDs
  isLoading: boolean;
  selectedCategory: string | null;
  selectedBrand: string | null;
  searchQuery: string;

  setCategories: (cats: SupplementCategory[]) => void;
  setBrands: (brands: SupplementBrand[]) => void;
  setSupplements: (supps: Supplement[]) => void;
  setLoading: (l: boolean) => void;
  setSelectedCategory: (cat: string | null) => void;
  setSelectedBrand: (brand: string | null) => void;
  setSearchQuery: (q: string) => void;
  addToCompare: (s: Supplement) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  toggleFavorite: (id: string) => void;
  setFavorites: (ids: string[]) => void;
}

export const useSupplementsStore = create<SupplementsState>()((set, get) => ({
  categories: [],
  brands: [],
  supplements: [],
  compareList: [],
  favorites: [],
  isLoading: false,
  selectedCategory: null,
  selectedBrand: null,
  searchQuery: '',

  setCategories: (categories) => set({ categories }),
  setBrands: (brands) => set({ brands }),
  setSupplements: (supplements) => set({ supplements }),
  setLoading: (isLoading) => set({ isLoading }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSelectedBrand: (selectedBrand) => set({ selectedBrand }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addToCompare: (s) => set((state) => {
    if (state.compareList.length >= 4) return state;
    if (state.compareList.find((c) => c.id === s.id)) return state;
    return { compareList: [...state.compareList, s] };
  }),

  removeFromCompare: (id) => set((state) => ({
    compareList: state.compareList.filter((c) => c.id !== id),
  })),

  clearCompare: () => set({ compareList: [] }),

  toggleFavorite: (id) => set((state) => ({
    favorites: state.favorites.includes(id)
      ? state.favorites.filter((f) => f !== id)
      : [...state.favorites, id],
  })),

  setFavorites: (favorites) => set({ favorites }),
}));
