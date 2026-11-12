// Logique pure du Garde-manger (v1.20 Phase 10). Aucune dependance native, testable sous vitest node.
// Les dates sont des chaines ISO locales `YYYY-MM-DD` (jamais de fuseau implicite).

export type StorageLocation = 'fridge' | 'freezer' | 'pantry';
export type FoodCategory =
  | 'fruits' | 'vegetables' | 'meat' | 'fish_seafood' | 'dairy' | 'eggs'
  | 'grains_pasta' | 'snacks' | 'drinks' | 'other';
export type PantryUnit = 'g' | 'kg' | 'ml' | 'L' | 'pieces' | 'can' | 'box' | 'bag';

export interface PantryRow {
  id: string;
  user_id?: string;
  name: string;
  quantity: number;
  unit: PantryUnit | string;
  storage_location: StorageLocation | string;
  food_category?: FoodCategory | string;
  expiration_date: string | null;
  low_stock_threshold: number | null;
}

export const LOCATIONS: Array<{ id: StorageLocation; label: string; icon: 'snow-outline' | 'cube-outline' | 'file-tray-stacked-outline' }> = [
  { id: 'fridge', label: 'Frigo', icon: 'snow-outline' },
  { id: 'freezer', label: 'Congélateur', icon: 'cube-outline' },
  { id: 'pantry', label: 'Placard', icon: 'file-tray-stacked-outline' },
];

export const LOCATION_LABEL: Record<string, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' };

export const UNIT_LABEL: Record<string, string> = {
  g: 'g', kg: 'kg', ml: 'ml', L: 'L', pieces: 'pièce', can: 'canette', box: 'boîte', bag: 'sachet',
};

/** `1 pièce` / `6 pièces` ; les autres unites sont invariables sauf boite/sachet/canette. */
export function formatQuantity(quantity: number, unit: string): string {
  const q = Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 100) / 100).replace('.', ',');
  const base = UNIT_LABEL[unit] ?? unit;
  const plural = Math.abs(quantity) > 1 && ['pieces', 'can', 'box', 'bag'].includes(unit);
  const label = plural ? (unit === 'pieces' ? 'pièces' : base + 's') : base;
  return `${q} ${label}`;
}

const ALLOWED_UNITS: PantryUnit[] = ['g', 'kg', 'ml', 'L', 'pieces', 'can', 'box', 'bag'];

/** Ramene une unite libre (IA, saisie) a l'ensemble autorise par la contrainte SQL ; repli `pieces`. */
export function normalizeUnit(u: string | null | undefined): PantryUnit {
  if (!u) return 'pieces';
  const raw = u.trim();
  if ((ALLOWED_UNITS as string[]).includes(raw)) return raw as PantryUnit;
  const l = raw.toLowerCase();
  if (l === 'l' || l === 'litre' || l === 'litres') return 'L';
  if (l === 'gramme' || l === 'grammes' || l === 'gr') return 'g';
  if (l === 'kilo' || l === 'kilos') return 'kg';
  if (l === 'millilitre' || l === 'millilitres') return 'ml';
  if (/^pi[eè]ce/.test(l) || l === 'piece' || l === 'pcs' || l === 'pc') return 'pieces';
  if (/^bo[iî]te/.test(l)) return 'box';
  if (/^sachet/.test(l)) return 'bag';
  if (/^canette/.test(l) || /^conserve/.test(l)) return 'can';
  return 'pieces';
}

// ── Dates ────────────────────────────────────────────────

export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Jours entiers entre `todayISO` et `dateISO` (negatif = passe). null si pas de date valide. */
export function daysUntil(dateISO: string | null | undefined, todayISO: string): number | null {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return null;
  return dayNumber(dateISO) - dayNumber(todayISO);
}

export type ExpiryTone = 'danger' | 'warning' | 'ok';

export interface ExpiryBadge {
  text: string;
  tone: ExpiryTone;
}

/**
 * Badge de peremption en TEXTE (jamais la couleur seule) : `EXPIRE DEMAIN`, `DANS 2 J`, `dans 9 j`.
 * Majuscules quand c'est urgent (<= 3 jours), minuscules sinon, comme la maquette B14.
 */
export function expiryBadge(dateISO: string | null | undefined, todayISO: string): ExpiryBadge | null {
  const d = daysUntil(dateISO, todayISO);
  if (d === null) return null;
  if (d < 0) return { text: 'EXPIRÉ', tone: 'danger' };
  if (d === 0) return { text: "EXPIRE AUJOURD'HUI", tone: 'danger' };
  if (d === 1) return { text: 'EXPIRE DEMAIN', tone: 'danger' };
  if (d <= 3) return { text: `DANS ${d} J`, tone: 'warning' };
  return { text: `dans ${d} j`, tone: 'ok' };
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** `2026-11-14` -> `14 nov.` */
export function formatShortDateFr(dateISO: string | null | undefined): string {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return '';
  const [, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS_FR[m - 1]}`;
}

/** Date d'un objet Date -> `YYYY-MM-DD` en heure LOCALE (le toISOString() UTC decale d'un jour la nuit). */
export const dateToLocalISO = todayLocalISO;

// ── Inventaire : lieux et filtre ─────────────────────────

export function locationOf(item: Pick<PantryRow, 'storage_location'>): StorageLocation {
  const l = item.storage_location;
  return l === 'fridge' || l === 'freezer' ? l : 'pantry';
}

export function countByLocation(items: PantryRow[]): Record<StorageLocation, number> {
  const out: Record<StorageLocation, number> = { fridge: 0, freezer: 0, pantry: 0 };
  for (const it of items) out[locationOf(it)] += 1;
  return out;
}

/** `null` = tous les lieux. Tri : peremption la plus proche d'abord, puis nom. */
export function filterByLocation(items: PantryRow[], loc: StorageLocation | null): PantryRow[] {
  const list = loc ? items.filter((i) => locationOf(i) === loc) : [...items];
  return list.sort((a, b) => {
    const da = a.expiration_date ?? '9999-12-31';
    const db = b.expiration_date ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });
}

export function filterBySearch(items: PantryRow[], query: string): PantryRow[] {
  const q = normalizeName(query);
  if (!q) return items;
  return items.filter((i) => normalizeName(i.name).includes(q));
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Courses : "Il manque" calcule ────────────────────────

export interface MissingEntry {
  /** pantry item id (ligne calculee, non persistee) */
  pantryItemId: string;
  name: string;
  /** quantite a racheter proposee */
  quantity: number;
  unit: string;
  /** `Stock bas, expire demain` */
  reason: string;
  expired: boolean;
}

/**
 * Tout article sous le seuil (ou epuise) OU perime apparait, avec sa raison (P-5).
 * Une peremption proche (aujourd'hui/demain) s'ajoute a la raison d'un article deja liste.
 */
export function computeMissing(items: PantryRow[], todayISO: string): MissingEntry[] {
  const out: MissingEntry[] = [];
  for (const it of items) {
    const threshold = it.low_stock_threshold;
    const empty = it.quantity <= 0;
    const low = !empty && threshold !== null && it.quantity <= threshold;
    const d = daysUntil(it.expiration_date, todayISO);
    const expired = d !== null && d < 0;
    if (!empty && !low && !expired) continue;

    const reasons: string[] = [];
    if (empty) reasons.push('Épuisé');
    else if (low) reasons.push('Stock bas');
    if (expired) reasons.push('Expiré');
    else if (d === 0) reasons.push("expire aujourd'hui");
    else if (d === 1) reasons.push('expire demain');
    out.push({
      pantryItemId: it.id,
      name: it.name,
      quantity: restockQuantity(it),
      unit: String(it.unit),
      reason: reasons.join(', '),
      expired,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Quantite proposee au rachat : au moins le seuil, au moins 1. */
export function restockQuantity(it: Pick<PantryRow, 'low_stock_threshold'>): number {
  return Math.max(it.low_stock_threshold ?? 0, 1);
}

// ── Courses : ranger dans le garde-manger ────────────────

export interface ShoppingRow {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  pantry_item_id: string | null;
  source: 'low_stock' | 'recipe' | 'manual';
  recipe_name: string | null;
  reason?: string | null;
  checked?: boolean;
}

export interface RangerPlan {
  /** quantite a ecrire sur une ligne de stock existante */
  updates: Array<{ id: string; quantity: number; clearExpiry: boolean }>;
  inserts: Array<{ name: string; quantity: number; unit: string; storage_location: StorageLocation; food_category: FoodCategory; low_stock_threshold: number }>;
  /** lignes de courses persistees a supprimer apres rangement */
  deleteShoppingIds: string[];
}

/**
 * Ranger = deplacer les articles coches vers l'inventaire (P-5, D-10d) :
 *  - meme nom (ou pantry_item_id) deja en stock => on additionne la quantite ;
 *  - article perime reachete => quantite = achat, date d'expiration effacee (nouvelle date a choisir) ;
 *  - sinon => nouvelle ligne de stock.
 * `autoChecked` = lignes calculees (non persistees), `rows` = lignes de ziko_shopping_list_items cochees.
 */
export function planRanger(args: {
  autoChecked: MissingEntry[];
  rows: ShoppingRow[];
  pantry: PantryRow[];
}): RangerPlan {
  const { autoChecked, rows, pantry } = args;
  const byId = new Map(pantry.map((p) => [p.id, p]));
  const byName = new Map(pantry.map((p) => [normalizeName(p.name), p]));
  const plan: RangerPlan = { updates: [], inserts: [], deleteShoppingIds: [] };
  const touched = new Map<string, { quantity: number; clearExpiry: boolean }>();
  const inserted = new Map<string, RangerPlan['inserts'][number]>();

  const apply = (target: PantryRow | undefined, name: string, qty: number, unit: string, clearExpiry: boolean) => {
    if (target) {
      const prev = touched.get(target.id);
      const base = prev ? prev.quantity : clearExpiry ? 0 : target.quantity;
      touched.set(target.id, { quantity: base + qty, clearExpiry: clearExpiry || !!prev?.clearExpiry });
      return;
    }
    const key = normalizeName(name);
    const prevIns = inserted.get(key);
    if (prevIns) {
      prevIns.quantity += qty;
      return;
    }
    const ins: RangerPlan['inserts'][number] = {
      name,
      quantity: qty,
      unit: normalizeUnit(unit),
      storage_location: 'pantry',
      food_category: 'other',
      low_stock_threshold: 1,
    };
    inserted.set(key, ins);
    plan.inserts.push(ins);
  };

  for (const m of autoChecked) {
    apply(byId.get(m.pantryItemId), m.name, m.quantity, m.unit, m.expired);
  }
  for (const r of rows) {
    const target = (r.pantry_item_id && byId.get(r.pantry_item_id)) || byName.get(normalizeName(r.name));
    apply(target, r.name, r.quantity ?? 1, r.unit ?? 'pieces', false);
    plan.deleteShoppingIds.push(r.id);
  }
  for (const [id, v] of touched) plan.updates.push({ id, ...v });
  return plan;
}

// ── Recettes IA : disponibilite des ingredients ──────────

export interface RecipeLike {
  id: string;
  name: string;
  ingredients: Array<{ name: string; quantity: number; unit: string; pantry_item_id?: string }>;
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

export interface RecipeAvailability {
  available: number;
  total: number;
  missing: string[];
}

export function recipeAvailability(recipe: RecipeLike, pantry: PantryRow[]): RecipeAvailability {
  const inStock = new Set(pantry.filter((p) => p.quantity > 0).map((p) => p.id));
  const missing: string[] = [];
  let available = 0;
  for (const ing of recipe.ingredients) {
    if (ing.pantry_item_id && inStock.has(ing.pantry_item_id)) available += 1;
    else missing.push(ing.name);
  }
  return { available, total: recipe.ingredients.length, missing };
}

export function fitsRemainingMacros(
  recipe: Pick<RecipeLike, 'macros'>,
  remaining: { calories: number; protein_g: number } | null,
): boolean {
  return !!remaining && recipe.macros.calories <= remaining.calories;
}

/** `1160` -> `1 160` (espace insecable fine, comme la maquette B19). */
export function formatThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Lignes de courses ajoutees par une recette : une ligne par ingredient manquant. */
export function missingIngredientRows(recipe: RecipeLike, pantry: PantryRow[]) {
  const av = recipeAvailability(recipe, pantry);
  return recipe.ingredients
    .filter((i) => av.missing.includes(i.name))
    .map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, recipe_name: recipe.name }));
}

// ── Quantite : pas du stepper et "Utiliser" ───────────────

/** Pas d'ajustement : 50 g/ml, 0,25 kg/L, 1 pour les unites comptees. */
export function quantityStep(unit: string): number {
  if (unit === 'g' || unit === 'ml') return 50;
  if (unit === 'kg' || unit === 'L') return 0.25;
  return 1;
}

/** Nouvelle quantite apres un pas (bornee a 0, arrondie a 2 decimales). */
export function stepQuantity(current: number, unit: string, direction: 1 | -1): number {
  const next = current + direction * quantityStep(unit);
  return Math.max(0, Math.round(next * 100) / 100);
}

// ── Macros restantes du jour (miroir de backend/api/src/routes/pantry-recipes-macros.ts) ──

export interface MacroBudgetLike {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const DEFAULT_MACRO_TARGETS: MacroBudgetLike = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

function pos(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/** Affichage avant generation ; la reponse serveur (remaining_macros) reste la reference apres appel. */
export function remainingFromSettings(settings: unknown, meals: Array<Record<string, unknown>>): MacroBudgetLike {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const t: MacroBudgetLike = {
    calories: pos(s.calorie_goal) ?? DEFAULT_MACRO_TARGETS.calories,
    protein_g: pos(s.protein_goal) ?? pos(s.protein_goal_g) ?? DEFAULT_MACRO_TARGETS.protein_g,
    carbs_g: pos(s.carbs_goal) ?? pos(s.carbs_goal_g) ?? DEFAULT_MACRO_TARGETS.carbs_g,
    fat_g: pos(s.fat_goal) ?? pos(s.fat_goal_g) ?? DEFAULT_MACRO_TARGETS.fat_g,
  };
  const sum = (k: string) => meals.reduce((acc, m) => acc + (Number(m[k]) || 0), 0);
  const rest = (target: number, key: string) => Math.max(0, Math.round(target - sum(key)));
  return {
    calories: rest(t.calories, 'calories'),
    protein_g: rest(t.protein_g, 'protein_g'),
    carbs_g: rest(t.carbs_g, 'carbs_g'),
    fat_g: rest(t.fat_g, 'fat_g'),
  };
}
