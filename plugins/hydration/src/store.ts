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
  setLogs: (logs: HydrationLog[]) => void;
  addLog: (log: HydrationLog) => void;
  setGoalMl: (goal: number) => void;
  setLoading: (loading: boolean) => void;
  getTodayTotal: () => number;
  getTodayProgress: () => number;
}

export const useHydrationStore = create<HydrationStore>((set, get) => ({
  logs: [],
  goalMl: 2500,
  loading: false,
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
}));
