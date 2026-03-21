import { create } from 'zustand';

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality: number; // 1-5
  notes: string | null;
}

interface SleepState {
  logs: SleepLog[];
  isLoading: boolean;

  setLogs: (l: SleepLog[]) => void;
  setIsLoading: (b: boolean) => void;
  addLog: (l: SleepLog) => void;

  getAverageDuration: (days?: number) => number;
  getAverageQuality: (days?: number) => number;
  getRecoveryScore: () => number;
}

export const useSleepStore = create<SleepState>()((set, get) => ({
  logs: [],
  isLoading: false,

  setLogs: (logs) => set({ logs }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),

  getAverageDuration: (days = 7) => {
    const recent = get().logs.slice(0, days);
    if (!recent.length) return 0;
    return Math.round(recent.reduce((s, l) => s + l.duration_minutes, 0) / recent.length);
  },

  getAverageQuality: (days = 7) => {
    const recent = get().logs.slice(0, days);
    if (!recent.length) return 0;
    return Math.round((recent.reduce((s, l) => s + l.quality, 0) / recent.length) * 10) / 10;
  },

  getRecoveryScore: () => {
    const recent = get().logs.slice(0, 3);
    if (!recent.length) return 50;
    const avgDuration = recent.reduce((s, l) => s + l.duration_minutes, 0) / recent.length;
    const avgQuality = recent.reduce((s, l) => s + l.quality, 0) / recent.length;
    // Score: 0-100 based on 8h target and quality
    const durationScore = Math.min(avgDuration / 480, 1) * 60;
    const qualityScore = (avgQuality / 5) * 40;
    return Math.round(durationScore + qualityScore);
  },
}));
