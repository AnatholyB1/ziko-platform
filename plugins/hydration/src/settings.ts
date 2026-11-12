/**
 * Reglages d'hydratation : logique pure + acces base (client injecte, testable sans RN).
 * Source de verite = table `ziko_hydration_settings` (1 ligne par utilisateur, RLS own).
 * Aucune valeur de reglage n'est codee en dur dans l'ecran : tout passe par
 * `HydrationSettings` + les formateurs ci-dessous (HY-10).
 */

export interface HydrationSettings {
  remindersEnabled: boolean;
  reminderIntervalMin: number; // 60 | 90 | 120 | 180
  reminderStartMin: number; // minutes depuis minuit
  reminderEndMin: number;
  glassMl: number;
  countCoffeeTea: boolean;
  coffeeTeaPct: number; // 25 | 50 | 75 | 100
  workoutBonusMl: number; // 0..1500 par pas de 100
}

export const INTERVAL_OPTIONS = [60, 90, 120, 180] as const;
export const GLASS_OPTIONS = [150, 200, 250, 300, 330, 500] as const;
export const COFFEE_PCT_OPTIONS = [25, 50, 75, 100] as const;
export const RANGE_STEP_MIN = 30;
export const BONUS_STEP_ML = 100;
export const BONUS_MAX_ML = 1500;
export const GOAL_MIN_ML = 1500;
export const GOAL_MAX_ML = 4000;
export const QUICK_AMOUNTS = [250, 500, 750] as const;
export const MAX_LOG_ML = 5000;

export const DEFAULT_SETTINGS: HydrationSettings = {
  remindersEnabled: false,
  reminderIntervalMin: 90,
  reminderStartMin: 8 * 60,
  reminderEndMin: 21 * 60,
  glassMl: 250,
  countCoffeeTea: true,
  coffeeTeaPct: 50,
  workoutBonusMl: 500,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const snap = (n: number, step: number) => Math.round(n / step) * step;
const pick = (v: unknown, allowed: readonly number[], fallback: number): number =>
  typeof v === 'number' && allowed.includes(v) ? v : fallback;

/** Normalise n'importe quelle valeur (ligne base, saisie) vers des reglages valides. */
export function normalizeSettings(raw: Partial<HydrationSettings> | null | undefined): HydrationSettings {
  const d = DEFAULT_SETTINGS;
  const r = raw ?? {};
  const start = clamp(snap(typeof r.reminderStartMin === 'number' ? r.reminderStartMin : d.reminderStartMin, RANGE_STEP_MIN), 0, 23 * 60 + 30);
  const endRaw = clamp(snap(typeof r.reminderEndMin === 'number' ? r.reminderEndMin : d.reminderEndMin, RANGE_STEP_MIN), 0, 24 * 60 - RANGE_STEP_MIN);
  const bonus = typeof r.workoutBonusMl === 'number' ? clamp(snap(r.workoutBonusMl, BONUS_STEP_ML), 0, BONUS_MAX_ML) : d.workoutBonusMl;
  return {
    remindersEnabled: typeof r.remindersEnabled === 'boolean' ? r.remindersEnabled : d.remindersEnabled,
    reminderIntervalMin: pick(r.reminderIntervalMin, INTERVAL_OPTIONS, d.reminderIntervalMin),
    reminderStartMin: start,
    reminderEndMin: Math.max(endRaw, start),
    glassMl: pick(r.glassMl, GLASS_OPTIONS, d.glassMl),
    countCoffeeTea: typeof r.countCoffeeTea === 'boolean' ? r.countCoffeeTea : d.countCoffeeTea,
    coffeeTeaPct: pick(r.coffeeTeaPct, COFFEE_PCT_OPTIONS, d.coffeeTeaPct),
    workoutBonusMl: bonus,
  };
}

// ── Rappels : n = floor((fin - debut) / intervalle) + 1 ───────
export function computeReminderTimes(s: Pick<HydrationSettings, 'reminderIntervalMin' | 'reminderStartMin' | 'reminderEndMin'>): number[] {
  if (s.reminderIntervalMin <= 0 || s.reminderEndMin < s.reminderStartMin) return [];
  const n = Math.floor((s.reminderEndMin - s.reminderStartMin) / s.reminderIntervalMin) + 1;
  return Array.from({ length: n }, (_, i) => s.reminderStartMin + i * s.reminderIntervalMin);
}

export function formatHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function reminderSummary(s: HydrationSettings): string {
  const times = computeReminderTimes(s);
  if (times.length === 0) return 'Aucun rappel.';
  const shown = times.length > 4 ? `${times.slice(0, 3).map(formatHM).join(', ')} ... ${formatHM(times[times.length - 1])}` : times.map(formatHM).join(', ');
  return `${times.length} rappel${times.length > 1 ? 's' : ''} par jour : ${shown}. Aucun rappel une fois l'objectif atteint.`;
}

// ── Libelles des lignes de reglage (valeur actuelle, orange) ──
export function formatMl(ml: number): string {
  return `${ml} ml`;
}

export function formatLitres(ml: number): string {
  return `${(ml / 1000).toFixed(1).replace('.', ',')} L`;
}

export function remindersRowValue(s: HydrationSettings): string {
  if (!s.remindersEnabled) return 'Désactivés';
  return `Toutes les ${s.reminderIntervalMin} min, ${formatHM(s.reminderStartMin)}-${formatHM(s.reminderEndMin)}`;
}
export const glassRowValue = (s: HydrationSettings): string => formatMl(s.glassMl);
export const coffeeRowValue = (s: HydrationSettings): string => (s.countCoffeeTea ? `Oui (à ${s.coffeeTeaPct}%)` : 'Non');
export const bonusRowValue = (s: HydrationSettings): string => `+${s.workoutBonusMl} ml`;

// ── Cafe / the, bonus, objectif ───────────────────────────────
/** ml comptes pour une boisson cafe/the : 0 si le reglage est eteint. */
export function coffeeCountedMl(drinkMl: number, s: Pick<HydrationSettings, 'countCoffeeTea' | 'coffeeTeaPct'>): number {
  if (!s.countCoffeeTea || !Number.isFinite(drinkMl) || drinkMl <= 0) return 0;
  return Math.round((drinkMl * s.coffeeTeaPct) / 100);
}

export function effectiveGoalMl(baseGoalMl: number, hasWorkoutToday: boolean, s: Pick<HydrationSettings, 'workoutBonusMl'>): number {
  return baseGoalMl + (hasWorkoutToday ? s.workoutBonusMl : 0);
}

export function validateGoalMl(raw: string): { ok: boolean; value: number | null; error: string | null } {
  const v = parseInt(raw.replace(/\s/g, ''), 10);
  if (!Number.isFinite(v)) return { ok: false, value: null, error: `Choisis une valeur entre ${GOAL_MIN_ML} et ${GOAL_MAX_ML} ml.` };
  if (v < GOAL_MIN_ML || v > GOAL_MAX_ML) return { ok: false, value: v, error: `Choisis une valeur entre ${GOAL_MIN_ML} et ${GOAL_MAX_ML} ml.` };
  return { ok: true, value: v, error: null };
}

export function validateAmountMl(raw: string): number | null {
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && v > 0 && v <= MAX_LOG_ML ? v : null;
}

// ── Dates locales (jamais UTC) ────────────────────────────────
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Bornes ISO [debut, fin[ du jour local de `d` (pour filtrer started_at). */
export function localDayBoundsIso(d: Date = new Date()): { startIso: string; endIso: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// ── Acces base (client injecte) ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HydrationClient = { from: (table: string) => any };

interface SettingsRow {
  reminders_enabled: boolean;
  reminder_interval_min: number;
  reminder_start_min: number;
  reminder_end_min: number;
  glass_ml: number;
  count_coffee_tea: boolean;
  coffee_tea_pct: number;
  workout_bonus_ml: number;
}

export function rowToSettings(row: Partial<SettingsRow> | null | undefined): HydrationSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return normalizeSettings({
    remindersEnabled: row.reminders_enabled,
    reminderIntervalMin: row.reminder_interval_min,
    reminderStartMin: row.reminder_start_min,
    reminderEndMin: row.reminder_end_min,
    glassMl: row.glass_ml,
    countCoffeeTea: row.count_coffee_tea,
    coffeeTeaPct: row.coffee_tea_pct,
    workoutBonusMl: row.workout_bonus_ml,
  });
}

export function settingsToRow(userId: string, s: HydrationSettings) {
  return {
    user_id: userId,
    reminders_enabled: s.remindersEnabled,
    reminder_interval_min: s.reminderIntervalMin,
    reminder_start_min: s.reminderStartMin,
    reminder_end_min: s.reminderEndMin,
    glass_ml: s.glassMl,
    count_coffee_tea: s.countCoffeeTea,
    coffee_tea_pct: s.coffeeTeaPct,
    workout_bonus_ml: s.workoutBonusMl,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchSettings(client: HydrationClient, userId: string): Promise<HydrationSettings> {
  const res = await client.from('ziko_hydration_settings').select('*').eq('user_id', userId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return rowToSettings(res.data);
}

export async function saveSettings(client: HydrationClient, userId: string, s: HydrationSettings): Promise<HydrationSettings> {
  const clean = normalizeSettings(s);
  const res = await client.from('ziko_hydration_settings').upsert(settingsToRow(userId, clean), { onConflict: 'user_id' });
  if (res.error) throw new Error(res.error.message);
  return clean;
}

/** Jour de seance = au moins une seance dont started_at tombe dans le jour local (D-05). */
export async function hasWorkoutOnDay(client: HydrationClient, userId: string, d: Date = new Date()): Promise<boolean> {
  const { startIso, endIso } = localDayBoundsIso(d);
  const res = await client
    .from('ziko_workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startIso)
    .lt('started_at', endIso)
    .limit(1);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).length > 0;
}
