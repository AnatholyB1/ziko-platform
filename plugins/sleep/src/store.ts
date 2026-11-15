import { create } from 'zustand';
import { fetchSleepSettings, saveSleepSettings } from './lib/data';

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  duration_hours: number;
  quality: number; // 1-5
  notes: string | null;
  awakenings?: number;
  source?: 'manual' | 'health';
}

interface SleepState {
  logs: SleepLog[];
  isLoading: boolean;
  _loaded: boolean;
  /** null = aucune cible definie (aucune valeur par defaut). */
  sleepGoalHours: number | null;

  setLogs: (l: SleepLog[]) => void;
  setIsLoading: (b: boolean) => void;
  addLog: (l: SleepLog) => void;
  setSleepGoalHours: (h: number) => void;
  saveSleepGoal: (supabase: any) => Promise<void>;

  getAverageDuration: (days?: number) => number;
  getAverageQuality: (days?: number) => number;
  getRecoveryScore: () => number;
  loadRecent: (supabase: any) => Promise<void>;
}

export const useSleepStore = create<SleepState>()((set, get) => ({
  logs: [],
  isLoading: false,
  _loaded: false,
  sleepGoalHours: null,

  setLogs: (logs) => set({ logs }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),
  setSleepGoalHours: (h) => set({ sleepGoalHours: h }),

  saveSleepGoal: async (supabase: any) => {
    const { sleepGoalHours } = get();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Fusionne dans settings : les autres reglages (rappel, source, routine...) sont preserves.
    const current = await fetchSleepSettings(supabase, user.id);
    await saveSleepSettings(supabase, user.id, { ...current, goalHours: sleepGoalHours });
  },

  getAverageDuration: (days = 7) => {
    const recent = get().logs.slice(0, days);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((s, l) => s + (l.duration_hours * 60), 0) / recent.length);
  },

  getAverageQuality: (days = 7) => {
    const recent = get().logs.slice(0, days);
    if (!recent.length) return 0;
    return Math.round((recent.reduce((s, l) => s + l.quality, 0) / recent.length) * 10) / 10;
  },

  getRecoveryScore: () => {
    const recent = get().logs.slice(0, 3);
    if (!recent.length) return 50;
    const avgDuration = recent.reduce((s, l) => s + l.duration_hours, 0) / recent.length;
    const avgQuality = recent.reduce((s, l) => s + l.quality, 0) / recent.length;
    // Score: 0-100 based on 8h target and quality
    const durationScore = Math.min(avgDuration / (get().sleepGoalHours ?? 8), 1) * 60;
    const qualityScore = (avgQuality / 5) * 40;
    return Math.round(durationScore + qualityScore);
  },

  loadRecent: async (supabase: any) => {
    if (get()._loaded || get().isLoading) return;
    set({ isLoading: true, _loaded: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data }, { data: pluginData }] = await Promise.all([
        supabase
          .from('ziko_sleep_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(14),
        supabase
          .from('ziko_user_plugins')
          .select('settings')
          .eq('user_id', user.id)
          .eq('plugin_id', 'sleep')
          .single(),
      ]);
      const updates: Partial<SleepState> = { logs: data ?? [] };
      if (pluginData?.settings?.sleep_goal_hours) {
        updates.sleepGoalHours = pluginData.settings.sleep_goal_hours;
      }
      set(updates);
    } finally {
      set({ isLoading: false });
    }
  },
}));
