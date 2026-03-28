import { clientForUser } from '../tools/db.js';

const today = () => new Date().toISOString().split('T')[0];

export interface UserContext {
  profile: {
    name: string | null;
    age: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    goal: string | null;
    units: string;
  } | null;
  installedPlugins: string[];
  recentWorkouts: Array<{
    name: string | null;
    started_at: string;
    total_volume_kg: number | null;
  }>;
  todayNutritionSummary: {
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    meal_count: number;
  };
  todayHabitsSummary: {
    total: number;
    completed: number;
  };
}

export async function fetchUserContext(userId: string, userToken?: string): Promise<UserContext> {
  const db = clientForUser(userToken);
  const date = today();

  const [profileRes, pluginsRes, workoutsRes, nutritionRes, habitsRes, logsRes] =
    await Promise.all([
      db.from('user_profiles')
        .select('name, age, weight_kg, height_cm, goal, units')
        .eq('id', userId)
        .single(),
      db.from('user_plugins')
        .select('plugin_id')
        .eq('user_id', userId)
        .eq('is_enabled', true),
      db.from('workout_sessions')
        .select('name, started_at, total_volume_kg')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(5),
      db.from('nutrition_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .eq('date', date),
      db.from('habits')
        .select('id, target')
        .eq('user_id', userId)
        .eq('is_active', true),
      db.from('habit_logs')
        .select('habit_id, value')
        .eq('user_id', userId)
        .eq('date', date),
    ]);

  // Nutrition totals
  const meals = nutritionRes.data ?? [];
  const todayNutritionSummary = {
    total_calories: meals.reduce((s: number, m: any) => s + (Number(m.calories) || 0), 0),
    total_protein_g: meals.reduce((s: number, m: any) => s + (Number(m.protein_g) || 0), 0),
    total_carbs_g: meals.reduce((s: number, m: any) => s + (Number(m.carbs_g) || 0), 0),
    total_fat_g: meals.reduce((s: number, m: any) => s + (Number(m.fat_g) || 0), 0),
    meal_count: meals.length,
  };

  // Habits completion
  const habits = habitsRes.data ?? [];
  const logs = logsRes.data ?? [];
  const logMap = new Map(logs.map((l: any) => [l.habit_id, Number(l.value)]));
  const completed = habits.filter(
    (h: any) => (logMap.get(h.id) ?? 0) >= (h.target ?? 1),
  ).length;

  return {
    profile: profileRes.data
      ? {
          name: profileRes.data.name,
          age: profileRes.data.age,
          weight_kg: Number(profileRes.data.weight_kg) || null,
          height_cm: Number(profileRes.data.height_cm) || null,
          goal: profileRes.data.goal,
          units: profileRes.data.units,
        }
      : null,
    installedPlugins: (pluginsRes.data ?? []).map((p: any) => p.plugin_id),
    recentWorkouts: (workoutsRes.data ?? []).map((w: any) => ({
      name: w.name,
      started_at: w.started_at,
      total_volume_kg: w.total_volume_kg ? Number(w.total_volume_kg) : null,
    })),
    todayNutritionSummary,
    todayHabitsSummary: { total: habits.length, completed },
  };
}
