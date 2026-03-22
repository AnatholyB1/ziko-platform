import { create } from 'zustand';

export interface JournalEntry {
  id: string;
  user_id: string;
  mood: number;
  energy: number;
  stress: number;
  context: 'pre_workout' | 'post_workout' | 'morning' | 'evening' | 'general';
  notes: string;
  date: string;
  created_at: string;
}

interface JournalStore {
  entries: JournalEntry[];
  loading: boolean;
  _loaded: boolean;
  setEntries: (entries: JournalEntry[]) => void;
  addEntry: (entry: JournalEntry) => void;
  setLoading: (loading: boolean) => void;
  getAverageMood: (days: number) => number;
  getAverageEnergy: (days: number) => number;
  getAverageStress: (days: number) => number;
  loadRecent: (supabase: any) => Promise<void>;
}

export const useJournalStore = create<JournalStore>((set, get) => ({
  entries: [],
  loading: false,
  _loaded: false,
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  setLoading: (loading) => set({ loading }),

  getAverageMood: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const recent = get().entries.filter((e) => new Date(e.date) >= cutoff);
    if (recent.length === 0) return 0;
    return Math.round((recent.reduce((s, e) => s + e.mood, 0) / recent.length) * 10) / 10;
  },

  getAverageEnergy: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const recent = get().entries.filter((e) => new Date(e.date) >= cutoff);
    if (recent.length === 0) return 0;
    return Math.round((recent.reduce((s, e) => s + e.energy, 0) / recent.length) * 10) / 10;
  },

  getAverageStress: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const recent = get().entries.filter((e) => new Date(e.date) >= cutoff);
    if (recent.length === 0) return 0;
    return Math.round((recent.reduce((s, e) => s + e.stress, 0) / recent.length) * 10) / 10;
  },

  loadRecent: async (supabase: any) => {
    if (get()._loaded || get().loading) return;
    set({ loading: true, _loaded: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(14);
      set({ entries: data ?? [] });
    } finally {
      set({ loading: false });
    }
  },
}));
