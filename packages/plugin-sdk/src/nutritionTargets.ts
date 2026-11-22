// Objectifs nutrition par defaut : UNE seule valeur de repli pour tout le produit (UAT run2 :
// recettes "reste 1 510 kcal" sur base 2000 vs ecran repas 2400). La source de verite reste
// `ziko_user_plugins.settings` (plugin nutrition : calorie_goal, protein_goal, carbs_goal, fat_goal).
// Copies synchronisees (garde-fou : apps/mobile/src/lib/__tests__/nutritionTargets.test.ts) :
//   backend/api/src/routes/pantry-recipes-macros.ts (DEFAULT_TARGETS)
//   plugins/pantry/src/utils/pantryLogic.ts (DEFAULT_MACRO_TARGETS)
export const DEFAULT_NUTRITION_TARGETS = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 } as const;

/** Objectif kcal depuis `ziko_user_plugins.settings` (plugin nutrition) ; repli commun si absent/invalide. */
export function resolveKcalGoal(settings: unknown): number {
  const v = (settings as { calorie_goal?: unknown } | null | undefined)?.calorie_goal;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_NUTRITION_TARGETS.calories;
}

/** Lit l'objectif kcal enregistre (meme source que l'ecran Repas / Nutrition). Ne leve jamais. */
export async function fetchKcalGoal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any },
  userId: string,
): Promise<number> {
  try {
    const { data } = await client
      .from('ziko_user_plugins')
      .select('settings')
      .eq('user_id', userId)
      .eq('plugin_id', 'nutrition')
      .maybeSingle();
    return resolveKcalGoal(data?.settings);
  } catch {
    return DEFAULT_NUTRITION_TARGETS.calories;
  }
}
