/**
 * Revue A #19 : "Ranger" n'est pas transactionnel cote client ; un echec a mi-chemin doit etre compense.
 * Faux client Supabase en memoire (aucune base). Ne prouve pas le comportement d'un vrai reseau coupe
 * pendant la compensation elle-meme.
 */
import { describe, it, expect } from 'vitest';
import { executeRanger } from '@ziko/plugin-pantry/utils/data';
import type { PantryRow } from '@ziko/plugin-pantry/utils/pantryLogic';

type Row = Record<string, any>;

function fakeDb(opts: { failShoppingDelete?: boolean; failInsert?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    ziko_pantry_items: [
      { id: 'p1', name: 'Lait', quantity: 1, expiration_date: '2026-11-01', user_id: 'u' },
      { id: 'p2', name: 'Oeufs', quantity: 6, expiration_date: null, user_id: 'u' },
    ],
    ziko_shopping_list_items: [{ id: 's1' }, { id: 's2' }],
  };
  let seq = 0;
  const from = (t: string) => ({
    update: (patch: Row) => ({
      eq: async (_c: string, id: string) => {
        const r = tables[t].find((x) => x.id === id);
        if (r) Object.assign(r, patch);
        return { error: null };
      },
    }),
    insert: (rows: Row[]) => ({
      select: async () => {
        if (opts.failInsert) return { data: null, error: { message: 'insert failed' } };
        const made = rows.map((r) => ({ ...r, id: `new-${++seq}` }));
        tables[t].push(...made);
        return { data: made.map((m) => ({ id: m.id })), error: null };
      },
    }),
    delete: () => ({
      eq: async (_c: string, id: string) => {
        if (t === 'ziko_shopping_list_items' && opts.failShoppingDelete) return { error: { message: 'delete failed' } };
        tables[t] = tables[t].filter((x) => x.id !== id);
        return { error: null };
      },
      in: async (_c: string, ids: string[]) => {
        tables[t] = tables[t].filter((x) => !ids.includes(x.id));
        return { error: null };
      },
    }),
  });
  return { client: { from }, tables };
}

const before: PantryRow[] = [
  { id: 'p1', name: 'Lait', quantity: 1, unit: 'L', storage_location: 'fridge', expiration_date: '2026-11-01', low_stock_threshold: 1 },
  { id: 'p2', name: 'Oeufs', quantity: 6, unit: 'pieces', storage_location: 'fridge', expiration_date: null, low_stock_threshold: 2 },
];
const plan = {
  updates: [{ id: 'p1', quantity: 3, clearExpiry: true }, { id: 'p2', quantity: 12, clearExpiry: false }],
  inserts: [{ name: 'Farine', quantity: 1, unit: 'kg', storage_location: 'cupboard' as const, food_category: 'other' as const, low_stock_threshold: 1 }],
  deleteShoppingIds: ['s1', 's2'],
};

describe('executeRanger', () => {
  it('chemin nominal : stock mis a jour, ligne ajoutee, courses supprimees', async () => {
    const { client, tables } = fakeDb();
    await executeRanger(client, 'u', plan, before);
    expect(tables.ziko_pantry_items.find((r) => r.id === 'p1')).toMatchObject({ quantity: 3, expiration_date: null });
    expect(tables.ziko_pantry_items.some((r) => r.name === 'Farine')).toBe(true);
    expect(tables.ziko_shopping_list_items).toEqual([]);
  });

  it('echec de la suppression des courses : stock restaure, ligne ajoutee retiree, erreur remontee', async () => {
    const { client, tables } = fakeDb({ failShoppingDelete: true });
    await expect(executeRanger(client, 'u', plan, before)).rejects.toMatchObject({ message: 'delete failed' });
    expect(tables.ziko_pantry_items.find((r) => r.id === 'p1')).toMatchObject({ quantity: 1, expiration_date: '2026-11-01' });
    expect(tables.ziko_pantry_items.find((r) => r.id === 'p2')).toMatchObject({ quantity: 6 });
    expect(tables.ziko_pantry_items.some((r) => r.name === 'Farine')).toBe(false);
    expect(tables.ziko_shopping_list_items).toHaveLength(2); // l'article reste "a ranger" : un retry ne double pas le stock
  });

  it('echec de l\'ajout : les mises a jour deja faites sont annulees', async () => {
    const { client, tables } = fakeDb({ failInsert: true });
    await expect(executeRanger(client, 'u', plan, before)).rejects.toMatchObject({ message: 'insert failed' });
    expect(tables.ziko_pantry_items.find((r) => r.id === 'p1')).toMatchObject({ quantity: 1, expiration_date: '2026-11-01' });
    expect(tables.ziko_shopping_list_items).toHaveLength(2);
  });
});
