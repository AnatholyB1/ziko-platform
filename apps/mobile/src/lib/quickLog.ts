/**
 * Quick Log (accueil) — logique pure + acces base, testable sans React Native.
 *
 * Source de verite = la base (RLS "own"). Les dates sont TOUJOURS la date locale de
 * l'appareil (localDateKey), jamais UTC : l'ancien chemin passait par les outils IA
 * backend dont `today()` est UTC, ce qui decalait les logs pres de minuit.
 *
 * Poids / humeur : 1 valeur par jour. Re-logger le meme jour MET A JOUR la ligne du
 * jour (pas de doublon). Pas d'index unique (donnees prod non verifiees, et le
 * plugin Journal autorise plusieurs entrees/jour) : "select puis update/insert".
 */
import { localDateKey } from './localDate';

// ── Constantes ────────────────────────────────────────────────
export const WATER_STEP_ML = 250;
// Repli commun = DEFAULT_NUTRITION_TARGETS.calories (plugin-sdk) ; egalite garantie par lib/__tests__/nutritionTargets.test.ts.
export const NUTRITION_GOAL_KCAL = 2000;
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 400;

// ── Client minimal (compatible SupabaseClient, mockable) ──────
type QueryResult<T = unknown> = { data: T | null; error: { message: string } | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QuickLogClient = { from: (table: string) => any };

function fail(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// ── Eau ───────────────────────────────────────────────────────
export function sumWaterMl(rows: { amount_ml: number | null }[] | null | undefined): number {
  return (rows ?? []).reduce((s, r) => s + (r.amount_ml ?? 0), 0);
}

export function formatLitres(ml: number): string {
  // Format FR unique (= formatLitersFr du SDK, 1 decimale) : `14,75 L` s'affichait ici alors que la carte Forme du jour
  // disait `14,8 L` (UAT run 9, defaut 4). Copie locale : le SDK n'est pas importable en test node ; l'egalite des trois
  // formateurs est verifiee par packages/plugin-sdk/src/litersConsistency.test.ts.
  return `${(Math.max(0, ml) / 1000).toFixed(1).replace('.', ',')} L`;
}

export async function logWater(
  client: QuickLogClient,
  userId: string,
  amountMl: number = WATER_STEP_ML,
  date: string = localDateKey(),
): Promise<void> {
  if (!Number.isFinite(amountMl) || amountMl <= 0) throw new Error('amountMl invalide');
  const res: QueryResult = await client
    .from('ziko_hydration_logs')
    .insert({ user_id: userId, amount_ml: amountMl, date });
  fail(res.error, 'hydration insert');
}

// ── Poids (1 / jour) ──────────────────────────────────────────
export interface TodayWeight { id: string; weight_kg: number }

export function parseWeightInput(raw: string): number | null {
  const v = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(v) || v < WEIGHT_MIN_KG || v > WEIGHT_MAX_KG) return null;
  return Math.round(v * 10) / 10;
}

export async function getTodayWeight(
  client: QuickLogClient,
  userId: string,
  date: string = localDateKey(),
): Promise<TodayWeight | null> {
  const res: QueryResult<{ id: string; weight_kg: number | null; created_at: string }[]> = await client
    .from('ziko_body_measurements')
    .select('id, weight_kg, created_at')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false });
  fail(res.error, 'weight select');
  const row = (res.data ?? []).find((r) => r.weight_kg != null);
  return row ? { id: row.id, weight_kg: Number(row.weight_kg) } : null;
}

export async function saveTodayWeight(
  client: QuickLogClient,
  userId: string,
  kg: number,
  date: string = localDateKey(),
): Promise<'inserted' | 'updated'> {
  if (!Number.isFinite(kg) || kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) throw new Error('poids invalide');
  const existing = await getTodayWeight(client, userId, date);
  if (existing) {
    const res: QueryResult = await client
      .from('ziko_body_measurements')
      .update({ weight_kg: kg })
      .eq('id', existing.id)
      .eq('user_id', userId);
    fail(res.error, 'weight update');
    return 'updated';
  }
  const res: QueryResult = await client
    .from('ziko_body_measurements')
    .insert({ user_id: userId, weight_kg: kg, date });
  fail(res.error, 'weight insert');
  return 'inserted';
}

// ── Humeur (1 / jour) ─────────────────────────────────────────
export interface TodayMood { id: string; mood: number }

/**
 * `context` est contraint en base a pre_workout|post_workout|morning|evening|general.
 * L'ancien code envoyait 'afternoon' -> violation CHECK -> echec silencieux (fire-and-forget).
 */
export function moodContext(hour: number): 'morning' | 'evening' | 'general' {
  if (hour < 12) return 'morning';
  if (hour >= 18) return 'evening';
  return 'general';
}

export async function getTodayMood(
  client: QuickLogClient,
  userId: string,
  date: string = localDateKey(),
): Promise<TodayMood | null> {
  const res: QueryResult<{ id: string; mood: number }[]> = await client
    .from('ziko_journal_entries')
    .select('id, mood')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('context', 'general') // P22 (Q-P22b) : l'humeur de l'accueil = entree 'general' du jour
    .order('created_at', { ascending: false })
    .limit(1);
  fail(res.error, 'mood select');
  const row = (res.data ?? [])[0];
  return row ? { id: row.id, mood: row.mood } : null;
}

export async function saveTodayMood(
  client: QuickLogClient,
  userId: string,
  mood: number,
  hour: number = new Date().getHours(),
  date: string = localDateKey(),
): Promise<'inserted' | 'updated'> {
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) throw new Error('humeur invalide');
  const existing = await getTodayMood(client, userId, date);
  if (existing) {
    const res: QueryResult = await client
      .from('ziko_journal_entries')
      .update({ mood })
      .eq('id', existing.id)
      .eq('user_id', userId);
    fail(res.error, 'mood update');
    return 'updated';
  }
  const res: QueryResult = await client
    .from('ziko_journal_entries')
    .insert({ user_id: userId, mood, context: 'general', date });
  fail(res.error, 'mood insert');
  return 'inserted';
}

// ── Carte score "Forme du jour" (QLOG-05) ─────────────────────
/**
 * Formule (documentee, D-04). Moyenne des composantes QUI ONT DES DONNEES :
 *  - Sommeil   : duree / 8 h, plafonne a 100, si une nuit est enregistree (> 0 h)
 *  - Hydratation : ml du jour / 2500, si > 0 ml
 *  - Nutrition : kcal du jour / objectif nutrition (reglages, repli 2000), si > 0 kcal
 *  - Charge    : 100 si seance faite aujourd'hui OU objectif hebdo atteint (jour de repos
 *                legitime) ; sinon composante ABSENTE (seance a venir != 0 %)
 * Aucune composante avec donnees => score null + etat vide (pas de "0" trompeur).
 */
export type ScorePartKey = 'sleep' | 'water' | 'nutrition' | 'load';
export interface ScorePart { key: ScorePartKey; pct: number; hasData: boolean }
export interface FormScore { score: number | null; isEmpty: boolean; parts: ScorePart[] }

export interface FormScoreInput {
  sleepH: number;
  sleepTargetH: number;
  waterMl: number;
  waterGoalMl: number;
  kcal: number;
  kcalGoal?: number;
  todayDone: boolean;
  weeklyCount: number;
  weeklyGoal: number;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function computeFormScore(i: FormScoreInput): FormScore {
  const kcalGoal = i.kcalGoal ?? NUTRITION_GOAL_KCAL;
  const restDay = i.weeklyGoal === 0 || i.weeklyCount >= i.weeklyGoal;
  const parts: ScorePart[] = [
    { key: 'sleep', hasData: i.sleepH > 0, pct: i.sleepTargetH > 0 ? clampPct((i.sleepH / i.sleepTargetH) * 100) : 0 },
    { key: 'water', hasData: i.waterMl > 0, pct: i.waterGoalMl > 0 ? clampPct((i.waterMl / i.waterGoalMl) * 100) : 0 },
    { key: 'nutrition', hasData: i.kcal > 0, pct: kcalGoal > 0 ? clampPct((i.kcal / kcalGoal) * 100) : 0 },
    { key: 'load', hasData: i.todayDone || restDay, pct: i.todayDone || restDay ? 100 : 0 },
  ];
  const withData = parts.filter((p) => p.hasData);
  if (withData.length === 0) return { score: null, isEmpty: true, parts };
  const score = Math.round(withData.reduce((s, p) => s + p.pct, 0) / withData.length);
  return { score, isEmpty: false, parts };
}
