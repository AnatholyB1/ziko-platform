/**
 * Revue A #13 : l'objectif kcal de l'accueil lit les reglages nutrition (repli commun 2000), plus de 2200 en dur.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_NUTRITION_TARGETS, resolveKcalGoal, fetchKcalGoal } from './nutritionTargets';

describe('resolveKcalGoal', () => {
  it('prend calorie_goal des reglages', () => {
    expect(resolveKcalGoal({ calorie_goal: 2600 })).toBe(2600);
  });
  it('repli 2000 si absent, null, invalide ou <= 0', () => {
    for (const v of [undefined, null, {}, { calorie_goal: 0 }, { calorie_goal: -5 }, { calorie_goal: '2500' }, { calorie_goal: NaN }]) {
      expect(resolveKcalGoal(v)).toBe(DEFAULT_NUTRITION_TARGETS.calories);
    }
    expect(DEFAULT_NUTRITION_TARGETS.calories).toBe(2000);
  });
});

describe('fetchKcalGoal', () => {
  const client = (data: unknown, boom = false) => ({
    from: (table: string) => {
      expect(table).toBe('ziko_user_plugins');
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (boom) throw new Error('network');
          return { data };
        },
      };
      return chain;
    },
  });
  it('lit ziko_user_plugins.settings du plugin nutrition', async () => {
    expect(await fetchKcalGoal(client({ settings: { calorie_goal: 2350 } }), 'u1')).toBe(2350);
  });
  it('ligne absente : repli 2000', async () => {
    expect(await fetchKcalGoal(client(null), 'u1')).toBe(2000);
  });
  it('erreur reseau : repli 2000, ne leve pas', async () => {
    expect(await fetchKcalGoal(client(null, true), 'u1')).toBe(2000);
  });
});
