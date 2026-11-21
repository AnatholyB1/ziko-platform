import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { getActiveProgram } from '../lib/activeProgram';
import { localDateKey, localDateKeyFromISO } from '../lib/localDate';
import { displayStreak } from '@ziko/plugin-gamification/streak';
import { COUNTABLE_SESSION_OR_FILTER } from '../lib/workoutPlan';
import { fetchSleepNight, fetchSleepSettings } from '@ziko/plugin-sleep/lib/data';
import { fetchKcalGoal, DEFAULT_NUTRITION_TARGETS } from '@ziko/plugin-sdk';
import { DEFAULT_GOAL_ML, fetchEffectiveGoalMl, resolveGoalMl } from '@ziko/plugin-hydration/settings';

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

// ── useGamificationStreak ────────────────────────────────────
// UNE seule serie pour l'accueil, Recompenses et le Profil (UAT run 9, defaut 4) : `ziko_user_gamification`
// (current_streak / last_activity_date), rendue par `displayStreak`. Remplace les anciens calculs locaux (jours de
// seance, jours d'habitude), qui donnaient 1 / 5 / 0 pour la meme personne.
export function useGamificationStreak() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['streak', 'gamification', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ziko_user_gamification')
        .select('current_streak, last_activity_date')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return displayStreak(data);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
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
  const queryClient = useQueryClient();
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
      // Objectif : UNE seule fonction (accueil + ecran Hydratation). Lecture en echec (hors ligne, demarrage a
      // froid) -> derniere valeur connue (cache puis stockage), jamais un 2,0 L par defaut qui ecrase 2,5 L.
      const goalKey = `ziko:hydration-goal:${userId}`;
      const goalMl = await resolveGoalMl(() => fetchEffectiveGoalMl(supabase, userId!), {
        previous: (queryClient.getQueryData(['hydration', 'today', userId]) as { goalMl?: number } | undefined)?.goalMl,
        readPersisted: async () => {
          const v = Number(await AsyncStorage.getItem(goalKey));
          return Number.isFinite(v) && v > 0 ? v : null;
        },
        persist: (ml) => AsyncStorage.setItem(goalKey, String(ml)),
      });
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
export function useActiveAIProgram(opts?: { refetchOnMount?: boolean | 'always' }) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['program', 'active', userId],
    queryFn: async () => {
      // Programme actif de l'une OU l'autre table (IA / coach) : une seule fonction de lecture.
      return await getActiveProgram(supabase as any, userId!);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 min
    retry: 2, // une lecture ratee juste apres la connexion ne doit pas devenir "aucun programme"
    refetchOnMount: opts?.refetchOnMount ?? true,
  });
}

// ── useOnboardingMission ──────────────────────────────────────
// The first mission assigned by Ziko's onboarding chat is stored only in
// ziko_athlete_decisions.outcome (decision_type 'onboarding_profile'). The
// home Mission card used to read ziko_ai_generated_programs exclusively, so a
// fresh athlete saw "no mission" on arrival. The mission is "du jour": it is
// returned only when assigned today (local date) and not yet fulfilled (no
// log for its target table today); otherwise null.
export interface OnboardingMission {
  micro_action: string;
  mission_title: string;
}
export const ONBOARDING_MISSION_ROUTES: Record<string, string> = {
  hydration_log: '/(plugins)/hydration/dashboard',
  journal_mood: '/(plugins)/journal/entry',
  measurements_weight: '/(plugins)/measurements/log',
};
const ONBOARDING_MISSION_TABLES: Record<string, string> = {
  hydration_log: 'ziko_hydration_logs',
  journal_mood: 'ziko_journal_entries',
  measurements_weight: 'ziko_body_measurements',
};
export function useOnboardingMission() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['onboarding-mission', userId],
    queryFn: async (): Promise<OnboardingMission | null> => {
      const { data, error } = await supabase
        .from('ziko_athlete_decisions')
        .select('outcome, created_at')
        .eq('user_id', userId!)
        .eq('decision_type', 'onboarding_profile')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const row = data as { outcome?: Record<string, unknown>; created_at?: string } | null;
      const o = row?.outcome;
      if (!o || typeof o.mission_title !== 'string' || typeof o.micro_action !== 'string') return null;
      const table = ONBOARDING_MISSION_TABLES[o.micro_action];
      if (!table || !row?.created_at) return null;
      const today = localDateKey();
      if (localDateKeyFromISO(row.created_at) !== today) return null;
      // Already fulfilled today (the onboarding celebration path): nothing left to show.
      const { data: logs } = await supabase
        .from(table)
        .select('id')
        .eq('user_id', userId!)
        .eq('date', today)
        .limit(1);
      if (logs && logs.length > 0) return null;
      return { micro_action: o.micro_action, mission_title: o.mission_title };
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
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
