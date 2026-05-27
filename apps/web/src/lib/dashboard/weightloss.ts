import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BodyweightCurvePoint = {
  date: string;
  weight_kg: number;
};

export type CalorieCompliancePoint = {
  date: string;
  calories: number;
};

export type LoadProgressionPoint = {
  date: string;
  total_load_kg: number;
};

export type WeightLossData = {
  bodyweightCurve: BodyweightCurvePoint[];
  calorieCompliance: CalorieCompliancePoint[];
  loadProgression: LoadProgressionPoint[];
  avgDailyCalories: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<'week' | 'month' | '3m', number> = {
  week: 7,
  month: 30,
  '3m': 90,
};

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchWeightLossData(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: 'week' | 'month' | '3m'
): Promise<WeightLossData> {
  const days = DATE_RANGE_DAYS[dateRange];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();
  const cutoffDate = cutoffStr.slice(0, 10);

  const [bodyweightResult, nutritionResult, setsResult] = await Promise.all([
    supabase
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .eq('user_id', clientId)
      .gte('measured_at', cutoffStr)
      .not('weight_kg', 'is', null)
      .order('measured_at', { ascending: true }),

    supabase
      .from('nutrition_logs')
      .select('date, calories')
      .eq('user_id', clientId)
      .gte('date', cutoffDate)
      .not('calories', 'is', null)
      .order('date', { ascending: true }),

    supabase
      .from('session_sets')
      .select(`
        weight_kg,
        reps,
        workout_sessions!inner (
          started_at,
          user_id
        )
      `)
      .eq('workout_sessions.user_id', clientId)
      .gte('workout_sessions.started_at', cutoffStr)
      .not('weight_kg', 'is', null)
      .not('reps', 'is', null),
  ]);

  if (bodyweightResult.error) {
    console.error('[weightloss] bodyweight fetch error:', bodyweightResult.error);
    throw new Error(bodyweightResult.error.message);
  }
  if (nutritionResult.error) {
    console.error('[weightloss] nutrition fetch error:', nutritionResult.error);
    throw new Error(nutritionResult.error.message);
  }
  if (setsResult.error) {
    console.error('[weightloss] sets fetch error:', setsResult.error);
    throw new Error(setsResult.error.message);
  }

  // Bodyweight curve
  const bodyweightCurve: BodyweightCurvePoint[] = (bodyweightResult.data ?? []).map((r) => ({
    date: (r.measured_at as string).slice(0, 10),
    weight_kg: r.weight_kg as number,
  }));

  // Calorie compliance: daily total calories
  const calMap = new Map<string, number>();
  for (const r of nutritionResult.data ?? []) {
    const d = r.date as string;
    calMap.set(d, (calMap.get(d) ?? 0) + (r.calories as number));
  }
  const calorieCompliance: CalorieCompliancePoint[] = Array.from(calMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, calories]) => ({ date, calories: Math.round(calories) }));

  // Average daily calories (used as reference line)
  const avgDailyCalories =
    calorieCompliance.length > 0
      ? Math.round(
          calorieCompliance.reduce((sum, p) => sum + p.calories, 0) / calorieCompliance.length
        )
      : 0;

  // Load progression: total load per session date (sum of weight_kg * reps)
  const loadByDate = new Map<string, number>();
  for (const s of setsResult.data ?? []) {
    const session = s.workout_sessions as unknown as { started_at: string } | { started_at: string }[];
    const started_at = Array.isArray(session) ? session[0]?.started_at : session?.started_at;
    const date = started_at?.slice(0, 10) ?? '';
    if (!date) continue;
    loadByDate.set(date, (loadByDate.get(date) ?? 0) + (s.weight_kg as number) * (s.reps as number));
  }
  const loadProgression: LoadProgressionPoint[] = Array.from(loadByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total_load_kg]) => ({ date, total_load_kg: Math.round(total_load_kg) }));

  return { bodyweightCurve, calorieCompliance, loadProgression, avgDailyCalories };
}
