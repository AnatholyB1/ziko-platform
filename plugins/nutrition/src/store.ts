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
  food_product_id?: string | null;
  nutriscore_grade?: string | null;
  ecoscore_grade?: string | null;
}

interface NutritionState {
  todayLogs: NutritionEntry[];
  selectedDate: string;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  isLoading: boolean;
  tdeeProfile: TDEEProfile | null;

  setTodayLogs: (logs: NutritionEntry[]) => void;
  addLog: (entry: NutritionEntry) => void;
  removeLog: (id: string) => void;
  setCalorieGoal: (kcal: number) => void;
  setProteinGoal: (g: number) => void;
  setCarbsGoal: (g: number) => void;
  setFatGoal: (g: number) => void;
  setDate: (date: string) => void;
  setTDEEProfile: (profile: TDEEProfile) => void;
  saveTDEEProfile: (supabase: any) => Promise<void>;
  loadTDEEProfile: (supabase: any) => Promise<void>;
}

export interface TDEEProfile {
  gender: 'male' | 'female';
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: number;
  goal: 'fat_loss' | 'maintenance' | 'muscle_gain' | 'endurance';
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGoalMl: number;
  sleepGoalHours: number;
}

export const useNutritionStore = create<NutritionState>()((set, get) => ({
  todayLogs: [],
  selectedDate: new Date().toISOString().split('T')[0],
  calorieGoal: 2400,
  proteinGoal: 150,
  carbsGoal: 300,
  fatGoal: 67,
  isLoading: false,
  tdeeProfile: null,

  setTodayLogs: (logs) => set({ todayLogs: logs }),
  addLog: (entry) => set((s) => ({ todayLogs: [...s.todayLogs, entry] })),
  removeLog: (id) => set((s) => ({ todayLogs: s.todayLogs.filter((l) => l.id !== id) })),
  setCalorieGoal: (kcal) => set({ calorieGoal: kcal }),
  setProteinGoal: (g) => set({ proteinGoal: g }),
  setCarbsGoal: (g) => set({ carbsGoal: g }),
  setFatGoal: (g) => set({ fatGoal: g }),
  setDate: (date) => set({ selectedDate: date }),
  setTDEEProfile: (profile) => set({
    tdeeProfile: profile,
    calorieGoal: profile.targetCalories,
    proteinGoal: profile.proteinGoal,
    carbsGoal: profile.carbsGoal,
    fatGoal: profile.fatGoal,
  }),

  saveTDEEProfile: async (supabase: any) => {
    const { tdeeProfile, calorieGoal, proteinGoal, carbsGoal, fatGoal } = get();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_plugins').upsert({
      user_id: user.id,
      plugin_id: 'nutrition',
      settings: { tdee_profile: tdeeProfile, calorie_goal: calorieGoal, protein_goal: proteinGoal, carbs_goal: carbsGoal, fat_goal: fatGoal },
    }, { onConflict: 'user_id,plugin_id' });
  },

  loadTDEEProfile: async (supabase: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_plugins')
      .select('settings')
      .eq('user_id', user.id)
      .eq('plugin_id', 'nutrition')
      .single();
    if (data?.settings) {
      const s = data.settings;
      if (s.tdee_profile) set({ tdeeProfile: s.tdee_profile });
      if (s.calorie_goal) set({ calorieGoal: s.calorie_goal });
      if (s.protein_goal) set({ proteinGoal: s.protein_goal });
      if (s.carbs_goal) set({ carbsGoal: s.carbs_goal });
      if (s.fat_goal) set({ fatGoal: s.fat_goal });
    }
  },
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
