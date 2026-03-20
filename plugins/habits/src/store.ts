import { create } from 'zustand';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'boolean' | 'count';
  target: number;
  unit: string | null;
  /** 'manual' | 'workout_auto' = auto-sync from workout sessions | 'nutrition_auto' = auto-sync from nutrition logs */
  source: 'manual' | 'workout_auto' | 'nutrition_auto';
  reminder_time: string | null; // 'HH:MM'
  is_active: boolean;
  sort_order: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  value: number;
}

interface HabitsState {
  habits: Habit[];
  todayLogs: HabitLog[];
  allLogs: HabitLog[]; // last 30 days for streak calculation
  isLoading: boolean;

  setHabits: (habits: Habit[]) => void;
  setTodayLogs: (logs: HabitLog[]) => void;
  setAllLogs: (logs: HabitLog[]) => void;
  setIsLoading: (loading: boolean) => void;
  updateLog: (habitId: string, value: number) => void;

  getTodayValue: (habitId: string) => number;
  isCompletedToday: (habitId: string) => boolean;
  getCompletedCount: () => number;
  getStreak: (habitId: string) => number;
}

export const useHabitsStore = create<HabitsState>()((set, get) => ({
  habits: [],
  todayLogs: [],
  allLogs: [],
  isLoading: false,

  setHabits: (habits) => set({ habits }),
  setTodayLogs: (logs) => set({ todayLogs: logs }),
  setAllLogs: (logs) => set({ allLogs: logs }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  updateLog: (habitId, value) =>
    set((s) => {
      const existing = s.todayLogs.find((l) => l.habit_id === habitId);
      if (existing) {
        return {
          todayLogs: s.todayLogs.map((l) =>
            l.habit_id === habitId ? { ...l, value } : l,
          ),
        };
      }
      const today = new Date().toISOString().split('T')[0];
      const newLog: HabitLog = {
        id: `local-${Date.now()}`,
        habit_id: habitId,
        user_id: '',
        date: today,
        value,
      };
      return { todayLogs: [...s.todayLogs, newLog] };
    }),

  getTodayValue: (habitId) => {
    const log = get().todayLogs.find((l) => l.habit_id === habitId);
    return log?.value ?? 0;
  },

  isCompletedToday: (habitId) => {
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return false;
    return get().getTodayValue(habitId) >= habit.target;
  },

  getCompletedCount: () => {
    return get().habits.filter((h) => h.is_active && get().isCompletedToday(h.id)).length;
  },

  getStreak: (habitId) => {
    const logs = get().allLogs.filter((l) => l.habit_id === habitId);
    const habit = get().habits.find((h) => h.id === habitId);
    if (!logs.length || !habit) return 0;

    // Build set of dates where habit was completed (value >= target)
    const completedDates = new Set(
      logs.filter((l) => l.value >= habit.target).map((l) => l.date),
    );

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (completedDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  },
}));

/** Default habits created on first launch */
export const DEFAULT_HABITS: Omit<Habit, 'id' | 'user_id'>[] = [
  {
    name: 'Water',
    emoji: '💧',
    color: '#2196F3',
    type: 'count',
    target: 8,
    unit: 'glasses',
    source: 'manual',
    reminder_time: '09:00',
    is_active: true,
    sort_order: 0,
  },
  {
    name: 'Workout',
    emoji: '🏋️',
    color: '#6C63FF',
    type: 'boolean',
    target: 1,
    unit: null,
    source: 'workout_auto',
    reminder_time: '07:00',
    is_active: true,
    sort_order: 1,
  },
  {
    name: 'Log Nutrition',
    emoji: '🥗',
    color: '#4CAF50',
    type: 'boolean',
    target: 1,
    unit: null,
    source: 'nutrition_auto',
    reminder_time: '12:00',
    is_active: true,
    sort_order: 2,
  },
  {
    name: 'Sleep 8h',
    emoji: '😴',
    color: '#9C27B0',
    type: 'boolean',
    target: 1,
    unit: null,
    source: 'manual',
    reminder_time: '22:00',
    is_active: true,
    sort_order: 3,
  },
];
