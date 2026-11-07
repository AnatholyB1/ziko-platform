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
    ai_persona?: string | null;
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
  personaInstruction: string;
  recentFormResponses: Array<{
    form_title: string;
    submitted_at: string;
    questions: Array<{ id: string; type: string; label: string }>;
    answers: Array<{ question_id: string; value: string | number }>;
  }>;
  /** Phase 47 OPS-01: compact coaching state; defaults when no row exists. */
  athleteState: AthleteStateContext;
}

export interface AthleteStateContext {
  level: number;
  tier: number;
  points: number;
  readiness: 'fragile' | 'building' | 'ready';
  focus: string | null;
}

/** Hard cap on the focus text injected into the system prompt. */
export const ATHLETE_STATE_FOCUS_MAX_CHARS = 300;

const READINESS_VALUES = ['fragile', 'building', 'ready'] as const;

/** Fail-safe defaults (mirror the athlete_state column defaults). */
export const DEFAULT_ATHLETE_STATE: AthleteStateContext = {
  level: 1,
  tier: 1,
  points: 0,
  readiness: 'fragile',
  focus: null,
};

/**
 * Normalises a raw ziko_athlete_state row (or null) into the bounded
 * context shape. Only five scalar fields are ever read: no onboarding
 * profile, rolling summary, decision detail or other free-form JSON.
 */
export function toAthleteStateContext(row: any): AthleteStateContext {
  if (!row) return { ...DEFAULT_ATHLETE_STATE };
  const int = (v: unknown, fallback: number, min: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  const focusRaw =
    typeof row.current_focus_summary === 'string'
      ? row.current_focus_summary.replace(/\s+/g, ' ').trim()
      : '';
  return {
    level: int(row.level, 1, 1),
    tier: int(row.tier, 1, 1),
    points: int(row.points, 0, 0),
    readiness: (READINESS_VALUES as readonly string[]).includes(row.readiness)
      ? row.readiness
      : 'fragile',
    focus: focusRaw ? focusRaw.slice(0, ATHLETE_STATE_FOCUS_MAX_CHARS) : null,
  };
}

/** System-prompt section; fixed shape, bounded size (<= ~450 chars). */
export function buildAthleteStateSection(state: AthleteStateContext | null | undefined): string {
  const s = state ?? DEFAULT_ATHLETE_STATE;
  return `## Coaching State
- Level: ${s.level} | Tier: ${s.tier} | Points: ${s.points}
- Readiness: ${s.readiness}
- Current focus: ${s.focus ?? 'none set yet'}`;
}

export async function fetchUserContext(userId: string, userToken?: string): Promise<UserContext> {
  const db = clientForUser(userToken);
  const date = today();

  const [profileRes, pluginsRes, workoutsRes, nutritionRes, habitsRes, logsRes, formResponsesRes, athleteStateRes] =
    await Promise.all([
      db.from('ziko_user_profiles')
        .select('name, age, weight_kg, height_cm, goal, units, settings')
        .eq('id', userId)
        .single(),
      db.from('ziko_user_plugins')
        .select('plugin_id')
        .eq('user_id', userId)
        .eq('is_enabled', true),
      db.from('ziko_workout_sessions')
        .select('name, started_at, total_volume_kg')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(5),
      db.from('ziko_nutrition_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .eq('date', date),
      db.from('ziko_habits')
        .select('id, target')
        .eq('user_id', userId)
        .eq('is_active', true),
      db.from('ziko_habit_logs')
        .select('habit_id, value')
        .eq('user_id', userId)
        .eq('date', date),
      db.from('ziko_form_responses')
        .select(`
          answers,
          submitted_at,
          form_instances:ziko_form_instances!inner(
            form_id,
            coach_forms:ziko_coach_forms!inner(
              title,
              questions
            )
          )
        `)
        .eq('athlete_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(5),
      db.from('ziko_athlete_state')
        .select('level, tier, points, readiness, current_focus_summary')
        .eq('user_id', userId)
        .maybeSingle(),
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

  // Persona injection (T-37-05-02: server-side hardcoded map — DB value is key lookup only)
  const personaPrompts: Record<string, string> = {
    max: "Tu t'appelles Max, tu es un coach sport motivant et exigeant, style sergent d'élite.",
    zoe: "Tu t'appelles Zoé, tu es une coach bienveillante qui encourage et valorise les progrès.",
    leo: "Tu t'appelles Léo, tu es un coach analytique qui optimise les performances avec les données.",
    rio: "Tu t'appelles Rio, tu es un coach détendu et fun qui rend le sport accessible et sympa.",
  };
  const aiPersona = (profileRes.data?.settings as any)?.ai_persona ?? 'max';
  const personaInstruction = personaPrompts[aiPersona] ?? personaPrompts.max;

  return {
    profile: profileRes.data
      ? {
          name: profileRes.data.name,
          age: profileRes.data.age,
          weight_kg: Number(profileRes.data.weight_kg) || null,
          height_cm: Number(profileRes.data.height_cm) || null,
          goal: profileRes.data.goal,
          units: profileRes.data.units,
          ai_persona: aiPersona,
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
    personaInstruction,
    recentFormResponses: (formResponsesRes.data ?? []).map((r: any) => ({
      form_title: r.form_instances?.coach_forms?.title ?? '',
      submitted_at: r.submitted_at,
      questions: r.form_instances?.coach_forms?.questions ?? [],
      answers: r.answers ?? [],
    })),
    athleteState: toAthleteStateContext(athleteStateRes?.data),
  };
}
