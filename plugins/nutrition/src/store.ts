import { create } from 'zustand';

interface NutritionEntry {
  id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g?: number;
}

interface NutritionState {
  todayLogs: NutritionEntry[];
  selectedDate: string;
  calorieGoal: number;
  proteinGoal: number;
  isLoading: boolean;

  setTodayLogs: (logs: NutritionEntry[]) => void;
  addLog: (entry: NutritionEntry) => void;
  removeLog: (id: string) => void;
  setCalorieGoal: (kcal: number) => void;
  setProteinGoal: (g: number) => void;
  setDate: (date: string) => void;
}

export const useNutritionStore = create<NutritionState>()((set) => ({
  todayLogs: [],
  selectedDate: new Date().toISOString().split('T')[0],
  calorieGoal: 2400,
  proteinGoal: 150,
  isLoading: false,

  setTodayLogs: (logs) => set({ todayLogs: logs }),
  addLog: (entry) => set((s) => ({ todayLogs: [...s.todayLogs, entry] })),
  removeLog: (id) => set((s) => ({ todayLogs: s.todayLogs.filter((l) => l.id !== id) })),
  setCalorieGoal: (kcal) => set({ calorieGoal: kcal }),
  setProteinGoal: (g) => set({ proteinGoal: g }),
  setDate: (date) => set({ selectedDate: date }),
}));

// ── TDEE Calculator ─────────────────────────────────────
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  isMale: boolean,
  activityMultiplier = 1.55, // moderate activity
): number {
  // Mifflin-St Jeor
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * activityMultiplier);
}
