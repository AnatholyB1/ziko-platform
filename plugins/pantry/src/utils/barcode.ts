import { normalizeUnit, type FoodCategory, type PantryUnit } from './pantryLogic';

const OFF_FIELDS = 'product_name,product_name_fr,quantity,categories_tags,nutriments';
const OFF_URL = (barcode: string) =>
  `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(barcode)}?fields=${OFF_FIELDS}`;

/** Ce que le scan sait pre-remplir dans le formulaire d'ajout (D-11). */
export interface BarcodeProduct {
  barcode: string;
  name: string;
  quantity: number;
  unit: PantryUnit;
  /** true quand la quantite vient de la fiche produit (sinon 1 piece par defaut) */
  quantityFromProduct: boolean;
  food_category: FoodCategory;
  /** kcal pour 100 g, quand la fiche le donne (information, non stockee) */
  kcal100g: number | null;
}

/** `500 g` -> 500 g ; `1 L` -> 1 L ; `75 cl` -> 750 ml ; `1,5 kg` -> 1.5 kg ; sinon null (=> 1 piece). */
export function parseOffQuantity(raw: unknown): { quantity: number; unit: PantryUnit } | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|dl|l)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  switch (m[2]) {
    case 'cl': return { quantity: n * 10, unit: 'ml' };
    case 'dl': return { quantity: n * 100, unit: 'ml' };
    case 'l': return { quantity: n, unit: 'L' };
    default: return { quantity: n, unit: normalizeUnit(m[2]) };
  }
}

// Premier motif trouve dans categories_tags (`en:dairies`, `en:meats`...) -> categorie du garde-manger.
const CATEGORY_RULES: Array<[RegExp, FoodCategory]> = [
  [/eggs?\b/, 'eggs'],
  [/dair|milk|cheese|yogh?urt|butter|cream|skyr/, 'dairy'],
  [/fish|seafood|tuna|salmon/, 'fish_seafood'],
  [/meat|poultry|chicken|beef|pork|sausage|ham\b/, 'meat'],
  [/vegetable|legume/, 'vegetables'],
  [/fruit/, 'fruits'],
  [/pasta|rice|cereal|bread|flour|grain|noodle/, 'grains_pasta'],
  [/beverage|drink|water|juice|soda|tea\b|coffee/, 'drinks'],
  [/snack|biscuit|chocolate|sweet|candy|cookie|spread|confection/, 'snacks'],
];

export function mapOffCategory(tags: unknown): FoodCategory {
  if (!Array.isArray(tags)) return 'other';
  const joined = tags.filter((t): t is string => typeof t === 'string').join(' ').toLowerCase();
  for (const [re, cat] of CATEGORY_RULES) if (re.test(joined)) return cat;
  return 'other';
}

/** Transforme la reponse Open Food Facts (deja parsee) en pre-remplissage ; null si produit inconnu. */
export function parseOffProduct(barcode: string, json: any): BarcodeProduct | null {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const name = String(p.product_name_fr || p.product_name || '').trim();
  if (!name) return null;
  const q = parseOffQuantity(p.quantity);
  const kcalRaw = p.nutriments?.['energy-kcal_100g'];
  const kcal = typeof kcalRaw === 'number' && Number.isFinite(kcalRaw) ? Math.round(kcalRaw) : null;
  return {
    barcode,
    name,
    quantity: q ? q.quantity : 1,
    unit: q ? q.unit : 'pieces',
    quantityFromProduct: !!q,
    food_category: mapOffCategory(p.categories_tags),
    kcal100g: kcal,
  };
}

export async function lookupBarcode(barcode: string, timeoutMs = 8000): Promise<BarcodeProduct | null> {
  // Timeout 8 s : hors couverture, le formulaire ne doit pas attendre indefiniment (revue A #20).
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(OFF_URL(barcode), controller ? { signal: controller.signal } : undefined);
    const json = await res.json();
    return parseOffProduct(barcode, json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
