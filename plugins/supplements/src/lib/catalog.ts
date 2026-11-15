// SUPP-02 : catalogue pagine (30 par page), recherche live + filtres Marque/Categorie multi-choix,
// compteur exact. Requete Supabase directe (G-04) : on ne charge jamais les 1 624 lignes.
import { lowestPrice, type PriceInput } from './pricing';

export const CATALOG_PAGE_SIZE = 30;

export interface CatalogFilters {
  search: string;
  brandIds: readonly string[];
  categoryIds: readonly string[];
}

export interface CatalogItem {
  id: string;
  name: string;
  brandName: string | null;
  categoryName: string | null;
  fromPrice: number | null;
}

export const EMPTY_FILTERS: CatalogFilters = { search: '', brandIds: [], categoryIds: [] };

const SELECT =
  'id, name, serving_size, servings_per_container, ' +
  'brand:ziko_supplement_brands(id, name), category:ziko_supplement_categories(id, name), ' +
  'prices:ziko_supplement_prices(price, price_per_serving, in_stock)';

/** Echappe les jokers LIKE pour une recherche "contient". */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Nombre de filtres actifs (pastilles "Marque : 2"). */
export function activeFilterCount(f: CatalogFilters): number {
  return (f.brandIds.length > 0 ? 1 : 0) + (f.categoryIds.length > 0 ? 1 : 0);
}

export function hasAnyFilter(f: CatalogFilters): boolean {
  return f.search.trim() !== '' || f.brandIds.length > 0 || f.categoryIds.length > 0;
}

/** "Afficher 38 produits" / "Afficher 1 produit" / "Aucun produit". */
export function formatShowButton(count: number | null): string {
  if (count === null) return 'Afficher les produits';
  if (count <= 0) return 'Aucun produit';
  return `Afficher ${count} produit${count > 1 ? 's' : ''}`;
}

export function formatResultCount(count: number): string {
  return `${count} produit${count > 1 ? 's' : ''}`;
}

/** Ajoute / retire un id dans une selection multi-choix. */
export function toggleId(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

interface RawPrice {
  price: PriceInput;
  price_per_serving?: PriceInput;
  in_stock?: boolean | null;
}

export function mapCatalogRow(row: any): CatalogItem {
  const prices: RawPrice[] = Array.isArray(row?.prices) ? row.prices : [];
  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? ''),
    brandName: row?.brand?.name ?? null,
    categoryName: row?.category?.name ?? null,
    fromPrice: lowestPrice(prices),
  };
}

function applyFilters(query: any, f: CatalogFilters) {
  let q = query;
  const term = f.search.trim();
  if (term) q = q.ilike('name', `%${escapeLike(term)}%`);
  if (f.brandIds.length > 0) q = q.in('brand_id', [...f.brandIds]);
  if (f.categoryIds.length > 0) q = q.in('category_id', [...f.categoryIds]);
  return q;
}

export interface CatalogPage {
  items: CatalogItem[];
  count: number;
}

/** Une page de resultats + le compteur exact pour ces filtres. */
export async function fetchCatalogPage(supabase: any, filters: CatalogFilters, page: number): Promise<CatalogPage> {
  const from = page * CATALOG_PAGE_SIZE;
  const base = supabase.from('ziko_supplements').select(SELECT, { count: 'exact' });
  const { data, error, count } = await applyFilters(base, filters)
    .order('name', { ascending: true })
    .range(from, from + CATALOG_PAGE_SIZE - 1);
  if (error) throw error;
  const items = (data ?? []).map(mapCatalogRow);
  return { items, count: count ?? from + items.length };
}

/** Compteur seul (feuille de filtres : "Afficher N produits"), sans charger de lignes. */
export async function fetchCatalogCount(supabase: any, filters: CatalogFilters): Promise<number> {
  const base = supabase.from('ziko_supplements').select('id', { count: 'exact', head: true });
  const { count, error } = await applyFilters(base, filters);
  if (error) throw error;
  return count ?? 0;
}

export interface FilterOption {
  id: string;
  name: string;
}

export async function fetchFilterOptions(supabase: any): Promise<{ brands: FilterOption[]; categories: FilterOption[] }> {
  const [b, c] = await Promise.all([
    supabase.from('ziko_supplement_brands').select('id, name').order('name', { ascending: true }),
    supabase.from('ziko_supplement_categories').select('id, name, display_order').order('display_order', { ascending: true }),
  ]);
  if (b.error) throw b.error;
  if (c.error) throw c.error;
  return { brands: b.data ?? [], categories: c.data ?? [] };
}
