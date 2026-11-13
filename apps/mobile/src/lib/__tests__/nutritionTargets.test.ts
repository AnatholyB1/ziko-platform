// Non-regression UAT run2 (defaut 5): une seule valeur de repli pour les objectifs nutrition
// (recettes P10 sur 2000 vs ecran repas P9 sur 2400). Test au niveau source (pas d'import croise
// backend/plugins : le tsconfig composite du mobile les refuse).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../../../../', rel), 'utf8');

/** Extrait `{ calories: N, protein_g: N, carbs_g: N, fat_g: N }` declare apres `name`. */
function targets(src: string, name: string) {
  const m = src.match(new RegExp(`${name}[^=]*=\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`${name} introuvable`);
  const out: Record<string, number> = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) out[k] = Number(v);
  return out;
}

describe('objectifs nutrition : source unique', () => {
  const sdk = targets(read('packages/plugin-sdk/src/nutritionTargets.ts'), 'DEFAULT_NUTRITION_TARGETS');

  it('l\'accueil (quickLog) n\'a plus d\'objectif kcal divergent : meme repli que le SDK (review A #13)', () => {
    const ql = read('apps/mobile/src/lib/quickLog.ts');
    expect(ql).toMatch(new RegExp(`NUTRITION_GOAL_KCAL = ${sdk.calories};`));
    expect(ql).not.toMatch(/2200/);
    // l'ecran d'accueil lit l'objectif reel via le hook (reglages nutrition)
    expect(read('apps/mobile/app/(app)/index.tsx')).toMatch(/useNutritionGoal\(\)/);
  });
  it('le repli du SDK est complet', () => {
    expect(Object.keys(sdk).sort()).toEqual(['calories', 'carbs_g', 'fat_g', 'protein_g']);
  });
  it('backend (recettes) et pantry partagent le repli du SDK', () => {
    expect(targets(read('backend/api/src/routes/pantry-recipes-macros.ts'), 'DEFAULT_TARGETS')).toEqual(sdk);
    expect(targets(read('plugins/pantry/src/utils/pantryLogic.ts'), 'DEFAULT_MACRO_TARGETS')).toEqual(sdk);
  });
  it('le store nutrition n\'a plus de repli divergent (2400/300/67) et l\'ecran repas lit les reglages', () => {
    const store = read('plugins/nutrition/src/store.ts');
    expect(store).toMatch(/calorieGoal: DEFAULT_NUTRITION_TARGETS\.calories/);
    expect(store).not.toMatch(/calorieGoal: 2400/);
    expect(read('plugins/nutrition/src/screens/LogMealScreen.tsx')).toMatch(/loadTDEEProfile\(supabase\)/);
  });
  it('le tableau de bord nutrition lit les objectifs enregistres (ziko_user_plugins.settings)', () => {
    const dash = read('plugins/nutrition/src/screens/NutritionPlugin.tsx');
    expect(dash).toMatch(/from\('ziko_user_plugins'\)/);
    expect(dash).toMatch(/DEFAULT_NUTRITION_TARGETS\.calories/);
  });
});
