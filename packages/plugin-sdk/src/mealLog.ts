/**
 * Ajout de repas en un ecran (P9, NUTR-01..04) : logique pure, testable sans React Native.
 *
 * - creneau horaire -> repas preselectionne (D-02 / D-08)
 * - panier multi-aliments -> lignes d'insertion groupee (D-06)
 * - recents derives des logs des 14 derniers jours, sans table (D-09)
 * - file d'attente hors-ligne pour la saisie manuelle (M-5, "sera synchronisee")
 * - libelle du cout reel de la methode Photo (D-10)
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export type MealMethod = 'search' | 'scan' | 'barcode' | 'custom';
export const MEAL_METHODS: readonly MealMethod[] = ['search', 'scan', 'barcode', 'custom'];

export function isMealType(v: unknown): v is MealType {
  return v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack';
}
export function isMealMethod(v: unknown): v is MealMethod {
  return v === 'search' || v === 'scan' || v === 'barcode' || v === 'custom';
}

/**
 * Creneaux du contrat lot A : 05-10 petit-dej, 11-14 dejeuner, 15-17 collation, 18-22 diner
 * (heures pleines, bornes incluses : 10h59 = petit-dej, 14h59 = dejeuner, 17h59 = collation,
 * 22h59 = diner). Hors creneau (23h-04h59) : dernier repas utilise, sinon `snack`.
 */
export function mealTypeForHour(hour: number, fallback?: MealType | null): MealType {
  if (hour >= 5 && hour <= 10) return 'breakfast';
  if (hour >= 11 && hour <= 14) return 'lunch';
  if (hour >= 15 && hour <= 17) return 'snack';
  if (hour >= 18 && hour <= 22) return 'dinner';
  return fallback && isMealType(fallback) ? fallback : 'snack';
}

/** "12:40" (heure locale 24 h) pour le message "Dejeuner suggere d'apres l'heure (12:40)". */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ── Panier ────────────────────────────────────────────────────
export interface BasketItem {
  /** cle locale unique (pas l'id base) */
  key: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g: number;
  food_product_id?: string | null;
  nutriscore_grade?: string | null;
  ecoscore_grade?: string | null;
}

export interface MacroTotals { calories: number; protein_g: number; carbs_g: number; fat_g: number }

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function sumMacros(
  rows: ReadonlyArray<{ calories?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null }> | null | undefined,
): MacroTotals {
  const out: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const r of rows ?? []) {
    out.calories += num(r.calories);
    out.protein_g += num(r.protein_g);
    out.carbs_g += num(r.carbs_g);
    out.fat_g += num(r.fat_g);
  }
  out.calories = Math.round(out.calories);
  out.protein_g = Math.round(out.protein_g * 10) / 10;
  out.carbs_g = Math.round(out.carbs_g * 10) / 10;
  out.fat_g = Math.round(out.fat_g * 10) / 10;
  return out;
}

/** Aliment de catalogue (valeurs pour `serving_g`) mis a l'echelle de `grams`. */
export function scaleFood(
  food: { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; serving_g: number },
  grams: number,
): Pick<BasketItem, 'food_name' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'serving_g'> {
  const base = food.serving_g > 0 ? food.serving_g : 100;
  const g = grams > 0 ? grams : base;
  const ratio = g / base;
  return {
    food_name: food.name,
    calories: Math.round(food.calories * ratio),
    protein_g: Math.round(food.protein_g * ratio * 10) / 10,
    carbs_g: Math.round(food.carbs_g * ratio * 10) / 10,
    fat_g: Math.round(food.fat_g * ratio * 10) / 10,
    serving_g: g,
  };
}

/** Libelle de la barre d'action : "Ajouter 2 aliments" / "Ajouter 1 aliment". */
export function addLabel(n: number): string {
  return n <= 1 ? `Ajouter ${n} aliment` : `Ajouter ${n} aliments`;
}

export interface InsertRow {
  user_id: string;
  date: string;
  meal_type: MealType;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_g: number;
  food_product_id?: string | null;
  nutriscore_grade?: string | null;
  ecoscore_grade?: string | null;
}

/** Lignes d'un insert groupe unique (D-06). `date` = date locale (D-12). */
export function buildInsertRows(
  basket: readonly BasketItem[],
  userId: string,
  date: string,
  mealType: MealType,
): InsertRow[] {
  return basket.map((b) => {
    const row: InsertRow = {
      user_id: userId,
      date,
      meal_type: mealType,
      food_name: b.food_name,
      calories: num(b.calories),
      protein_g: num(b.protein_g),
      carbs_g: num(b.carbs_g),
      fat_g: num(b.fat_g),
      serving_g: num(b.serving_g) || 100,
    };
    if (b.food_product_id) row.food_product_id = b.food_product_id;
    if (b.nutriscore_grade) row.nutriscore_grade = b.nutriscore_grade;
    if (b.ecoscore_grade) row.ecoscore_grade = b.ecoscore_grade;
    return row;
  });
}

// ── Repas deja logues (A17) ───────────────────────────────────
export interface LoggedRow {
  id?: string;
  meal_type: MealType;
  food_name: string;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  created_at?: string | null;
  date?: string;
}

export interface MealGroup { meal_type: MealType; calories: number; names: string[]; count: number }

/** Groupe les logs du jour par repas, dans l'ordre petit-dej, dejeuner, collation, diner. */
export function groupByMeal(rows: ReadonlyArray<LoggedRow>): MealGroup[] {
  const out: MealGroup[] = [];
  for (const mt of MEAL_TYPES) {
    const items = rows.filter((r) => r.meal_type === mt);
    if (items.length === 0) continue;
    out.push({
      meal_type: mt,
      calories: Math.round(items.reduce((s, r) => s + num(r.calories), 0)),
      names: items.map((r) => r.food_name),
      count: items.length,
    });
  }
  return out;
}

export const RECENTS_WINDOW_DAYS = 14;

/** Date locale `YYYY-MM-DD` d'il y a `days` jours (pour borner la requete des recents). */
export function dateKeyDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface RecentFood extends Omit<BasketItem, 'key'> { count: number; lastAt: string }

/**
 * Recents (D-09) : `food_name` distincts (insensible a la casse) des logs recents, tries par
 * frequence decroissante puis par dernier usage decroissant. L'entree gardee = la plus recente.
 */
export function deriveRecents(
  rows: ReadonlyArray<LoggedRow & Partial<Omit<BasketItem, 'key'>>>,
  limit = 8,
): RecentFood[] {
  const map = new Map<string, RecentFood>();
  for (const r of rows) {
    const name = (r.food_name ?? '').trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const at = `${r.date ?? ''}|${r.created_at ?? ''}`;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, {
        food_name: name,
        calories: num(r.calories),
        protein_g: num(r.protein_g),
        carbs_g: num(r.carbs_g),
        fat_g: num(r.fat_g),
        serving_g: num(r.serving_g) || 100,
        food_product_id: r.food_product_id ?? null,
        nutriscore_grade: r.nutriscore_grade ?? null,
        ecoscore_grade: r.ecoscore_grade ?? null,
        count: 1,
        lastAt: at,
      });
    } else {
      prev.count += 1;
      if (at > prev.lastAt) {
        prev.lastAt = at;
        prev.calories = num(r.calories);
        prev.protein_g = num(r.protein_g);
        prev.carbs_g = num(r.carbs_g);
        prev.fat_g = num(r.fat_g);
        prev.serving_g = num(r.serving_g) || 100;
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0))
    .slice(0, limit);
}

// ── Cout de la methode Photo (D-10 / Q3) ──────────────────────
/** "3 credits IA par analyse" : cout reel (config), jamais un chiffre en dur dans la microcopy. */
export function scanCostLabel(cost: number): string {
  const n = Math.max(0, Math.round(cost));
  return `${n} ${n > 1 ? 'crédits' : 'crédit'} IA par analyse`;
}
/** Miroir d'affichage de backend/api/src/config/credits.ts CREDIT_COSTS.scan (test anti-derive). */
export const SCAN_CREDIT_COST = 3;
export const SCAN_FREE_NOTE = 'La première analyse du jour est offerte.';

// ── File d'attente hors-ligne (M-5) ───────────────────────────
export interface PendingMeal { id: string; rows: InsertRow[]; queuedAt: string }

/** Erreur reseau (pas une erreur de validation base) : on met en file plutot que d'echouer. */
export function isNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string } | null)?.message ?? err ?? '').toLowerCase();
  return /network request failed|failed to fetch|network error|fetch failed|timeout|offline|internet/.test(msg);
}

export function parsePending(raw: string | null | undefined): PendingMeal[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (p): p is PendingMeal => !!p && typeof p.id === 'string' && Array.isArray(p.rows) && p.rows.length > 0,
    );
  } catch {
    return [];
  }
}

export function enqueuePending(list: readonly PendingMeal[], entry: PendingMeal): PendingMeal[] {
  return [...list, entry];
}

export function removePending(list: readonly PendingMeal[], id: string): PendingMeal[] {
  return list.filter((p) => p.id !== id);
}

// ── Preferences memorisees (D-07) ─────────────────────────────
export interface MealPrefs { lastMethod: MealMethod; lastMealType: MealType | null }
export const DEFAULT_MEAL_PREFS: MealPrefs = { lastMethod: 'search', lastMealType: null };

export function parsePrefs(raw: string | null | undefined): MealPrefs {
  if (!raw) return DEFAULT_MEAL_PREFS;
  try {
    const v = JSON.parse(raw);
    return {
      lastMethod: isMealMethod(v?.lastMethod) ? v.lastMethod : 'search',
      lastMealType: isMealType(v?.lastMealType) ? v.lastMealType : null,
    };
  } catch {
    return DEFAULT_MEAL_PREFS;
  }
}

// ── Ecriture groupee (D-06) ───────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MealClient = { from: (table: string) => any };

export type SaveMealResult =
  | { status: 'saved'; data: Array<LoggedRow & { id: string }> }
  | { status: 'network' }
  | { status: 'error'; message: string };

/** UN seul `insert([...])` sur ziko_nutrition_logs pour tout le panier. */
export async function saveMeal(client: MealClient, rows: readonly InsertRow[]): Promise<SaveMealResult> {
  if (rows.length === 0) return { status: 'error', message: 'empty basket' };
  try {
    const res = await client.from('ziko_nutrition_logs').insert([...rows]).select();
    if (res.error) {
      return isNetworkError(res.error) ? { status: 'network' } : { status: 'error', message: String(res.error.message) };
    }
    return { status: 'saved', data: (res.data ?? []) as Array<LoggedRow & { id: string }> };
  } catch (e) {
    return isNetworkError(e) ? { status: 'network' } : { status: 'error', message: String((e as Error)?.message ?? e) };
  }
}
