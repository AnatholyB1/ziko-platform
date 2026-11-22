// Pure helpers for POST /pantry/recipes/suggest (Phase 10, PANT-05 / P-4).
// No I/O here so the macro budget logic is unit-testable without Supabase or the AI SDK.

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Repli quand l'utilisateur n'a pas encore regle ses objectifs nutrition. */
export const DEFAULT_TARGETS: MacroTotals = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

function positive(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Objectifs de l'utilisateur lus dans ziko_user_plugins.settings du plugin nutrition
 * (calorie_goal, protein_goal, carbs_goal, fat_goal ; alias *_g tolere).
 * Chaque champ absent ou invalide retombe sur DEFAULT_TARGETS.
 */
export function resolveTargets(settings: unknown): MacroTotals {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  return {
    calories: positive(s.calorie_goal) ?? DEFAULT_TARGETS.calories,
    protein_g: positive(s.protein_goal) ?? positive(s.protein_goal_g) ?? DEFAULT_TARGETS.protein_g,
    carbs_g: positive(s.carbs_goal) ?? positive(s.carbs_goal_g) ?? DEFAULT_TARGETS.carbs_g,
    fat_g: positive(s.fat_goal) ?? positive(s.fat_goal_g) ?? DEFAULT_TARGETS.fat_g,
  };
}

/**
 * Date de reference des macros consommees : la date LOCALE envoyee par le client (YYYY-MM-DD),
 * sinon la date UTC du serveur. Une chaine mal formee ou une date impossible est ignoree.
 */
export function resolveDate(input: unknown, now: Date = new Date()): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(`${input}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === input) return input;
  }
  return now.toISOString().split('T')[0];
}

export function sumMeals(meals: Array<Record<string, unknown>>): MacroTotals {
  const add = (k: string) => meals.reduce((s, m) => s + (Number(m[k]) || 0), 0);
  return { calories: add('calories'), protein_g: add('protein_g'), carbs_g: add('carbs_g'), fat_g: add('fat_g') };
}

export function remainingMacros(targets: MacroTotals, consumed: MacroTotals): MacroTotals {
  const rest = (t: number, c: number) => Math.max(0, Math.round(t - c));
  return {
    calories: rest(targets.calories, consumed.calories),
    protein_g: rest(targets.protein_g, consumed.protein_g),
    carbs_g: rest(targets.carbs_g, consumed.carbs_g),
    fat_g: rest(targets.fat_g, consumed.fat_g),
  };
}
