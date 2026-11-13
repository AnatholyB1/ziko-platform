// Non-regression UAT run2 (defaut 5): une seule valeur de repli pour les objectifs nutrition
// (recettes P10 sur 2000 vs ecran repas P9 sur 2400).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_NUTRITION_TARGETS } from '../../../../../packages/plugin-sdk/src/nutritionTargets';
import { DEFAULT_TARGETS, resolveTargets } from '../../../../../backend/api/src/routes/pantry-recipes-macros';
import { DEFAULT_MACRO_TARGETS, remainingFromSettings } from '../../../../../plugins/pantry/src/utils/pantryLogic';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../../../../', rel), 'utf8');

describe('objectifs nutrition : source unique', () => {
  it('backend (recettes) et pantry partagent le repli du SDK', () => {
    expect(DEFAULT_TARGETS).toEqual(DEFAULT_NUTRITION_TARGETS);
    expect(DEFAULT_MACRO_TARGETS).toEqual(DEFAULT_NUTRITION_TARGETS);
    expect(resolveTargets(null)).toEqual(DEFAULT_NUTRITION_TARGETS);
  });
  it('sans reglage, le reste affiche par les recettes part de la meme base que l\'ecran repas', () => {
    expect(remainingFromSettings(null, []).calories).toBe(DEFAULT_NUTRITION_TARGETS.calories);
  });
  it('le store nutrition n\'a plus de repli divergent (2400/300/67) et l\'ecran repas lit les reglages', () => {
    const store = read('plugins/nutrition/src/store.ts');
    expect(store).toMatch(/calorieGoal: DEFAULT_NUTRITION_TARGETS\.calories/);
    expect(store).not.toMatch(/calorieGoal: 2400/);
    const meal = read('plugins/nutrition/src/screens/LogMealScreen.tsx');
    expect(meal).toMatch(/loadTDEEProfile\(supabase\)/);
  });
  it('le tableau de bord nutrition lit les objectifs enregistres (ziko_user_plugins.settings)', () => {
    const dash = read('plugins/nutrition/src/screens/NutritionPlugin.tsx');
    expect(dash).toMatch(/from\('ziko_user_plugins'\)/);
    expect(dash).toMatch(/DEFAULT_NUTRITION_TARGETS\.calories/);
  });
});
