import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { getActiveProgram } from '../lib/activeProgram';
import { localDateKey, consecutiveDayStreak } from '../lib/localDate';
import { COUNTABLE_SESSION_OR_FILTER } from '../lib/workoutPlan';
import { fetchSleepNight, fetchSleepSettings } from '@ziko/plugin-sleep/lib/data';
import { fetchKcalGoal, DEFAULT_NUTRITION_TARGETS } from '@ziko/plugin-sdk';
import { DEFAULT_GOAL_ML, fetchEffectiveGoalMl } from '@ziko/plugin-hydration/settings';

// ── Fallback constants ────────────────────────────────────────
// daily_water_goal_ml, weekly_goal, and sleep_goal do NOT exist
// as DB columns — use these hardcoded defaults throughout the app.
export const HOME_DEFAULTS = {
  // Objectif d'eau : source unique = reglages Hydratation (plugin). Valeur de repli seulement.
  hydrationGoalMl: DEFAULT_GOAL_ML,
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
// Fetches name, goal and settings from ziko_user_profiles. workout_frequency /
// fitness_level have no dedicated column: onboarding stores them in
// settings.onboarding ({ frequency, level, ... }) and they are derived here.
// Use profile.name?.split(' ')[0] ?? 'Athlete' to get first name —
// user_profiles has no first_name column.
export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ziko_user_profiles')
        .select('name, goal, settings')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      const ob = ((data?.settings ?? {}) as { onboarding?: { frequency?: number | string | null; level?: string | null } }).onboarding;
      return {
        name: data?.name as string | null,
        goal: data?.goal as string | null,
        workout_frequency: ob?.frequency != null ? String(ob.frequency) : null,
        fitness_level: ob?.level ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

// ── useSessionStreak ─────────────────────────────────────────
// Computes consecutive workout days (descending from today) where at least
// one workout_sessions row exists for that user.
export function useSessionStreak() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['session_streak', userId],
    queryFn: async () => {
      // `since` = instant (UTC) ; les jours sont comptes en date LOCALE (revue A #5).
      const since = new Date(Date.now() - 61 * 86400000).toISOString();
      const { data } = await supabase
        .from('ziko_workout_sessions')
        .select('started_at')
        .eq('user_id', userId!)
        .gte('started_at', since)
        .order('started_at', { ascending: false });

      return consecutiveDayStreak((data ?? []).map((r: { started_at: string }) => r.started_at));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
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
      const since = localDateKey(new Date(Date.now() - 60 * 86400000));
      const { data } = await supabase
        .from('ziko_habit_logs')
        .select('date')
        .eq('user_id', userId!)
        .gt('value', 0)
        .gte('date', since)
        .order('date', { ascending: false });

      const uniqueDays = new Set((data ?? []).map((r: { date: string }) => r.date));

      let streak = 0;
      let cursor = new Date();
      cursor.setHours(0, 0, 0, 0);

      while (uniqueDays.has(localDateKey(cursor))) {
        streak++;
        cursor = new Date(cursor.getTime() - 86400000);
      }

      return streak;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// ── useSleepSettings / useSleepToday ──────────────────────────
// SLP-06 : meme resolution que l'ecran Sommeil (plugins/sleep/src/lib/data.ts) : la source connectee prime,
// sinon la saisie manuelle ; rien -> null (aucune valeur par defaut). Date = jour du reveil, locale.
export function useSleepSettings() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['sleep', 'settings', userId],
    queryFn: () => fetchSleepSettings(supabase, userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useSleepToday() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: settings } = useSleepSettings();
  return useQuery({
    queryKey: ['sleep', 'today', userId, settings?.source ?? 'auto'],
    queryFn: () => fetchSleepNight(supabase, userId!, localDateKey(), settings),
    enabled: !!userId && settings !== undefined,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

// ── useHydrationToday ─────────────────────────────────────────
// Sums all hydration_logs.amount_ml for today.
// Returns { totalMl, goalMl } — goalMl = same value as the Hydratation screen (fetchEffectiveGoalMl).
export function useHydrationToday() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['hydration', 'today', userId],
    queryFn: async () => {
      const today = localDateKey();
      const { data, error } = await supabase
        .from('ziko_hydration_logs')
        .select('amount_ml')
        .eq('user_id', userId!)
        .eq('date', today);
      if (error) throw error;
      const totalMl = (data ?? []).reduce(
        (sum: number, r: { amount_ml: number | null }) => sum + (r.amount_ml ?? 0),
        0,
      );
      let goalMl: number = HOME_DEFAULTS.hydrationGoalMl;
      try {
        goalMl = await fetchEffectiveGoalMl(supabase, userId!);
      } catch {
        // objectif indisponible : repli sur le defaut plutot que de casser l'accueil
      }
      return { totalMl, goalMl };
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
      const today = localDateKey();
      const { data, error } = await supabase
        .from('ziko_nutrition_logs')
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

// ── useNutritionGoal ──────────────────────────────────────────
// Objectif kcal : meme source que l'ecran Repas (ziko_user_plugins.settings), repli 2000.
export function useNutritionGoal() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['nutrition', 'goal', userId],
    queryFn: () => fetchKcalGoal(supabase, userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
    placeholderData: DEFAULT_NUTRITION_TARGETS.calories,
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
        .from('ziko_workout_sessions')
        .select('id, started_at, name, total_volume_kg, total_sets, ended_at')
        .eq('user_id', userId!)
        // TRAIN-03: a session without any validated set is not counted (see isCountableSession)
        .or(COUNTABLE_SESSION_OR_FILTER)
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
      // Programme actif de l'une OU l'autre table (IA / coach) : une seule fonction de lecture.
      return await getActiveProgram(supabase as any, userId!);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 min
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
        .from('ziko_workout_sessions')
        .select('id, name, started_at, ended_at, total_volume_kg, total_duration_active_seconds, total_sets')
        .eq('user_id', userId!)
        .or(COUNTABLE_SESSION_OR_FILTER)
        .order('started_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}
