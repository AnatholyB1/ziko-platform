// v1.20 Phase 16 (MEAS-07) - regles pures des objectifs de mesures geres par l'IA (aucune I/O, aucune horloge :
// la date du jour est passee en parametre). Les motifs de modification sont les 4 prevus et seulement ceux-la ;
// le service les verifie AVANT la RPC, et la RPC les revalide (motif dans la liste, delai, sens, plage).
// Miroir des plages de la RPC SQL (ziko_measure_meta) et de plugins/measurements/src/lib/goals.ts.

export const MEASURE_KEYS = ['weight_kg', 'waist_cm', 'arm_cm', 'chest_cm', 'thigh_cm', 'hip_cm', 'body_fat_pct'] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];

export const MEASURE_META: Record<MeasureKey, { unit: 'kg' | 'cm' | '%'; label: string; min: number; max: number }> = {
  weight_kg: { unit: 'kg', label: 'Poids', min: 20, max: 400 },
  waist_cm: { unit: 'cm', label: 'Tour de taille', min: 40, max: 250 },
  arm_cm: { unit: 'cm', label: 'Bras', min: 10, max: 80 },
  chest_cm: { unit: 'cm', label: 'Poitrine', min: 50, max: 250 },
  thigh_cm: { unit: 'cm', label: 'Cuisses', min: 20, max: 130 },
  hip_cm: { unit: 'cm', label: 'Hanches', min: 50, max: 250 },
  body_fat_pct: { unit: '%', label: 'Masse grasse', min: 2, max: 70 },
};

export const REVISION_REASONS = ['stagnation', 'pace', 'injury_pause', 'main_goal_change'] as const;
export type RevisionReason = (typeof REVISION_REASONS)[number];

/** Seuils (reglage unique, G-2 du CONTEXT). */
export const STAGNATION_DAYS = 28;
export const STAGNATION_MIN_PROGRESS = 0.05; // moins de 5 % de la distance depart-cible sur la fenetre
export const PACE_MIN_DAYS = 14;
export const PACE_FAST_WEIGHT_PCT_PER_WEEK = 1; // 1 % du poids de depart par semaine
export const PACE_FAST_PROGRESS = 0.5; // >= 50 % de la distance ...
export const PACE_FAST_TIME_FRACTION = 0.25; // ... en moins de 25 % de la duree prevue
export const PACE_SLOW_TIME_FRACTION = 0.5; // passe 50 % de la duree prevue ...
export const PACE_SLOW_PROGRESS = 0.2; // ... avec moins de 20 % de progression
export const FRESH_READING_DAYS = 14; // la derniere mesure doit dater de moins de 14 jours
export const REVISION_COOLDOWN_DAYS = 14; // aussi appliquee par la RPC

export interface GoalForRules {
  measure_key: MeasureKey;
  start_value: number;
  target_value: number;
  start_date: string; // YYYY-MM-DD
  target_date: string | null;
}
export interface Reading {
  date: string; // YYYY-MM-DD
  value: number;
}

export type RuleCode =
  | 'ok_stagnation'
  | 'ok_pace_fast'
  | 'ok_pace_slow'
  | 'ok_declared'
  | 'goal_too_recent'
  | 'not_enough_data'
  | 'stale_measurements'
  | 'still_progressing'
  | 'pace_not_off'
  | 'user_statement_required'
  | 'reason_not_allowed';

export interface RuleVerdict {
  allowed: boolean;
  code: RuleCode;
  detail: string;
}

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}
export function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso);
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** Pourcentage de progression borne 0..100 (meme formule que le client et l'outil de lecture). */
export function progressFraction(g: Pick<GoalForRules, 'start_value' | 'target_value'>, current: number): number {
  const total = g.start_value - g.target_value;
  if (total === 0) return 0;
  const reached = g.target_value < g.start_value ? current <= g.target_value : current >= g.target_value;
  if (reached) return 1;
  return Math.min(1, Math.max(0, (g.start_value - current) / total));
}

function sortedReadings(readings: Reading[], fromIso: string, todayIso: string): Reading[] {
  return readings
    .filter((r) => Number.isFinite(r.value) && r.date >= fromIso && r.date <= todayIso)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Verifie qu'un motif de modification est recevable. `stagnation` et `pace` s'appuient sur les mesures reelles ;
 * `injury_pause` et `main_goal_change` sont declaratifs (non verifiables par le serveur, G-3) : la phrase de
 * l'utilisateur est exigee et journalisee.
 */
export function checkRevisionReason(args: {
  reason: string;
  goal: GoalForRules;
  readings: Reading[];
  today: string;
  userStatement?: string | null;
}): RuleVerdict {
  const { reason, goal, today } = args;
  if (!REVISION_REASONS.includes(reason as RevisionReason)) {
    return { allowed: false, code: 'reason_not_allowed', detail: `motif parmi ${REVISION_REASONS.join(', ')}` };
  }
  if (reason === 'injury_pause' || reason === 'main_goal_change') {
    if (!args.userStatement || !args.userStatement.trim()) {
      return {
        allowed: false,
        code: 'user_statement_required',
        detail: "Reprends la phrase de l'utilisateur (blessure/pause ou nouvel objectif principal) dans user_statement.",
      };
    }
    return { allowed: true, code: 'ok_declared', detail: 'Declaration de l\'utilisateur journalisee.' };
  }

  const readings = sortedReadings(args.readings, goal.start_date, today);
  const last = readings[readings.length - 1];

  if (reason === 'stagnation') {
    const active = daysBetween(goal.start_date, today);
    if (active < STAGNATION_DAYS) {
      return { allowed: false, code: 'goal_too_recent', detail: `Objectif en cours depuis ${active} j (< ${STAGNATION_DAYS} j).` };
    }
    if (!last) return { allowed: false, code: 'not_enough_data', detail: 'Aucune mesure depuis le debut de l\'objectif.' };
    if (daysBetween(last.date, today) > FRESH_READING_DAYS) {
      return { allowed: false, code: 'stale_measurements', detail: `Derniere mesure il y a ${daysBetween(last.date, today)} j : demande une nouvelle mesure.` };
    }
    // Reference : derniere mesure situee au moins 28 j avant la plus recente.
    const baselines = readings.filter((r) => daysBetween(r.date, last.date) >= STAGNATION_DAYS);
    const base = baselines[baselines.length - 1];
    if (!base) return { allowed: false, code: 'not_enough_data', detail: `Il faut des mesures couvrant au moins ${STAGNATION_DAYS} j.` };
    const dir = sign(goal.target_value - goal.start_value);
    const moved = ((last.value - base.value) * dir) / Math.abs(goal.target_value - goal.start_value);
    if (moved >= STAGNATION_MIN_PROGRESS) {
      return { allowed: false, code: 'still_progressing', detail: `Progression de ${Math.round(moved * 100)} % sur la fenetre : pas de stagnation.` };
    }
    return { allowed: true, code: 'ok_stagnation', detail: `Progression de ${Math.round(Math.max(0, moved) * 100)} % sur ${daysBetween(base.date, last.date)} j.` };
  }

  // reason === 'pace'
  if (!last) return { allowed: false, code: 'not_enough_data', detail: 'Aucune mesure depuis le debut de l\'objectif.' };
  if (daysBetween(last.date, today) > FRESH_READING_DAYS) {
    return { allowed: false, code: 'stale_measurements', detail: `Derniere mesure il y a ${daysBetween(last.date, today)} j : demande une nouvelle mesure.` };
  }
  const elapsed = daysBetween(goal.start_date, today);
  if (elapsed < PACE_MIN_DAYS) {
    return { allowed: false, code: 'goal_too_recent', detail: `Objectif en cours depuis ${elapsed} j (< ${PACE_MIN_DAYS} j).` };
  }
  const prog = progressFraction(goal, last.value);
  const planned = goal.target_date ? daysBetween(goal.start_date, goal.target_date) : null;
  if (goal.measure_key === 'weight_kg') {
    const perWeek = (Math.abs(last.value - goal.start_value) / (elapsed / 7) / goal.start_value) * 100;
    const toward = sign(last.value - goal.start_value) === sign(goal.target_value - goal.start_value);
    if (toward && perWeek > PACE_FAST_WEIGHT_PCT_PER_WEEK) {
      return { allowed: true, code: 'ok_pace_fast', detail: `Rythme de ${perWeek.toFixed(1)} % du poids par semaine (> ${PACE_FAST_WEIGHT_PCT_PER_WEEK} %).` };
    }
  }
  if (planned && planned > 0) {
    const timeFrac = elapsed / planned;
    if (prog >= PACE_FAST_PROGRESS && timeFrac < PACE_FAST_TIME_FRACTION) {
      return { allowed: true, code: 'ok_pace_fast', detail: `${Math.round(prog * 100)} % atteints en ${Math.round(timeFrac * 100)} % du temps prevu.` };
    }
    if (timeFrac > PACE_SLOW_TIME_FRACTION && prog < PACE_SLOW_PROGRESS) {
      return { allowed: true, code: 'ok_pace_slow', detail: `${Math.round(prog * 100)} % atteints apres ${Math.round(timeFrac * 100)} % du temps prevu.` };
    }
  }
  return { allowed: false, code: 'pace_not_off', detail: 'Le rythme n\'est ni trop rapide ni trop lent selon les seuils.' };
}

export interface GoalDraft {
  measure_key: string;
  start_value: number;
  target_value: number;
  target_date?: string | null;
}

/** Validation de creation (miroir de ziko_ai_create_measurement_goal) : renvoie un code d'erreur ou null. */
export function validateNewGoal(d: GoalDraft, today: string): string | null {
  const meta = (MEASURE_META as Record<string, (typeof MEASURE_META)[MeasureKey]>)[d.measure_key];
  if (!meta) return 'invalid_measure';
  if (!Number.isFinite(d.start_value) || !Number.isFinite(d.target_value)) return 'value_required';
  if (d.start_value < meta.min || d.start_value > meta.max || d.target_value < meta.min || d.target_value > meta.max) return 'out_of_range';
  if (d.start_value === d.target_value) return 'target_equals_start';
  if (d.target_date && !/^\d{4}-\d{2}-\d{2}$/.test(d.target_date)) return 'invalid_date';
  if (d.target_date && d.target_date <= today) return 'target_date_in_past';
  return null;
}
