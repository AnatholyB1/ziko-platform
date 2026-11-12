import { describe, it, expect } from 'vitest';
import {
  CATALOG_PAGE_SIZE,
  escapeLike,
  activeFilterCount,
  hasAnyFilter,
  formatShowButton,
  formatResultCount,
  toggleId,
  mapCatalogRow,
  fetchCatalogPage,
  fetchCatalogCount,
  EMPTY_FILTERS,
} from '../catalog';
import { formatFromPrice } from '../pricing';
import { fakeSupabase, callsOf } from './fakeSupabase';

describe('catalog helpers', () => {
  it('echappe les jokers LIKE', () => {
    expect(escapeLike('100%_pur\\')).toBe('100\\%\\_pur\\\\');
  });
  it('compteurs et libelles', () => {
    expect(activeFilterCount({ search: 'x', brandIds: ['a', 'b'], categoryIds: [] })).toBe(1);
    expect(activeFilterCount({ search: '', brandIds: ['a'], categoryIds: ['c'] })).toBe(2);
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, search: ' ' })).toBe(false);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, search: 'whey' })).toBe(true);
    expect(formatShowButton(38)).toBe('Afficher 38 produits');
    expect(formatShowButton(1)).toBe('Afficher 1 produit');
    expect(formatShowButton(0)).toBe('Aucun produit');
    expect(formatShowButton(null)).toBe('Afficher les produits');
    expect(formatResultCount(38)).toBe('38 produits');
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('mapCatalogRow (SU-2 : pas de NaN)', () => {
  it('prend le prix le plus bas valide', () => {
    const item = mapCatalogRow({
      id: '1',
      name: 'Magnésium',
      brand: { name: 'Lysa' },
      category: { name: 'Minéraux' },
      prices: [{ price: 16.9 }, { price: '14.90' }, { price: null }, { price: 0 }],
    });
    expect(item).toEqual({ id: '1', name: 'Magnésium', brandName: 'Lysa', categoryName: 'Minéraux', fromPrice: 14.9 });
    expect(formatFromPrice(item.fromPrice)).toBe('dès 14,90 €');
  });
  it('produit sans ligne de prix => Prix indisponible', () => {
    for (const prices of [[], undefined, null, [{ price: null }]]) {
      const item = mapCatalogRow({ id: '2', name: 'X', brand: null, category: null, prices });
      expect(item.fromPrice).toBeNull();
      expect(formatFromPrice(item.fromPrice)).toBe('Prix indisponible');
    }
  });
  it('ne lit pas les anciennes colonnes inexistantes (price_eur / per_serving_eur)', () => {
    const item = mapCatalogRow({ id: '3', name: 'Y', prices: [{ price_eur: 12, per_serving_eur: 0.3 }] });
    expect(item.fromPrice).toBeNull();
  });
});

describe('fetchCatalogPage', () => {
  const rows = [{ id: '1', name: 'A', brand: { name: 'B' }, category: { name: 'C' }, prices: [{ price: 10 }] }];

  it('construit recherche + filtres + pagination + compteur exact', async () => {
    const { client, log } = fakeSupabase(() => ({ data: rows, count: 38 }));
    const page = await fetchCatalogPage(client, { search: 'magn_', brandIds: ['b1', 'b2'], categoryIds: ['c1'] }, 2);
    expect(page.count).toBe(38);
    expect(page.items).toHaveLength(1);
    const { table, calls } = log[0];
    expect(table).toBe('ziko_supplements');
    expect(callsOf(calls, 'select')[0].args[1]).toEqual({ count: 'exact' });
    expect(callsOf(calls, 'ilike')[0].args).toEqual(['name', '%magn\\_%']);
    expect(callsOf(calls, 'in').map((c) => c.args)).toEqual([
      ['brand_id', ['b1', 'b2']],
      ['category_id', ['c1']],
    ]);
    expect(callsOf(calls, 'range')[0].args).toEqual([2 * CATALOG_PAGE_SIZE, 3 * CATALOG_PAGE_SIZE - 1]);
    // jointure de prix sur les VRAIES colonnes
    const sel = callsOf(calls, 'select')[0].args[0] as string;
    expect(sel).toContain('price, price_per_serving');
    expect(sel).not.toMatch(/price_eur|per_serving_eur/);
  });

  it('sans filtre : pas de ilike ni de in', async () => {
    const { client, log } = fakeSupabase(() => ({ data: [], count: 0 }));
    const page = await fetchCatalogPage(client, EMPTY_FILTERS, 0);
    expect(page).toEqual({ items: [], count: 0 });
    expect(callsOf(log[0].calls, 'ilike')).toHaveLength(0);
    expect(callsOf(log[0].calls, 'in')).toHaveLength(0);
  });

  it('propage une erreur Supabase', async () => {
    const { client } = fakeSupabase(() => ({ error: new Error('boom') }));
    await expect(fetchCatalogPage(client, EMPTY_FILTERS, 0)).rejects.toThrow('boom');
  });
});

describe('fetchCatalogCount (SU-3 : meme filtre que la liste)', () => {
  it('requete head + count exact avec les memes filtres', async () => {
    const { client, log } = fakeSupabase(() => ({ count: 38 }));
    const n = await fetchCatalogCount(client, { search: 'mag', brandIds: ['b1'], categoryIds: [] });
    expect(n).toBe(38);
    expect(callsOf(log[0].calls, 'select')[0].args).toEqual(['id', { count: 'exact', head: true }]);
    expect(callsOf(log[0].calls, 'ilike')[0].args).toEqual(['name', '%mag%']);
    expect(callsOf(log[0].calls, 'in')[0].args).toEqual(['brand_id', ['b1']]);
  });
});
