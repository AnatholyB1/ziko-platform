// Objectifs nutrition par defaut : UNE seule valeur de repli pour tout le produit (UAT run2 :
// recettes "reste 1 510 kcal" sur base 2000 vs ecran repas 2400). La source de verite reste
// `ziko_user_plugins.settings` (plugin nutrition : calorie_goal, protein_goal, carbs_goal, fat_goal).
// Copies synchronisees (garde-fou : apps/mobile/src/lib/__tests__/nutritionTargets.test.ts) :
//   backend/api/src/routes/pantry-recipes-macros.ts (DEFAULT_TARGETS)
//   plugins/pantry/src/utils/pantryLogic.ts (DEFAULT_MACRO_TARGETS)
export const DEFAULT_NUTRITION_TARGETS = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 } as const;
