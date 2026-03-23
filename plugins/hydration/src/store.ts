import { create } from 'zustand';

export interface HydrationLog {
  id: string;
  user_id: string;
  amount_ml: number;
  date: string;
  created_at: string;
}

export interface Container {
  id: string;
  label: string;
  ml: number;
  icon: string;
  isDefault?: boolean;
}

const DEFAULT_CONTAINERS: Container[] = [
  { id: 'glass', label: 'Verre', ml: 250, icon: '🥛', isDefault: true },
  { id: 'bottle', label: 'Bouteille', ml: 500, icon: '🧴', isDefault: true },
  { id: 'large-bottle', label: 'Grande bouteille', ml: 750, icon: '🍶', isDefault: true },
  { id: 'litre', label: 'Litre', ml: 1000, icon: '💧', isDefault: true },
];

interface HydrationStore {
  logs: HydrationLog[];
  goalMl: number;
  loading: boolean;
  _loaded: boolean;
  containers: Container[];
  favoriteContainerId: string | null;
  setLogs: (logs: HydrationLog[]) => void;
  addLog: (log: HydrationLog) => void;
  setGoalMl: (goal: number) => void;
  setLoading: (loading: boolean) => void;
  getTodayTotal: () => number;
  getTodayProgress: () => number;
  loadToday: (supabase: any) => Promise<void>;
  setContainers: (containers: Container[]) => void;
  addContainer: (container: Container) => void;
  updateContainer: (id: string, updates: Partial<Container>) => void;
  removeContainer: (id: string) => void;
  setFavoriteContainer: (id: string | null) => void;
  getFavoriteContainer: () => Container;
  saveSettings: (supabase: any) => Promise<void>;
}

export const useHydrationStore = create<HydrationStore>((set, get) => ({
  logs: [],
  goalMl: 2500,
  loading: false,
  _loaded: false,
  containers: [...DEFAULT_CONTAINERS],
  favoriteContainerId: null,
  setLogs: (logs) => set({ logs }),
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),
  setGoalMl: (goalMl) => set({ goalMl }),
  setLoading: (loading) => set({ loading }),

  setContainers: (containers) => set({ containers }),
  addContainer: (container) => set((s) => ({ containers: [...s.containers, container] })),
  updateContainer: (id, updates) => set((s) => ({
    containers: s.containers.map((c) => c.id === id ? { ...c, ...updates } : c),
  })),
  removeContainer: (id) => set((s) => ({
    containers: s.containers.filter((c) => c.id !== id),
    favoriteContainerId: s.favoriteContainerId === id ? null : s.favoriteContainerId,
  })),
  setFavoriteContainer: (id) => set({ favoriteContainerId: id }),
  getFavoriteContainer: () => {
    const { containers, favoriteContainerId } = get();
    if (favoriteContainerId) {
      const fav = containers.find((c) => c.id === favoriteContainerId);
      if (fav) return fav;
    }
    return containers[0] ?? DEFAULT_CONTAINERS[0];
  },

  saveSettings: async (supabase: any) => {
    const { containers, favoriteContainerId, goalMl } = get();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const customContainers = containers.filter((c) => !c.isDefault);
    await supabase.from('user_plugins').upsert({
      user_id: user.id,
      plugin_id: 'hydration',
      settings: { goal_ml: goalMl, custom_containers: customContainers, favorite_container_id: favoriteContainerId },
    }, { onConflict: 'user_id,plugin_id' });
  },

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
      if (profile?.settings?.custom_containers) {
        const custom = profile.settings.custom_containers as Container[];
        set({ containers: [...DEFAULT_CONTAINERS, ...custom] });
      }
      if (profile?.settings?.favorite_container_id) {
        set({ favoriteContainerId: profile.settings.favorite_container_id });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
