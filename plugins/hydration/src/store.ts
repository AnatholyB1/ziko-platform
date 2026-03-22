import { create } from 'zustand';

export interface HydrationLog {
  id: string;
  user_id: string;
  amount_ml: number;
  date: string;
  created_at: string;
}

interface HydrationStore {
  logs: HydrationLog[];
  goalMl: number;
  loading: boolean;
  _loaded: boolean;
  setLogs: (logs: HydrationLog[]) => void;
  addLog: (log: HydrationLog) => void;
  setGoalMl: (goal: number) => void;
  setLoading: (loading: boolean) => void;
  getTodayTotal: () => number;
  getTodayProgress: () => number;
  loadToday: (supabase: any) => Promise<void>;
}

export const useHydrationStore = create<HydrationStore>((set, get) => ({
  logs: [],
  goalMl: 2500,
  loading: false,
  _loaded: false,
  setLogs: (logs) => set({ logs }),
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),
  setGoalMl: (goalMl) => set({ goalMl }),
  setLoading: (loading) => set({ loading }),

  getTodayTotal: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().logs
      .filter((l) => l.date === today)
      .reduce((sum, l) => sum + l.amount_ml, 0);
  },

  getTodayProgress: () => {
    const total = get().getTodayTotal();
    const goal = get().goalMl;
    return goal > 0 ? Math.min(total / goal, 1) : 0;
  },

  loadToday: async (supabase: any) => {
    if (get()._loaded || get().loading) return;
    set({ loading: true, _loaded: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('hydration_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false });
      set({ logs: data ?? [] });
      const { data: profile } = await supabase
        .from('user_plugins')
        .select('settings')
        .eq('user_id', user.id)
        .eq('plugin_id', 'hydration')
        .single();
      if (profile?.settings?.goal_ml) {
        set({ goalMl: profile.settings.goal_ml });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
