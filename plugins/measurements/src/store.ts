import { create } from 'zustand';

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  photo_url: string | null;
  notes: string | null;
}

interface MeasurementsState {
  entries: BodyMeasurement[];
  isLoading: boolean;
  _loaded: boolean;

  setEntries: (e: BodyMeasurement[]) => void;
  setIsLoading: (b: boolean) => void;
  addEntry: (e: BodyMeasurement) => void;
  getLatest: () => BodyMeasurement | null;
  getProgress: (field: keyof BodyMeasurement) => { current: number | null; previous: number | null; diff: number };
  loadRecent: (supabase: any) => Promise<void>;
}

export const useMeasurementsStore = create<MeasurementsState>()((set, get) => ({
  entries: [],
  isLoading: false,
  _loaded: false,

  setEntries: (entries) => set({ entries }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),

  getLatest: () => get().entries[0] ?? null,

  getProgress: (field) => {
    const entries = get().entries;
    const current = entries[0]?.[field] as number | null;
    const previous = entries.length > 1 ? (entries[entries.length - 1]?.[field] as number | null) : null;
    const diff = current != null && previous != null ? current - previous : 0;
    return { current, previous, diff };
  },

  loadRecent: async (supabase: any) => {
    if (get()._loaded || get().isLoading) return;
    set({ isLoading: true, _loaded: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10);
      set({ entries: data ?? [] });
    } finally {
      set({ isLoading: false });
    }
  },
}));
