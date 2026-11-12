/**
 * Phase 10 (v1.20) - Garde-manger : rendu React (happy-dom, composants RN remplaces par des stubs DOM).
 * Prouve : filtre par lieu sans alerte (P-1), onglets francais et 0 mot anglais (P-2), fiche article,
 * courses calculees + ranger (P-5), recettes : macros restantes affichees, cout lu des props, 402 (P-4).
 * Ne prouve PAS : l'apparence native, les cibles tactiles, la camera, ni le comportement sur emulateur.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { routerCalls } from './stubs/expo-router';
import PantryPlugin from '../../../../../plugins/pantry/src/screens/PantryPlugin';
import { usePantryStore } from '../../../../../plugins/pantry/src/store';
import { todayLocalISO } from '../../../../../plugins/pantry/src/utils/pantryLogic';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Row = Record<string, any>;

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayLocalISO(d);
}

/** Faux client Supabase en memoire : select/eq/order/maybeSingle/single + insert/update/delete. */
function fakeSupabase(seed: Record<string, Row[]>, opts: { failTable?: string } = {}) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  let n = 0;
  const client = {
    tables,
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    },
    from(table: string) {
      tables[table] ??= [];
      const filters: Array<[string, unknown]> = [];
      let mode: 'select' | 'update' | 'delete' | 'insert' = 'select';
      let patch: Row = {};
      let inserted: Row[] = [];
      const run = () => {
        if (opts.failTable === table) return { data: null, error: { message: 'boom' } };
        const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
        if (mode === 'update') {
          tables[table].filter(match).forEach((r) => Object.assign(r, patch));
          return { data: null, error: null };
        }
        if (mode === 'delete') {
          tables[table] = tables[table].filter((r) => !match(r));
          return { data: null, error: null };
        }
        if (mode === 'insert') return { data: inserted, error: null };
        return { data: tables[table].filter(match), error: null };
      };
      const chain: any = {
        select: () => chain,
        eq: (k: string, v: unknown) => (filters.push([k, v]), chain),
        order: () => chain,
        gte: () => chain,
        maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
        single: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
        insert: (rows: Row | Row[]) => {
          mode = 'insert';
          inserted = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: `new${++n}`, created_at: new Date().toISOString(), ...r }));
          if (opts.failTable !== table) tables[table].push(...inserted);
          return chain;
        },
        update: (p: Row) => ((mode = 'update'), (patch = p), chain),
        delete: () => ((mode = 'delete'), chain),
        then: (res: any, rej?: any) => Promise.resolve(run()).then(res, rej),
      };
      return chain;
    },
  };
  return client;
}

function item(id: string, name: string, extra: Row = {}): Row {
  return {
    id, user_id: 'u1', name, quantity: 1, unit: 'pieces', storage_location: 'fridge', food_category: 'other',
    expiration_date: null, low_stock_threshold: 0.5, created_at: '2026-11-01T00:00:00Z', ...extra,
  };
}

const SEED_ITEMS: Row[] = [
  item('a1', 'Lait demi-écrémé', { quantity: 0.2, unit: 'L', expiration_date: addDays(1), low_stock_threshold: 0.5 }),
  item('a2', 'Oeufs', { quantity: 6, expiration_date: addDays(9) }),
  item('a3', 'Filet de poulet', { quantity: 400, unit: 'g', expiration_date: addDays(2) }),
  item('b1', 'Petits pois surgelés', { quantity: 500, unit: 'g', storage_location: 'freezer' }),
  item('c1', 'Riz basmati', { quantity: 1, unit: 'kg', storage_location: 'pantry' }),
  item('c2', 'Pâtes complètes', { quantity: 2, unit: 'kg', storage_location: 'pantry' }),
];

async function mount(supabase: any, props: Record<string, unknown> = {}) {
  usePantryStore.setState({ items: [], recipes: [], recipesLoading: false, recipesError: null, shoppingItems: [] } as any);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <PantryPlugin supabase={supabase} {...props} />
      </QueryClientProvider>,
    );
  });
  await settle();
  return { container, root };
}

async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
}

function button(container: HTMLElement, text: string | RegExp): HTMLElement {
  const found = Array.from(container.querySelectorAll('button')).find((b) =>
    typeof text === 'string' ? (b.textContent ?? '').includes(text) : text.test(b.textContent ?? ''),
  );
  if (!found) throw new Error(`button not found: ${String(text)} in ${container.textContent}`);
  return found as HTMLElement;
}

async function click(el: HTMLElement) {
  await act(async () => { el.click(); });
  await settle();
}

const FORBIDDEN = /\b(pantry|shopping|low stock|out of stock|add item|save|delete|cancel|retry|loading|recipes)\b/i;

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Garde-manger : inventaire (P-1, P-2)', () => {
  it('shows the French title and the 3 French tabs, no English word anywhere', async () => {
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: SEED_ITEMS }));
    const text = container.textContent ?? '';
    expect(text).toContain('Garde-manger');
    for (const label of ['Inventaire', 'Recettes', 'Courses']) expect(text).toContain(label);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/Pantry/);
  });

  it('location chips carry the real counts and tapping one filters the list (no alert, no navigation)', async () => {
    routerCalls.length = 0;
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: SEED_ITEMS }));
    const text = () => container.textContent ?? '';
    expect(text()).toContain('Frigo 3');
    expect(text()).toContain('Congélateur 1');
    expect(text()).toContain('Placard 2');
    // starts on the first non-empty location: only fridge items
    expect(text()).toContain('Filet de poulet');
    expect(text()).not.toContain('Riz basmati');

    await click(button(container, 'Placard 2'));
    expect(text()).toContain('Riz basmati');
    expect(text()).toContain('Pâtes complètes');
    expect(text()).not.toContain('Filet de poulet');
    expect(routerCalls.filter((c) => c.method === 'push')).toHaveLength(0);

    await click(button(container, 'Congélateur 1'));
    expect(text()).toContain('Petits pois surgelés');
    expect(text()).not.toContain('Riz basmati');
  });

  it('expiry is a text badge: EXPIRE DEMAIN / DANS 2 J / dans 9 j', async () => {
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: SEED_ITEMS }));
    const text = container.textContent ?? '';
    expect(text).toContain('EXPIRE DEMAIN');
    expect(text).toContain('DANS 2 J');
    expect(text).toContain('dans 9 j');
  });

  it('empty pantry: French empty state with the two add paths', async () => {
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: [] }));
    const text = container.textContent ?? '';
    expect(text).toContain('Ton garde-manger est vide');
    expect(text).toContain('Scanner un code-barres');
    expect(text).toContain('Ajouter à la main');
    routerCalls.length = 0;
    await click(button(container, 'Scanner un code-barres'));
    const push = routerCalls.find((c) => c.method === 'push')!;
    expect(JSON.stringify(push.args)).toContain('"scan":"1"');
  });

  it('tapping an item opens its sheet; Utiliser decrements the stock in the database', async () => {
    const db = fakeSupabase({ ziko_pantry_items: SEED_ITEMS });
    const { container } = await mount(db);
    await click(button(container, 'Filet de poulet'));
    const text = container.textContent ?? '';
    expect(text).toContain('Aux courses');
    expect(text).toContain('Utiliser');
    expect(text).toContain('Retirer du garde-manger');
    await click(button(container, 'Utiliser'));
    expect(db.tables.ziko_pantry_items.find((r) => r.id === 'a3')!.quantity).toBe(350);
  });

  it('a failed load shows an error card with a retry, not a blank screen', async () => {
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: SEED_ITEMS }, { failTable: 'ziko_pantry_items' }));
    expect(container.textContent).toContain('Impossible de charger le garde-manger');
    expect(container.textContent).toContain('Réessayer');
  });
});

describe('Garde-manger : courses (P-5)', () => {
  it('lists the low / expiring items with their reason, then Ranger restocks the inventory', async () => {
    const db = fakeSupabase({ ziko_pantry_items: SEED_ITEMS, ziko_shopping_list_items: [] });
    const { container } = await mount(db, { initialTab: 'shopping' });
    const text = () => container.textContent ?? '';
    expect(text()).toContain('Il manque dans ton frigo');
    expect(text()).toContain('Lait demi-écrémé');
    expect(text()).toContain('Stock bas, expire demain');
    expect(text()).not.toContain('Ranger');

    const box = container.querySelector('[data-testid="shopping-checkbox"]') as HTMLElement;
    expect(box).toBeTruthy();
    await click(box);
    expect(text()).toContain('Ranger 1 article dans le garde-manger');
    await click(button(container, 'Ranger 1 article'));
    // restock: 0.2 L + 1 (threshold 0.5 -> min 1) = 1.2
    expect(db.tables.ziko_pantry_items.find((r) => r.id === 'a1')!.quantity).toBeCloseTo(1.2, 5);
    expect(text()).toContain('1 article rangé dans le garde-manger');
  });

  it('manual lines go to "Ajoutés par moi"; ranger moves them into the inventory and removes the list line', async () => {
    const db = fakeSupabase({
      ziko_pantry_items: [item('x1', 'Riz', { quantity: 5, unit: 'kg', storage_location: 'pantry' })],
      ziko_shopping_list_items: [
        { id: 's1', user_id: 'u1', name: 'Pastilles lave-vaisselle', quantity: 1, unit: 'pieces', pantry_item_id: null, source: 'manual', recipe_name: null, created_at: '2026-11-12T10:00:00Z' },
      ],
    });
    const { container } = await mount(db, { initialTab: 'shopping' });
    expect(container.textContent).toContain('Ajoutés par moi');
    expect(container.textContent).toContain('Pastilles lave-vaisselle');
    expect(container.textContent).not.toContain('Il manque dans ton frigo');
    const box = container.querySelector('[data-testid="shopping-checkbox"]') as HTMLElement;
    await click(box);
    await click(button(container, 'Ranger 1 article'));
    expect(db.tables.ziko_shopping_list_items).toHaveLength(0);
    expect(db.tables.ziko_pantry_items.some((r) => r.name === 'Pastilles lave-vaisselle' && r.user_id === 'u1')).toBe(true);
  });

  it('nothing to buy: French empty state', async () => {
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: [item('x', 'Riz', { quantity: 5 })], ziko_shopping_list_items: [] }), { initialTab: 'shopping' });
    expect(container.textContent).toContain('Rien à acheter');
  });
});

describe('Garde-manger : recettes IA (P-4)', () => {
  const RECIPE = {
    id: 'poulet', name: 'Poulet crémeux au brocoli', description: 'x', prep_time_min: 25, base_servings: 1,
    ingredients: [
      { name: 'Filet de poulet', quantity: 200, unit: 'g', pantry_item_id: 'a3' },
      { name: 'Crème légère', quantity: 10, unit: 'cl' },
    ],
    macros: { calories: 620, protein_g: 52, carbs_g: 20, fat_g: 25 },
    steps: ['a'],
  };
  const seed = () => ({
    ziko_pantry_items: SEED_ITEMS,
    ziko_user_plugins: [{ user_id: 'u1', plugin_id: 'nutrition', settings: { calorie_goal: 2600, protein_goal: 180 } }],
    ziko_nutrition_logs: [{ user_id: 'u1', date: todayLocalISO(), calories: 1440, protein_g: 102, carbs_g: 100, fat_g: 30 }],
  });

  it('shows the remaining macros before generating and the cost from props on the button', async () => {
    const { container } = await mount(fakeSupabase(seed()), { initialTab: 'recipes', recipeCreditCost: 1 });
    const text = container.textContent ?? '';
    expect(text).toContain("Il te reste aujourd'hui");
    expect(text).toContain('1 160');
    expect(text).toContain('78');
    expect(text).toContain('Générer des recettes · 1 crédit');
    const two = await mount(fakeSupabase(seed()), { initialTab: 'recipes', recipeCreditCost: 3 });
    expect(two.container.textContent).toContain('Générer des recettes · 3 crédits');
  });

  it('generation posts the LOCAL date and shows availability + what is missing', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ recipes: [RECIPE], remaining_macros: { calories: 1160, protein_g: 78, carbs_g: 160, fat_g: 35 } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = await mount(fakeSupabase(seed()), { initialTab: 'recipes' });
    await click(button(container, 'Générer des recettes'));
    const call = fetchMock.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(call[0]).toContain('/pantry/recipes/suggest');
    expect(JSON.parse(call[1].body).date).toBe(todayLocalISO());
    expect(call[1].headers.Authorization).toBe('Bearer tok');
    const text = container.textContent ?? '';
    expect(text).toContain('Poulet crémeux au brocoli');
    expect(text).toContain('1 sur 2 ingrédients');
    expect(text).toContain('Manque : Crème légère');
    expect(text).toContain('rentre dans tes macros');
  });

  it('402 shows the credits-exhausted card instead of recipes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 402, json: async () => ({ error: 'insufficient_credits', balance: 0, required: 1 }) })));
    const { container } = await mount(fakeSupabase(seed()), { initialTab: 'recipes' });
    await click(button(container, 'Générer des recettes'));
    expect(container.textContent).toContain('Crédits épuisés');
    expect(container.textContent).not.toContain('Poulet');
  });

  it('server error shows a French error card with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'x' }) })));
    const { container } = await mount(fakeSupabase(seed()), { initialTab: 'recipes' });
    await click(button(container, 'Générer des recettes'));
    expect(container.textContent).toContain('Impossible de générer des recettes');
    expect(container.textContent).toContain('Réessayer');
  });

  it('with an empty pantry the screen says so instead of offering a generation', async () => {
    const { container } = await mount(fakeSupabase({ ziko_pantry_items: [] }), { initialTab: 'recipes' });
    expect(container.textContent).toContain('Ajoute des articles à ton garde-manger');
  });
});
