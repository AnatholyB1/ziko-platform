/**
 * Phase 10 (v1.20) - PANT-05 / P-4 : POST /pantry/recipes/suggest.
 *
 * Prouve (avec mocks, aucun appel reseau) :
 *  - la route est derriere creditCheck('recipes') : balance insuffisante => 402, l'IA n'est PAS appelee ;
 *  - une generation reussie debite 1 credit (creditDeduct) ; un echec 5xx ne debite pas ;
 *  - le prompt envoye a l'IA contient les macros restantes calculees depuis les objectifs de
 *    l'utilisateur (ziko_user_plugins.settings) et les repas de la date LOCALE envoyee par le client ;
 *  - repli sur les constantes si l'utilisateur n'a pas d'objectifs.
 * Ne prouve PAS : le comportement reel de Sonnet, la RPC SQL de debit, ni l'etat de la base de production.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockFrom, mockGenerate, mockClientFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGenerate: vi.fn(),
  mockClientFrom: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null })) },
  })),
}));

vi.mock('../tools/db.js', () => ({ clientForUser: () => ({ from: mockClientFrom }) }));

vi.mock('../config/models.js', () => ({ AGENT_MODEL: 'test-model' }));

vi.mock('ai', () => ({
  generateObject: mockGenerate,
  NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
    text = '';
  },
}));

vi.mock('../services/creditService.js', () => ({
  getQuotaStatus: vi.fn(),
  trackQuotaUsage: vi.fn(async () => undefined),
  deductCredits: vi.fn(async () => ({ success: true, balance: 9 })),
}));

import { pantryRecipesRouter } from './pantry-recipes.js';
import * as creditService from '../services/creditService.js';

const mockQuota = vi.mocked(creditService.getQuotaStatus);
const mockDeduct = vi.mocked(creditService.deductCredits);

function chain(finalValue: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'order', 'gte']) c[m] = vi.fn(() => c);
  c.maybeSingle = vi.fn(() => Promise.resolve(finalValue));
  c.single = vi.fn(() => Promise.resolve(finalValue));
  c.then = (res: any, rej?: any) => Promise.resolve(finalValue).then(res, rej);
  return c;
}

/** Tables of the credit gate (service client) : flag off + free tier. */
function gateTables() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'ziko_app_config') return chain({ data: { value: false }, error: null });
    if (table === 'ziko_user_profiles') return chain({ data: { tier: 'free' }, error: null });
    if (table === 'ziko_ai_credit_transactions') return chain({ data: [], error: null });
    throw new Error(`unexpected gate table ${table}`);
  });
}

interface Seed {
  meals?: any[];
  settings?: any;
  pantry?: any[];
}

function userTables(seed: Seed = {}) {
  const eqSpies: Array<[string, string, unknown]> = [];
  mockClientFrom.mockImplementation((table: string) => {
    const value =
      table === 'ziko_pantry_items'
        ? { data: seed.pantry ?? [{ id: 'p1', name: 'Filet de poulet', quantity: 400, unit: 'g', food_category: 'meat', storage_location: 'fridge' }], error: null }
        : table === 'ziko_nutrition_logs'
          ? { data: seed.meals ?? [], error: null }
          : table === 'ziko_user_plugins'
            ? { data: seed.settings === undefined ? null : { settings: seed.settings }, error: null }
            : { data: null, error: null };
    const c = chain(value);
    const origEq = c.eq;
    c.eq = vi.fn((col: string, v: unknown) => {
      eqSpies.push([table, col, v]);
      return origEq(col, v);
    });
    return c;
  });
  return eqSpies;
}

const RECIPES = {
  recipes: [
    {
      id: 'poulet',
      name: 'Poulet',
      description: 'x',
      prep_time_min: 20,
      base_servings: 1,
      ingredients: [{ name: 'Filet de poulet', quantity: 200, unit: 'g' }],
      macros: { calories: 500, protein_g: 40, carbs_g: 10, fat_g: 10 },
      steps: ['a'],
    },
  ],
};

function buildApp() {
  const app = new Hono();
  app.route('/pantry', pantryRecipesRouter);
  return app;
}

function post(app: Hono, body: unknown = {}) {
  return app.request('/pantry/recipes/suggest', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const QUOTA_OK_FREE = { withinFreeQuota: true, dailyUsed: 0, dailyQuota: 1, balance: 0, earnHint: '' };
const QUOTA_PAID = { withinFreeQuota: false, dailyUsed: 1, dailyQuota: 1, balance: 5, earnHint: '' };
const QUOTA_EMPTY = { withinFreeQuota: false, dailyUsed: 1, dailyQuota: 1, balance: 0, earnHint: '' };

beforeEach(() => {
  vi.clearAllMocks();
  gateTables();
  mockGenerate.mockResolvedValue({ object: structuredClone(RECIPES) });
});

describe('POST /pantry/recipes/suggest - credits (D-08)', () => {
  it('402 insufficient_credits when quota is spent and balance < 1: the AI is not called', async () => {
    userTables();
    mockQuota.mockResolvedValue(QUOTA_EMPTY);
    const res = await post(buildApp());
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.error).toBe('insufficient_credits');
    expect(body.required).toBe(1);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockDeduct).not.toHaveBeenCalled();
  });

  it('paid generation: 200 and exactly 1 credit deducted for the recipes action', async () => {
    userTables();
    mockQuota.mockResolvedValue(QUOTA_PAID);
    const res = await post(buildApp());
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(mockDeduct).toHaveBeenCalledTimes(1));
    expect(mockDeduct.mock.calls[0][0]).toBe('user-1');
    expect(mockDeduct.mock.calls[0][1]).toBe('recipes');
  });

  it('free daily slot: 200, no deduction, usage tracked for the recipes action', async () => {
    userTables();
    mockQuota.mockResolvedValue(QUOTA_OK_FREE);
    const res = await post(buildApp());
    expect(res.status).toBe(200);
    expect(mockDeduct).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(vi.mocked(creditService.trackQuotaUsage)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(creditService.trackQuotaUsage).mock.calls[0][1]).toBe('recipes');
  });

  it('generation failure (5xx) is not charged', async () => {
    userTables();
    mockQuota.mockResolvedValue(QUOTA_PAID);
    mockGenerate.mockRejectedValue(new Error('boom'));
    const res = await post(buildApp());
    expect(res.status).toBeGreaterThanOrEqual(500);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockDeduct).not.toHaveBeenCalled();
  });
});

describe('POST /pantry/recipes/suggest - macros restantes (D-09, P-4)', () => {
  it('uses the user goals and the meals of the LOCAL date sent by the client; prompt carries the remaining macros', async () => {
    const eqSpies = userTables({
      settings: { calorie_goal: 2600, protein_goal: 180, carbs_goal: 300, fat_goal: 80 },
      meals: [
        { calories: 700, protein_g: 40, carbs_g: 80, fat_g: 20 },
        { calories: 740, protein_g: 62, carbs_g: 50, fat_g: 15 },
      ],
    });
    mockQuota.mockResolvedValue(QUOTA_OK_FREE);
    const res = await post(buildApp(), { date: '2026-11-12', preferences: 'rapide' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.remaining_macros).toEqual({ calories: 1160, protein_g: 78, carbs_g: 170, fat_g: 45 });
    // meals queried for the client's local date, not the server's UTC date
    expect(eqSpies).toContainEqual(['ziko_nutrition_logs', 'date', '2026-11-12']);
    expect(eqSpies).toContainEqual(['ziko_user_plugins', 'plugin_id', 'nutrition']);
    const prompt: string = mockGenerate.mock.calls[0][0].prompt;
    expect(prompt).toContain('Calories : 1160 kcal');
    expect(prompt).toContain('Protéines : 78g');
    expect(prompt).toContain('rapide');
  });

  it('falls back to the default targets when the user has no nutrition settings', async () => {
    userTables({ settings: undefined, meals: [{ calories: 500, protein_g: 30, carbs_g: 50, fat_g: 10 }] });
    mockQuota.mockResolvedValue(QUOTA_OK_FREE);
    const res = await post(buildApp(), {});
    const json = (await res.json()) as any;
    expect(json.remaining_macros).toEqual({ calories: 1500, protein_g: 120, carbs_g: 200, fat_g: 55 });
  });

  it('injects pantry_item_id server-side for ingredients that match a pantry item', async () => {
    userTables();
    mockQuota.mockResolvedValue(QUOTA_OK_FREE);
    const res = await post(buildApp());
    const json = (await res.json()) as any;
    expect(json.recipes[0].ingredients[0].pantry_item_id).toBe('p1');
  });
});
