// Logique pure des objectifs de mesures (P15, MEAS-01/04/05/06).
// Aucun import React Native : testable sous vitest (node).

export type MeasureKey =
  | 'weight_kg'
  | 'waist_cm'
  | 'arm_cm'
  | 'chest_cm'
  | 'thigh_cm'
  | 'hip_cm'
  | 'body_fat_pct';

export interface MeasureDef {
  key: MeasureKey;
  label: string; // libellé long (carte, saisie)
  chip: string; // libellé court (puce de création)
  unit: 'kg' | 'cm' | '%';
  icon: string; // Ionicons
  min: number; // plage plausible (miroir de la RPC SQL)
  max: number;
}

/** Ordre des puces de création d'objectif (écran E13). */
export const MEASURES: MeasureDef[] = [
  { key: 'weight_kg', label: 'Poids', chip: 'Poids', unit: 'kg', icon: 'scale-outline', min: 20, max: 400 },
  { key: 'waist_cm', label: 'Tour de taille', chip: 'Taille', unit: 'cm', icon: 'resize-outline', min: 40, max: 250 },
  { key: 'arm_cm', label: 'Bras', chip: 'Bras', unit: 'cm', icon: 'barbell-outline', min: 10, max: 80 },
  { key: 'chest_cm', label: 'Poitrine', chip: 'Poitrine', unit: 'cm', icon: 'body-outline', min: 50, max: 250 },
  { key: 'thigh_cm', label: 'Cuisses', chip: 'Cuisses', unit: 'cm', icon: 'walk-outline', min: 20, max: 130 },
  { key: 'hip_cm', label: 'Hanches', chip: 'Hanches', unit: 'cm', icon: 'ellipse-outline', min: 50, max: 250 },
  { key: 'body_fat_pct', label: 'Masse grasse', chip: 'Masse grasse', unit: '%', icon: 'water-outline', min: 2, max: 70 },
];

/** Ordre des champs de saisie de mesure (écran E15). Seul le poids est obligatoire. */
export const ENTRY_ORDER: MeasureKey[] = [
  'weight_kg',
  'body_fat_pct',
  'waist_cm',
  'chest_cm',
  'arm_cm',
  'thigh_cm',
  'hip_cm',
];

export function getMeasure(key: string | null | undefined): MeasureDef | undefined {
  return MEASURES.find((m) => m.key === key);
}

export type GoalDirection = 'down' | 'up';

export function goalDirection(start: number, target: number): GoalDirection {
  return target < start ? 'down' : 'up';
}

/** Valeur courante ayant atteint ou franchi la cible dans le sens voulu. */
export function isGoalReached(start: number, target: number, current: number | null | undefined): boolean {
  if (current == null || !Number.isFinite(current) || start === target) return false;
  return goalDirection(start, target) === 'down' ? current <= target : current >= target;
}

/**
 * % de complétion borné [0,100] (D-03). Valable à la baisse ET à la hausse :
 * pct = clamp(round(100 x (départ - courant) / (départ - cible)), 0, 99) tant que non atteint,
 * 100 une fois la cible franchie. Mouvement dans le mauvais sens ou valeur absente = 0.
 */
export function computeGoalProgress(start: number, target: number, current: number | null | undefined): number {
  if (!Number.isFinite(start) || !Number.isFinite(target) || start === target) return 0;
  if (current == null || !Number.isFinite(current)) return 0;
  if (isGoalReached(start, target, current)) return 100;
  const raw = (100 * (start - current)) / (start - target);
  return Math.min(99, Math.max(0, Math.round(raw)));
}

/** Écart restant jusqu'à la cible, toujours >= 0, arrondi à 0,1. */
export function remainingToTarget(start: number, target: number, current: number | null | undefined): number {
  const cur = current == null || !Number.isFinite(current) ? start : current;
  const diff = goalDirection(start, target) === 'down' ? cur - target : target - cur;
  return Math.max(0, Math.round(diff * 10) / 10);
}

export interface GoalDraft {
  measureKey: MeasureKey | null;
  start: number | null;
  target: number | null;
}

export type GoalDraftIssue =
  | 'measure_required'
  | 'start_required'
  | 'target_required'
  | 'target_equals_start'
  | 'start_out_of_range'
  | 'target_out_of_range';

export const GOAL_MESSAGES: Record<GoalDraftIssue, string> = {
  measure_required: 'Choisis une mesure.',
  start_required: 'Indique ton point de départ.',
  target_required: 'Indique ta cible.',
  target_equals_start: 'La cible doit être différente du point de départ.',
  start_out_of_range: 'Ce point de départ semble hors de la plage possible.',
  target_out_of_range: 'Cette cible semble hors de la plage possible.',
};

/** Validation du formulaire de création (D-05, ME-7). Retourne la première erreur ou null. */
export function validateGoalDraft(d: GoalDraft): GoalDraftIssue | null {
  const m = getMeasure(d.measureKey);
  if (!m) return 'measure_required';
  if (d.start == null || !Number.isFinite(d.start)) return 'start_required';
  if (d.target == null || !Number.isFinite(d.target)) return 'target_required';
  if (d.start < m.min || d.start > m.max) return 'start_out_of_range';
  if (d.target < m.min || d.target > m.max) return 'target_out_of_range';
  if (d.target === d.start) return 'target_equals_start';
  return null;
}

/** Parse un nombre saisi (virgule ou point). null si vide ou invalide. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Format français : 79,4 (une décimale, virgule). */
export function formatValue(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace('.', ',');
}

/** Ligne de `ziko_athlete_goals` pour un objectif de mesure (measure_key non nul). */
export interface MeasurementGoalRow {
  id: string;
  user_id: string;
  goal_text: string;
  measure_key: MeasureKey;
  start_value: number;
  target_value: number;
  unit: string;
  status: 'active' | 'achieved' | 'abandoned';
  start_date: string | null;
  achieved_at: string | null;
  achieved_value: number | null;
  created_at: string;
}

type MeasureRow = Partial<Record<MeasureKey, number | string | null>> & { date?: string };

/**
 * Dernière valeur connue de chaque mesure : les mesures facultatives manquent sur la
 * dernière ligne, on remonte donc à la plus récente ligne où la colonne est renseignée.
 * `rows` doit être trié du plus récent au plus ancien.
 */
export function latestPerMeasure(
  rows: MeasureRow[],
): Partial<Record<MeasureKey, { value: number; date: string | null }>> {
  const out: Partial<Record<MeasureKey, { value: number; date: string | null }>> = {};
  for (const r of rows) {
    for (const m of MEASURES) {
      const v = r[m.key];
      if (out[m.key] === undefined && v != null) {
        out[m.key] = { value: Number(v), date: r.date ?? null };
      }
    }
  }
  return out;
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** '2026-11-12' ou ISO complet -> '12 nov.' (pas de décalage de fuseau : on lit les 10 premiers caractères). */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS_FR[Number(m[2]) - 1] ?? ''}`.trim();
}

/** Ferme une phrase apres une date abregee sans doubler le point (`13 nov.` + `.` -> `13 nov.`, pas `13 nov..`). */
export function endSentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`;
}

/**
 * Valeur courante d'un objectif : dernière valeur de la mesure enregistrée à partir du jour de départ
 * (une mesure antérieure au départ ne compte pas). Objectif atteint : valeur d'atteinte.
 * null = aucune nouvelle mesure. `rows` trié du plus récent au plus ancien.
 */
export function currentForGoal(
  goal: Pick<MeasurementGoalRow, 'measure_key' | 'start_date' | 'status' | 'achieved_value'>,
  rows: MeasureRow[],
): number | null {
  if (goal.status === 'achieved' && goal.achieved_value != null) return Number(goal.achieved_value);
  for (const r of rows) {
    const v = r[goal.measure_key];
    if (v == null) continue;
    if (goal.start_date && r.date && r.date < goal.start_date) continue;
    return Number(v);
  }
  return null;
}
