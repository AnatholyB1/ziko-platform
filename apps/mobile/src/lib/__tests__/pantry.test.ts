/**
 * Phase 10 (v1.20) - Garde-manger : logique pure (PANT-01..07).
 * Ne prouve PAS : le rendu natif, la camera, la couverture reelle d'Open Food Facts (fetch mocke), la base.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  countByLocation, filterByLocation, filterBySearch, expiryBadge, daysUntil, formatShortDateFr,
  computeMissing, planRanger, recipeAvailability, fitsRemainingMacros, normalizeUnit, formatQuantity,
  formatThousands, missingIngredientRows, todayLocalISO, stepQuantity, remainingFromSettings, type PantryRow,
} from '@ziko/plugin-pantry/utils/pantryLogic';
import {
  parseOffQuantity, parseOffProduct, mapOffCategory, lookupBarcode,
} from '@ziko/plugin-pantry/utils/barcode';
import { COPY, allCopyStrings } from '@ziko/plugin-pantry/utils/copy';

const TODAY = '2026-11-12';

function item(p: Partial<PantryRow> & { id: string; name: string }): PantryRow {
  return {
    quantity: 1, unit: 'pieces', storage_location: 'fridge', food_category: 'other',
    expiration_date: null, low_stock_threshold: 1, ...p,
  } as PantryRow;
}

// 12 articles : 5 frigo, 2 congelateur, 5 placard ; un expire demain, un sous le seuil
const SEED: PantryRow[] = [
  item({ id: 'a1', name: 'Lait demi-écrémé', quantity: 0.2, unit: 'L', expiration_date: '2026-11-13', low_stock_threshold: 0.5 }),
  item({ id: 'a2', name: 'Oeufs', quantity: 6, expiration_date: '2026-11-21', low_stock_threshold: 2 }),
  item({ id: 'a3', name: 'Filet de poulet', quantity: 400, unit: 'g', expiration_date: '2026-11-14', low_stock_threshold: 100 }),
  item({ id: 'a4', name: 'Skyr nature', quantity: 3, expiration_date: '2026-11-24', low_stock_threshold: 1 }),
  item({ id: 'a5', name: 'Brocoli', quantity: 1, expiration_date: '2026-11-17', low_stock_threshold: 0.5 }),
  item({ id: 'b1', name: 'Petits pois', quantity: 500, unit: 'g', storage_location: 'freezer', low_stock_threshold: 100 }),
  item({ id: 'b2', name: 'Saumon', quantity: 300, unit: 'g', storage_location: 'freezer', low_stock_threshold: 100 }),
  item({ id: 'c1', name: 'Riz', quantity: 1, unit: 'kg', storage_location: 'pantry', low_stock_threshold: 0.2 }),
  item({ id: 'c2', name: 'Pâtes', quantity: 2, unit: 'kg', storage_location: 'pantry', low_stock_threshold: 0.5 }),
  item({ id: 'c3', name: 'Huile', quantity: 1, unit: 'L', storage_location: 'pantry', low_stock_threshold: 0.2 }),
  item({ id: 'c4', name: 'Conserve de thon', quantity: 4, unit: 'can', storage_location: 'pantry', low_stock_threshold: 1 }),
  item({ id: 'c5', name: 'Yaourt périmé', quantity: 1, expiration_date: '2026-11-08', storage_location: 'pantry', low_stock_threshold: 0.5 }),
];

describe('P-1 lieux : compteurs reels et filtre', () => {
  it('counts per location match the data', () => {
    expect(countByLocation(SEED)).toEqual({ fridge: 5, freezer: 2, pantry: 5 });
  });
  it('filtering by a location returns only that location, soonest expiry first', () => {
    const fridge = filterByLocation(SEED, 'fridge');
    expect(fridge.map((i) => i.id)).toEqual(['a1', 'a3', 'a5', 'a2', 'a4']);
    expect(filterByLocation(SEED, 'freezer').map((i) => i.id).sort()).toEqual(['b1', 'b2']);
    expect(filterByLocation(SEED, null)).toHaveLength(12);
  });
  it('unknown location falls back to the cupboard instead of vanishing', () => {
    expect(countByLocation([item({ id: 'z', name: 'x', storage_location: 'cave' })]).pantry).toBe(1);
  });
  it('search ignores accents and case', () => {
    expect(filterBySearch(SEED, 'PATES').map((i) => i.id)).toEqual(['c2']);
    expect(filterBySearch(SEED, 'ecreme').map((i) => i.id)).toEqual(['a1']);
    expect(filterBySearch(SEED, '  ')).toHaveLength(12);
  });
});

describe('badges de peremption (texte, B14)', () => {
  it.each([
    ['2026-11-13', 'EXPIRE DEMAIN', 'danger'],
    ['2026-11-12', "EXPIRE AUJOURD'HUI", 'danger'],
    ['2026-11-14', 'DANS 2 J', 'warning'],
    ['2026-11-21', 'dans 9 j', 'ok'],
    ['2026-11-24', 'dans 12 j', 'ok'],
    ['2026-11-08', 'EXPIRÉ', 'danger'],
  ])('%s -> %s', (date, text, tone) => {
    expect(expiryBadge(date, TODAY)).toEqual({ text, tone });
  });
  it('no date -> no badge; month boundaries are exact', () => {
    expect(expiryBadge(null, TODAY)).toBeNull();
    expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1);
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
  });
  it('formats short French dates and uses local date for today', () => {
    expect(formatShortDateFr('2026-11-14')).toBe('14 nov.');
    expect(formatShortDateFr('2026-09-03')).toBe('3 sept.');
    expect(todayLocalISO(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12');
  });
});

describe('P-5 courses : Il manque (calcule, avec raison)', () => {
  it('lists every item under threshold, empty or expired, with its reason', () => {
    const missing = computeMissing(SEED, TODAY);
    const byName = Object.fromEntries(missing.map((m) => [m.name, m]));
    expect(Object.keys(byName).sort()).toEqual(['Lait demi-écrémé', 'Yaourt périmé']);
    expect(byName['Lait demi-écrémé'].reason).toBe('Stock bas, expire demain');
    expect(byName['Yaourt périmé'].reason).toBe('Expiré');
    expect(byName['Yaourt périmé'].expired).toBe(true);
  });
  it('an empty item is "Épuisé"; a healthy near-expiry item is NOT listed', () => {
    const m = computeMissing([item({ id: 'q', name: 'Beurre', quantity: 0 }), item({ id: 'r', name: 'Fromage', quantity: 5, expiration_date: '2026-11-13' })], TODAY);
    expect(m.map((x) => [x.name, x.reason])).toEqual([['Beurre', 'Épuisé']]);
  });
  it('threshold null never counts as low unless the item is empty', () => {
    expect(computeMissing([item({ id: 'n', name: 'Sel', quantity: 1, low_stock_threshold: null })], TODAY)).toHaveLength(0);
  });
});

describe('P-5 ranger : coche -> inventaire', () => {
  const pantry = [item({ id: 'a1', name: 'Lait', quantity: 0.2, unit: 'L', low_stock_threshold: 0.5 }), item({ id: 'c5', name: 'Yaourt', quantity: 1, expiration_date: '2026-11-08' })];
  it('restocks an existing low item by adding the bought quantity', () => {
    const [lait] = computeMissing(pantry, TODAY);
    const plan = planRanger({ autoChecked: [lait], rows: [], pantry });
    expect(plan.updates).toEqual([{ id: 'a1', quantity: 0.2 + 1, clearExpiry: false }]);
    expect(plan.inserts).toEqual([]);
  });
  it('an expired item bought again resets quantity and clears the old date', () => {
    const yaourt = computeMissing(pantry, TODAY).find((m) => m.name === 'Yaourt')!;
    const plan = planRanger({ autoChecked: [yaourt], rows: [], pantry });
    expect(plan.updates).toEqual([{ id: 'c5', quantity: 1, clearExpiry: true }]);
  });
  it('a manual line with an unknown name becomes a new stock row and is deleted from the list', () => {
    const plan = planRanger({
      autoChecked: [],
      rows: [{ id: 's1', name: 'Pastilles lave-vaisselle', quantity: null, unit: null, pantry_item_id: null, source: 'manual', recipe_name: null }],
      pantry,
    });
    expect(plan.inserts).toEqual([{ name: 'Pastilles lave-vaisselle', quantity: 1, unit: 'pieces', storage_location: 'pantry', food_category: 'other', low_stock_threshold: 1 }]);
    expect(plan.deleteShoppingIds).toEqual(['s1']);
  });
  it('a manual line matching an existing item by name (accents/case) adds to it', () => {
    const plan = planRanger({
      autoChecked: [],
      rows: [{ id: 's2', name: 'LAIT', quantity: 2, unit: 'L', pantry_item_id: null, source: 'manual', recipe_name: null }],
      pantry,
    });
    expect(plan.updates).toEqual([{ id: 'a1', quantity: 2.2, clearExpiry: false }]);
  });
  it('two lines for the same unknown product merge into one insert; AI units are normalised', () => {
    const rows = [
      { id: 'r1', name: 'Crème légère', quantity: 20, unit: 'cl', pantry_item_id: null, source: 'recipe' as const, recipe_name: 'Poulet' },
      { id: 'r2', name: 'creme legere', quantity: 5, unit: 'pièces', pantry_item_id: null, source: 'manual' as const, recipe_name: null },
    ];
    const plan = planRanger({ autoChecked: [], rows, pantry });
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].quantity).toBe(25);
    expect(plan.inserts[0].unit).toBe('pieces');
    expect(plan.deleteShoppingIds).toEqual(['r1', 'r2']);
  });
});

describe('unites et formats', () => {
  it('normalizeUnit maps free text to the SQL-allowed set', () => {
    expect(normalizeUnit('L')).toBe('L');
    expect(normalizeUnit('litre')).toBe('L');
    expect(normalizeUnit('pièces')).toBe('pieces');
    expect(normalizeUnit('cuillères')).toBe('pieces');
    expect(normalizeUnit(null)).toBe('pieces');
    expect(normalizeUnit('boîte')).toBe('box');
  });
  it('formatQuantity pluralises French units', () => {
    expect(formatQuantity(6, 'pieces')).toBe('6 pièces');
    expect(formatQuantity(1, 'pieces')).toBe('1 pièce');
    expect(formatQuantity(400, 'g')).toBe('400 g');
    expect(formatQuantity(0.5, 'L')).toBe('0,5 L');
    expect(formatQuantity(3, 'box')).toBe('3 boîtes');
  });
  it('formatThousands', () => {
    expect(formatThousands(1160)).toBe('1 160');
    expect(formatThousands(78)).toBe('78');
  });
});

describe('P-3 scan : pre-remplissage depuis Open Food Facts', () => {
  it.each([
    ['500 g', { quantity: 500, unit: 'g' }],
    ['1 L', { quantity: 1, unit: 'L' }],
    ['1,5 kg', { quantity: 1.5, unit: 'kg' }],
    ['75 cl', { quantity: 750, unit: 'ml' }],
    ['330ml', { quantity: 330, unit: 'ml' }],
  ])('parses %s', (raw, expected) => {
    expect(parseOffQuantity(raw)).toEqual(expected);
  });
  it('returns null for non-weights so the form defaults to 1 piece', () => {
    expect(parseOffQuantity('6 x 25 cl')).toBeNull();
    expect(parseOffQuantity('')).toBeNull();
    expect(parseOffQuantity(undefined)).toBeNull();
  });
  it('maps OFF category tags to pantry categories, fallback other', () => {
    expect(mapOffCategory(['en:dairies', 'en:milks'])).toBe('dairy');
    expect(mapOffCategory(['en:meats', 'en:poultry'])).toBe('meat');
    expect(mapOffCategory(['en:spreads', 'en:sweet-spreads'])).toBe('snacks');
    expect(mapOffCategory(['en:unknown-thing'])).toBe('other');
    expect(mapOffCategory(undefined)).toBe('other');
  });
  it('known product: at least name and quantity are pre-filled (P-3)', () => {
    const p = parseOffProduct('3017620422003', {
      status: 1,
      product: { product_name_fr: 'Pâte à tartiner noisettes', quantity: '400 g', categories_tags: ['en:spreads'], nutriments: { 'energy-kcal_100g': 539 } },
    });
    expect(p).toMatchObject({ barcode: '3017620422003', name: 'Pâte à tartiner noisettes', quantity: 400, unit: 'g', quantityFromProduct: true, food_category: 'snacks', kcal100g: 539 });
  });
  it('known product without usable quantity: 1 piece by default, flagged as not from product', () => {
    const p = parseOffProduct('1', { status: 1, product: { product_name: 'Yaourt', quantity: '4 x 125 g' } });
    expect(p).toMatchObject({ name: 'Yaourt', quantity: 1, unit: 'pieces', quantityFromProduct: false, kcal100g: null });
  });
  it('unknown product / nameless product / garbage -> null (manual entry path)', () => {
    expect(parseOffProduct('0', { status: 0 })).toBeNull();
    expect(parseOffProduct('0', { status: 1, product: { quantity: '1 L' } })).toBeNull();
    expect(parseOffProduct('0', null)).toBeNull();
  });
  describe('lookupBarcode (fetch mocke)', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('requests the extended OFF fields and returns the parsed product', async () => {
      const fetchMock = vi.fn(async () => ({ json: async () => ({ status: 1, product: { product_name: 'Lait', quantity: '1 L' } }) }));
      vi.stubGlobal('fetch', fetchMock);
      const p = await lookupBarcode('123');
      expect(p?.quantity).toBe(1);
      const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
      expect(url).toContain('quantity');
      expect(url).toContain('categories_tags');
    });
    it('network failure -> null, never throws', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      await expect(lookupBarcode('123')).resolves.toBeNull();
    });
  });
});

describe('P-4 recettes : disponibilite et macros', () => {
  const recipe = {
    id: 'r', name: 'Poulet crémeux au brocoli',
    ingredients: [
      { name: 'Filet de poulet', quantity: 200, unit: 'g', pantry_item_id: 'a3' },
      { name: 'Brocoli', quantity: 1, unit: 'pieces', pantry_item_id: 'a5' },
      { name: 'Crème légère', quantity: 10, unit: 'cl' },
    ],
    macros: { calories: 620, protein_g: 52, carbs_g: 20, fat_g: 25 },
  };
  it('counts available vs missing ingredients', () => {
    const a = recipeAvailability(recipe, SEED);
    expect(a).toEqual({ available: 2, total: 3, missing: ['Crème légère'] });
  });
  it('an ingredient whose pantry item is empty counts as missing', () => {
    const a = recipeAvailability(recipe, SEED.map((i) => (i.id === 'a5' ? { ...i, quantity: 0 } : i)));
    expect(a.missing).toEqual(['Brocoli', 'Crème légère']);
  });
  it('fits remaining macros by calories; no budget = does not claim to fit', () => {
    expect(fitsRemainingMacros(recipe, { calories: 1160, protein_g: 78 })).toBe(true);
    expect(fitsRemainingMacros(recipe, { calories: 500, protein_g: 78 })).toBe(false);
    expect(fitsRemainingMacros(recipe, null)).toBe(false);
  });
  it('builds shopping rows for the missing ingredients only', () => {
    expect(missingIngredientRows(recipe, SEED)).toEqual([{ name: 'Crème légère', quantity: 10, unit: 'cl', recipe_name: 'Poulet crémeux au brocoli' }]);
  });
});

describe('P-2 / PANT-07 : aucun mot anglais visible', () => {
  const FORBIDDEN = /\b(pantry|shopping|low|out of stock|add item|scan|expired|expires|recipes?|save|delete|cancel|retry|loading|empty|stock bas)\b/i;
  const ALLOWED_PHRASES = ['stock bas']; // francais
  it('no copy string contains a forbidden English word', () => {
    const bad = allCopyStrings().filter((s) => {
      const cleaned = ALLOWED_PHRASES.reduce((acc, p) => acc.replace(new RegExp(p, 'gi'), ''), s);
      return FORBIDDEN.test(cleaned);
    });
    expect(bad).toEqual([]);
  });
  it('the module is named Garde-manger and the tabs are Inventaire / Recettes / Courses', () => {
    expect(COPY.title).toBe('Garde-manger');
    expect([COPY.tabs.inventory, COPY.tabs.recipes, COPY.tabs.shopping]).toEqual(['Inventaire', 'Recettes', 'Courses']);
  });
  it('no emoji in copy (G7)', () => {
    expect(allCopyStrings().filter((s) => /\p{Extended_Pictographic}/u.test(s))).toEqual([]);
  });
  it('microcopy matches the mockup', () => {
    expect(COPY.emptyTitle).toBe('Ton garde-manger est vide');
    expect(COPY.prefillBanner('3017620422003')).toBe('Prérempli depuis le code-barres 3017620422003. Vérifie et complète.');
    expect(COPY.generate(1)).toBe('Générer des recettes · 1 crédit');
    expect(COPY.macrosLeft).toBe("Il te reste aujourd'hui");
    expect(COPY.shopEmptyTitle).toBe('Rien à acheter');
    expect(COPY.shopPut(1)).toBe('Ranger 1 article dans le garde-manger');
    expect(COPY.shopPut(2)).toBe('Ranger 2 articles dans le garde-manger');
    expect(COPY.cameraOffTitle).toBe("L'accès à la caméra est désactivé");
  });
});

describe('fiche article : pas de quantite et macros restantes', () => {
  it('steps by unit and never goes below zero', () => {
    expect(stepQuantity(400, 'g', -1)).toBe(350);
    expect(stepQuantity(30, 'g', -1)).toBe(0);
    expect(stepQuantity(1, 'kg', 1)).toBe(1.25);
    expect(stepQuantity(0, 'pieces', -1)).toBe(0);
    expect(stepQuantity(6, 'pieces', 1)).toBe(7);
  });
  it('remainingFromSettings mirrors the server: goals minus meals, floor 0, defaults', () => {
    expect(remainingFromSettings({ calorie_goal: 2600, protein_goal: 180 }, [{ calories: 1440, protein_g: 102 }])).toEqual({ calories: 1160, protein_g: 78, carbs_g: 250, fat_g: 65 });
    expect(remainingFromSettings(null, [{ calories: 5000 }]).calories).toBe(0);
  });
});
