import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// ── Fallback constants ────────────────────────────────────────
// daily_water_goal_ml, weekly_goal, and sleep_goal do NOT exist
// as DB columns — use these hardcoded defaults throughout the app.
export const HOME_DEFAULTS = {
  hydrationGoalMl: 2500,
  sleepTargetH: 8,
  weeklyGoalDefault: 4,
} as const;

// ── parseWorkoutFrequency ────────────────────────────────────
// Parses user_profiles.workout_frequency ('2','3','4','5+') → integer.
// Returns HOME_DEFAULTS.weeklyGoalDefault on any unrecognised input.
export function parseWorkoutFrequency(freq: string | null | undefined): number {
  if (!freq) return HOME_DEFAULTS.weeklyGoalDefault;
  const raw = freq.replace('+', '').trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : HOME_DEFAULTS.weeklyGoalDefault;
}

// ── useProfile ────────────────────────────────────────────────
// Fetches name, goal, workout_frequency, fitness_level from user_profiles.
// Use profile.name?.split(' ')[0] ?? 'Athlete' to get first name —
// user_profiles has no first_name column.
export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, goal, workout_frequency, fitness_level')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

// ── useStreak ─────────────────────────────────────────────────
// Computes consecutive habit days (descending from today) where at least
// one habit_log row exists with completed=true.
// habit_logs unique constraint is (habit_id, date) — NOT (user_id, date).
export function useStreak() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('user_id', userId!)
        .eq('completed', true)
        .gte('date', since)
        .order('date', { ascending: false });

      const uniqueDays = new Set((data ?? []).map((r: { date: string }) => r.date));

      let streak = 0;
      let cursor = new Date();
      cursor.setHours(0, 0, 0, 0);

      while (uniqueDays.has(cursor.toISOString().split('T')[0])) {
        streak++;
        cursor = new Date(cursor.getTime() - 86400000);
      }

      return streak;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// ── useSleepToday ─────────────────────────────────────────────
// Fetches today's sleep_logs entry. Row may not exist — returns null when nothing logged.
export function useSleepToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['sleep', 'today', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('duration_hours, quality, bedtime, wake_time')
        .eq('user_id', userId!)
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

// ── useHydrationToday ─────────────────────────────────────────
// Sums all hydration_logs.amount_ml for today.
// Returns { totalMl } — goal is HOME_DEFAULTS.hydrationGoalMl (2500).
export function useHydrationToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['hydration', 'today', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('hydration_logs')
        .select('amount_ml')
        .eq('user_id', userId!)
        .eq('date', today);
      if (error) throw error;
      const totalMl = (data ?? []).reduce(
        (sum: number, r: { amount_ml: number | null }) => sum + (r.amount_ml ?? 0),
        0,
      );
      return { totalMl };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

// ── useNutritionToday ─────────────────────────────────────────
// Sums calories/protein/carbs/fat from nutrition_logs for today.
// Returns { totalCalories, logs }.
export function useNutritionToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['nutrition', 'today', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId!)
        .eq('date', today);
      if (error) throw error;
      const logs = data ?? [];
      const totalCalories = logs.reduce(
        (sum: number, r: { calories: number | null }) => sum + (r.calories ?? 0),
        0,
      );
      return { totalCalories, logs };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// ── useWeeklySessions ─────────────────────────────────────────
// Fetches workout_sessions for the last 7 days, ordered newest first.
// Used for WeekStrip session dot computation.
export function useWeeklySessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['workouts', 'weekly', userId],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, started_at, name, total_volume_kg')
        .eq('user_id', userId!)
        .gte('started_at', weekAgo)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// ── useActiveAIProgram ────────────────────────────────────────
// Fetches the active AI-generated program from ai_generated_programs.
// Returns null when no active program exists (row may be absent).
// is_active is BOOLEAN — do NOT use status='active'.
// program_data is JSONB with no enforced schema — access defensively.
export function useActiveAIProgram() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['program', 'active', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

// ── useRecentSessions ─────────────────────────────────────────
// Fetches the 3 most recent workout_sessions for the home screen Recent section.
export function useRecentSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['workouts', 'recent', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, name, started_at, total_volume_kg, duration_seconds')
        .eq('user_id', userId!)
        .order('started_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}
