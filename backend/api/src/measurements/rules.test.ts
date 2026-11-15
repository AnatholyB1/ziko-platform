/**
 * Phase 16 (v1.20) - MEAS-07 : regles pures des modifications d'objectif par l'IA.
 * Prouve : les 4 motifs (et seulement eux), seuils de stagnation / rythme, mesures obsoletes ou insuffisantes
 * refusees, declaratifs exigeant la phrase de l'utilisateur, validation de creation.
 * Ne prouve PAS : la pertinence de ces seuils pour de vraies personnes (G-2), ni la revalidation SQL.
 */
import { describe, it, expect } from 'vitest';
import { checkRevisionReason, progressFraction, validateNewGoal, daysBetween, type GoalForRules, type Reading } from './rules.js';

const goal = (over: Partial<GoalForRules> = {}): GoalForRules => ({
  measure_key: 'weight_kg',
  start_value: 90,
  target_value: 80,
  start_date: '2026-01-01',
  target_date: null,
  ...over,
});
const r = (date: string, value: number): Reading => ({ date, value });

describe('daysBetween / progressFraction', () => {
  it('compte des jours calendaires', () => {
    expect(daysBetween('2026-01-01', '2026-01-29')).toBe(28);
  });
  it('baisse : 90 -> 80, valeur 85 = 50 %, atteint = 100 %, mauvais sens = 0', () => {
    expect(progressFraction(goal(), 85)).toBeCloseTo(0.5);
    expect(progressFraction(goal(), 79)).toBe(1);
    expect(progressFraction(goal(), 95)).toBe(0);
  });
});

describe('checkRevisionReason - motifs', () => {
  it('refuse tout motif hors des 4 prevus', () => {
    const v = checkRevisionReason({ reason: 'user_asked', goal: goal(), readings: [], today: '2026-03-01' });
    expect(v).toMatchObject({ allowed: false, code: 'reason_not_allowed' });
    expect(checkRevisionReason({ reason: '', goal: goal(), readings: [], today: '2026-03-01' }).allowed).toBe(false);
  });

  it('injury_pause / main_goal_change : exigent la phrase de l utilisateur', () => {
    for (const reason of ['injury_pause', 'main_goal_change']) {
      expect(checkRevisionReason({ reason, goal: goal(), readings: [], today: '2026-01-05' })).toMatchObject({ allowed: false, code: 'user_statement_required' });
      expect(checkRevisionReason({ reason, goal: goal(), readings: [], today: '2026-01-05', userStatement: '   ' }).allowed).toBe(false);
      expect(checkRevisionReason({ reason, goal: goal(), readings: [], today: '2026-01-05', userStatement: "je me suis blessé au genou" })).toMatchObject({ allowed: true, code: 'ok_declared' });
    }
  });
});

describe('checkRevisionReason - stagnation', () => {
  const base = { reason: 'stagnation', goal: goal() };
  it('refuse avant 28 jours', () => {
    expect(checkRevisionReason({ ...base, readings: [r('2026-01-02', 90), r('2026-01-20', 90)], today: '2026-01-25' })).toMatchObject({ allowed: false, code: 'goal_too_recent' });
  });
  it('accepte une progression nulle sur >= 28 jours avec mesure recente', () => {
    const v = checkRevisionReason({ ...base, readings: [r('2026-01-02', 89.8), r('2026-02-03', 89.7)], today: '2026-02-05' });
    expect(v).toMatchObject({ allowed: true, code: 'ok_stagnation' });
  });
  it('accepte un recul (mauvais sens)', () => {
    expect(checkRevisionReason({ ...base, readings: [r('2026-01-02', 89), r('2026-02-03', 91)], today: '2026-02-05' }).allowed).toBe(true);
  });
  it('refuse si la personne progresse (>= 5 % de la distance)', () => {
    const v = checkRevisionReason({ ...base, readings: [r('2026-01-02', 90), r('2026-02-03', 88)], today: '2026-02-05' });
    expect(v).toMatchObject({ allowed: false, code: 'still_progressing' });
  });
  it('refuse sans mesure, avec mesures obsoletes ou ne couvrant pas 28 jours', () => {
    expect(checkRevisionReason({ ...base, readings: [], today: '2026-03-01' })).toMatchObject({ code: 'not_enough_data' });
    expect(checkRevisionReason({ ...base, readings: [r('2026-01-02', 90), r('2026-01-31', 90)], today: '2026-03-01' })).toMatchObject({ code: 'stale_measurements' });
    expect(checkRevisionReason({ ...base, readings: [r('2026-02-10', 90), r('2026-02-20', 90)], today: '2026-02-22' })).toMatchObject({ allowed: false, code: 'not_enough_data' });
  });
  it('ignore les mesures anterieures au debut de l objectif', () => {
    const v = checkRevisionReason({ ...base, readings: [r('2025-11-01', 99), r('2026-02-03', 90)], today: '2026-02-05' });
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('not_enough_data');
  });
  it('hausse (bras) : stagnation calculee dans le bon sens', () => {
    const g = goal({ measure_key: 'arm_cm', start_value: 35, target_value: 40 });
    expect(checkRevisionReason({ reason: 'stagnation', goal: g, readings: [r('2026-01-02', 35), r('2026-02-03', 35.1)], today: '2026-02-05' }).allowed).toBe(true);
    expect(checkRevisionReason({ reason: 'stagnation', goal: g, readings: [r('2026-01-02', 35), r('2026-02-03', 36)], today: '2026-02-05' }).allowed).toBe(false);
  });
});

describe('checkRevisionReason - pace', () => {
  it('refuse avant 14 jours', () => {
    expect(checkRevisionReason({ reason: 'pace', goal: goal(), readings: [r('2026-01-05', 86)], today: '2026-01-10' })).toMatchObject({ code: 'goal_too_recent' });
  });
  it('poids : trop rapide (> 1 % du poids de depart par semaine)', () => {
    const v = checkRevisionReason({ reason: 'pace', goal: goal(), readings: [r('2026-01-20', 84)], today: '2026-01-22' });
    expect(v).toMatchObject({ allowed: true, code: 'ok_pace_fast' });
  });
  it('poids : rythme sain (0,5 %/sem) = refuse', () => {
    const v = checkRevisionReason({ reason: 'pace', goal: goal(), readings: [r('2026-01-29', 88)], today: '2026-01-30' });
    expect(v).toMatchObject({ allowed: false, code: 'pace_not_off' });
  });
  it('avec date cible : >= 50 % en < 25 % du temps = trop rapide ; passe 50 % du temps avec < 20 % = trop lent', () => {
    const g = goal({ measure_key: 'waist_cm', start_value: 100, target_value: 90, target_date: '2026-05-01' }); // 120 jours
    expect(checkRevisionReason({ reason: 'pace', goal: g, readings: [r('2026-01-20', 94)], today: '2026-01-22' })).toMatchObject({ allowed: true, code: 'ok_pace_fast' });
    expect(checkRevisionReason({ reason: 'pace', goal: g, readings: [r('2026-03-10', 99)], today: '2026-03-12' })).toMatchObject({ allowed: true, code: 'ok_pace_slow' });
    expect(checkRevisionReason({ reason: 'pace', goal: g, readings: [r('2026-03-10', 95)], today: '2026-03-12' })).toMatchObject({ allowed: false, code: 'pace_not_off' });
  });
  it('mesure obsolete ou absente = refuse (jamais de valeur inventee)', () => {
    expect(checkRevisionReason({ reason: 'pace', goal: goal(), readings: [], today: '2026-02-20' })).toMatchObject({ code: 'not_enough_data' });
    expect(checkRevisionReason({ reason: 'pace', goal: goal(), readings: [r('2026-01-20', 84)], today: '2026-03-20' })).toMatchObject({ code: 'stale_measurements' });
  });
});

describe('validateNewGoal', () => {
  const ok = { measure_key: 'weight_kg', start_value: 82, target_value: 76 };
  it('valide', () => expect(validateNewGoal(ok, '2026-01-01')).toBeNull());
  it('refuse mesure inconnue, valeurs manquantes, hors plage, cible = depart, date passee', () => {
    expect(validateNewGoal({ ...ok, measure_key: 'bmi' }, '2026-01-01')).toBe('invalid_measure');
    expect(validateNewGoal({ ...ok, target_value: NaN }, '2026-01-01')).toBe('value_required');
    expect(validateNewGoal({ ...ok, target_value: 10 }, '2026-01-01')).toBe('out_of_range');
    expect(validateNewGoal({ ...ok, target_value: 82 }, '2026-01-01')).toBe('target_equals_start');
    expect(validateNewGoal({ ...ok, target_date: '2025-12-31' }, '2026-01-01')).toBe('target_date_in_past');
    expect(validateNewGoal({ ...ok, target_date: '31/12/2026' }, '2026-01-01')).toBe('invalid_date');
    expect(validateNewGoal({ ...ok, target_date: '2026-06-01' }, '2026-01-01')).toBeNull();
  });
});
