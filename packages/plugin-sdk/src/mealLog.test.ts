import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mealTypeForHour, formatClock, sumMacros, scaleFood, addLabel, buildInsertRows, groupByMeal,
  deriveRecents, dateKeyDaysAgo, scanCostLabel, SCAN_CREDIT_COST, isNetworkError, parsePending, enqueuePending,
  removePending, parsePrefs, saveMeal, DEFAULT_MEAL_PREFS, type BasketItem,
} from './mealLog';

describe('mealTypeForHour (M-2, creneaux du contrat)', () => {
  it.each([
    [5, 'breakfast'], [8, 'breakfast'], [10, 'breakfast'],
    [11, 'lunch'], [12, 'lunch'], [14, 'lunch'],
    [15, 'snack'], [16, 'snack'], [17, 'snack'],
    [18, 'dinner'], [20, 'dinner'], [22, 'dinner'],
  ])('heure %i -> %s', (h, expected) => {
    expect(mealTypeForHour(h)).toBe(expected);
  });
  it('hors creneau = dernier repas utilise, sinon snack', () => {
    expect(mealTypeForHour(23, 'lunch')).toBe('lunch');
    expect(mealTypeForHour(3, 'dinner')).toBe('dinner');
    expect(mealTypeForHour(4)).toBe('snack');
    expect(mealTypeForHour(0, null)).toBe('snack');
  });
  it('formatClock zero-pad', () => {
    expect(formatClock(new Date(2026, 10, 12, 7, 5))).toBe('07:05');
    expect(formatClock(new Date(2026, 10, 12, 12, 40))).toBe('12:40');
  });
});

describe('panier (D-06)', () => {
  const item = (o: Partial<BasketItem>): BasketItem => ({
    key: 'k', food_name: 'x', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, serving_g: 100, ...o,
  });
  it('sumMacros : total A16 = 640 kcal pour 248 + 392', () => {
    const t = sumMacros([item({ calories: 248, protein_g: 46 }), item({ calories: 392, protein_g: 5.55 })]);
    expect(t.calories).toBe(640);
    expect(t.protein_g).toBe(51.6);
  });
  it('sumMacros tolere null/undefined/NaN', () => {
    expect(sumMacros(null)).toEqual({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(sumMacros([{ calories: NaN, protein_g: null }]).calories).toBe(0);
  });
  it('scaleFood met a l echelle des grammes', () => {
    const s = scaleFood({ name: 'Poulet', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, serving_g: 100 }, 150);
    expect(s).toMatchObject({ food_name: 'Poulet', calories: 248, protein_g: 46.5, serving_g: 150 });
    expect(scaleFood({ name: 'a', calories: 100, protein_g: 0, carbs_g: 0, fat_g: 0, serving_g: 0 }, 0).serving_g).toBe(100);
  });
  it('addLabel', () => {
    expect(addLabel(1)).toBe('Ajouter 1 aliment');
    expect(addLabel(2)).toBe('Ajouter 2 aliments');
  });
  it('buildInsertRows : meme repas, meme date locale, optionnels omis', () => {
    const rows = buildInsertRows(
      [item({ food_name: 'A', calories: 10 }), item({ food_name: 'B', food_product_id: 'p1', nutriscore_grade: 'b' })],
      'u1', '2026-11-12', 'lunch',
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.user_id === 'u1' && r.date === '2026-11-12' && r.meal_type === 'lunch')).toBe(true);
    expect('food_product_id' in rows[0]).toBe(false);
    expect(rows[1].food_product_id).toBe('p1');
    expect(rows[1].nutriscore_grade).toBe('b');
  });
});

describe('repas du jour (M-3)', () => {
  const rows = [
    { meal_type: 'lunch' as const, food_name: 'Riz', calories: 260 },
    { meal_type: 'breakfast' as const, food_name: 'Flocons', calories: 300 },
    { meal_type: 'breakfast' as const, food_name: 'Banane', calories: 120 },
  ];
  it('groupByMeal ordonne petit-dej puis dejeuner et somme les kcal', () => {
    const g = groupByMeal(rows);
    expect(g.map((x) => x.meal_type)).toEqual(['breakfast', 'lunch']);
    expect(g[0]).toMatchObject({ calories: 420, count: 2, names: ['Flocons', 'Banane'] });
  });
  it('somme des groupes = recap kcal (sumMacros)', () => {
    const total = groupByMeal(rows).reduce((s, g) => s + g.calories, 0);
    expect(total).toBe(sumMacros(rows).calories);
  });
  it('liste vide -> aucun groupe (A18)', () => {
    expect(groupByMeal([])).toEqual([]);
  });
});

describe('recents sans migration (D-09)', () => {
  const r = (food_name: string, date: string, calories: number, created_at = '') => ({
    meal_type: 'lunch' as const, food_name, calories, date, created_at, serving_g: 100,
  });
  it('distincts, frequence puis recence, derniere valeur gardee', () => {
    const out = deriveRecents([
      r('Skyr nature', '2026-11-10', 100),
      r('skyr nature', '2026-11-12', 110),
      r('Oeufs', '2026-11-11', 150),
      r('Pates', '2026-11-09', 300),
    ]);
    expect(out.map((x) => x.food_name)).toEqual(['Skyr nature', 'Oeufs', 'Pates']);
    expect(out[0].count).toBe(2);
    expect(out[0].calories).toBe(110);
  });
  it('ignore les noms vides et respecte la limite', () => {
    expect(deriveRecents([r('  ', '2026-11-10', 1)])).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) => r(`f${i}`, '2026-11-10', i));
    expect(deriveRecents(many, 5)).toHaveLength(5);
  });
  it('dateKeyDaysAgo = date locale', () => {
    expect(dateKeyDaysAgo(14, new Date(2026, 10, 12, 23, 59))).toBe('2026-10-29');
    expect(dateKeyDaysAgo(0, new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('cout photo reel (D-10 / Q3)', () => {
  it('libelle derive du cout, pas en dur', () => {
    expect(scanCostLabel(3)).toBe('3 crédits IA par analyse');
    expect(scanCostLabel(1)).toBe('1 crédit IA par analyse');
  });
  it('les miroirs (mobile + SDK) du cout `scan` egalent la config backend (anti-derive)', () => {
    const root = resolve(__dirname, '../../..');
    const backend = readFileSync(resolve(root, 'backend/api/src/config/credits.ts'), 'utf8');
    const mobile = readFileSync(resolve(root, 'apps/mobile/src/lib/creditCosts.ts'), 'utf8');
    const plugin = readFileSync(resolve(root, 'plugins/nutrition/src/screens/LogMealScreen.tsx'), 'utf8');
    const b = backend.match(/CREDIT_COSTS[^{]*\{[^}]*scan:\s*(\d+)/s)?.[1];
    const m = mobile.match(/scan:\s*(\d+)/)?.[1];
    expect(b).toBeDefined();
    expect(m).toBe(b);
    expect(String(SCAN_CREDIT_COST)).toBe(b);
    // l'ecran n'embarque plus de copie en dur du cout
    expect(plugin).not.toMatch(/scan:\s*3\b/);
  });
});

describe('hors-ligne (M-5)', () => {
  it('isNetworkError', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isNetworkError({ message: 'new row violates check constraint' })).toBe(false);
  });
  it('file : enqueue / remove / parse robuste', () => {
    const e = { id: 'a', rows: [{ food_name: 'x' } as never], queuedAt: 't' };
    const l = enqueuePending([], e);
    expect(l).toHaveLength(1);
    expect(removePending(l, 'a')).toEqual([]);
    expect(parsePending(JSON.stringify(l))).toHaveLength(1);
    expect(parsePending('garbage')).toEqual([]);
    expect(parsePending(null)).toEqual([]);
    expect(parsePending('[{"id":1}]')).toEqual([]);
  });
});

describe('preferences (D-07, M-2 derniere methode)', () => {
  it('parsePrefs defaut + valeurs invalides', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_MEAL_PREFS);
    expect(parsePrefs('{bad')).toEqual(DEFAULT_MEAL_PREFS);
    expect(parsePrefs('{"lastMethod":"zzz","lastMealType":"brunch"}')).toEqual(DEFAULT_MEAL_PREFS);
    expect(parsePrefs('{"lastMethod":"scan","lastMealType":"dinner"}')).toEqual({ lastMethod: 'scan', lastMealType: 'dinner' });
  });
});

describe('saveMeal : un seul insert groupe (D-06)', () => {
  const rows = buildInsertRows(
    [{ key: '1', food_name: 'A', calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0, serving_g: 100 },
     { key: '2', food_name: 'B', calories: 2, protein_g: 0, carbs_g: 0, fat_g: 0, serving_g: 100 }],
    'u', '2026-11-12', 'dinner',
  );
  const client = (result: unknown, throws?: Error) => {
    const select = vi.fn(async () => { if (throws) throw throws; return result; });
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    return { from, insert, select };
  };
  it('appelle insert UNE fois avec tout le tableau', async () => {
    const c = client({ data: [{ id: '1' }, { id: '2' }], error: null });
    const r = await saveMeal(c, rows);
    expect(c.from).toHaveBeenCalledWith('ziko_nutrition_logs');
    expect(c.insert).toHaveBeenCalledTimes(1);
    expect((c.insert.mock.calls[0] as unknown[])[0]).toHaveLength(2);
    expect(r.status).toBe('saved');
  });
  it('erreur reseau -> network (mise en file), erreur base -> error', async () => {
    expect((await saveMeal(client({ data: null, error: { message: 'Network request failed' } }), rows)).status).toBe('network');
    expect((await saveMeal(client(null, new Error('Failed to fetch')), rows)).status).toBe('network');
    expect(await saveMeal(client({ data: null, error: { message: 'check constraint' } }), rows)).toEqual({ status: 'error', message: 'check constraint' });
  });
  it('panier vide refuse sans appel', async () => {
    const c = client({ data: [], error: null });
    expect((await saveMeal(c, [])).status).toBe('error');
    expect(c.from).not.toHaveBeenCalled();
  });
});
