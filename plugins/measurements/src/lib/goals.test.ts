import { describe, it, expect } from 'vitest';
import {
  computeGoalProgress,
  isGoalReached,
  remainingToTarget,
  validateGoalDraft,
  GOAL_MESSAGES,
  latestPerMeasure,
  parseDecimal,
  formatValue,
  MEASURES,
  ENTRY_ORDER,
  goalDirection,
} from './goals';

describe('computeGoalProgress (ME-3)', () => {
  it('baisse : (82 ; 79,4 ; 76) = 43', () => {
    expect(computeGoalProgress(82, 76, 79.4)).toBe(43);
  });
  it('hausse : (36 ; 37,2 ; 40) = 30', () => {
    expect(computeGoalProgress(36, 40, 37.2)).toBe(30);
  });
  it('courant = départ -> 0', () => {
    expect(computeGoalProgress(82, 76, 82)).toBe(0);
    expect(computeGoalProgress(36, 40, 36)).toBe(0);
  });
  it('mauvais sens -> 0 (baisse et hausse)', () => {
    expect(computeGoalProgress(82, 76, 84)).toBe(0);
    expect(computeGoalProgress(36, 40, 34)).toBe(0);
  });
  it('au-delà de la cible -> 100 (baisse et hausse)', () => {
    expect(computeGoalProgress(82, 76, 75)).toBe(100);
    expect(computeGoalProgress(36, 40, 41)).toBe(100);
  });
  it('cible exactement atteinte -> 100', () => {
    expect(computeGoalProgress(82, 76, 76)).toBe(100);
    expect(computeGoalProgress(36, 40, 40)).toBe(100);
  });
  it('99,6 arrondi reste 99 tant que non atteint', () => {
    // 100 x (1000 - 996,02) / (1000 - 0) ~ 0,398 : on construit 99,6 % exact
    // départ 100, cible 0, courant 0,4 -> 99,6 -> arrondi 100 -> borné à 99
    expect(computeGoalProgress(100, 0, 0.4)).toBe(99);
    expect(isGoalReached(100, 0, 0.4)).toBe(false);
  });
  it('départ = cible -> 0 (jamais de division par zéro)', () => {
    expect(computeGoalProgress(80, 80, 79)).toBe(0);
    expect(Number.isNaN(computeGoalProgress(80, 80, 80))).toBe(false);
  });
  it('aucune mesure courante (null / NaN) -> 0', () => {
    expect(computeGoalProgress(82, 76, null)).toBe(0);
    expect(computeGoalProgress(82, 76, undefined)).toBe(0);
    expect(computeGoalProgress(82, 76, Number.NaN)).toBe(0);
  });
  it('toujours borné [0,100] sur une grille', () => {
    for (let c = 60; c <= 100; c += 0.7) {
      const a = computeGoalProgress(82, 76, c);
      const b = computeGoalProgress(76, 82, c);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(100);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(100);
    }
  });
  it('monotone en direction de la cible', () => {
    expect(computeGoalProgress(82, 76, 80)).toBeLessThan(computeGoalProgress(82, 76, 78));
  });
});

describe('sens et écart restant', () => {
  it('direction', () => {
    expect(goalDirection(82, 76)).toBe('down');
    expect(goalDirection(36, 40)).toBe('up');
  });
  it('remaining : 79,4 -> 76 = 3,4 ; jamais négatif', () => {
    expect(remainingToTarget(82, 76, 79.4)).toBe(3.4);
    expect(remainingToTarget(82, 76, 70)).toBe(0);
    expect(remainingToTarget(36, 40, null)).toBe(4);
  });
});

describe('validateGoalDraft (ME-7, D-05)', () => {
  it('cible = départ refusée avec le message exact', () => {
    const issue = validateGoalDraft({ measureKey: 'arm_cm', start: 37.2, target: 37.2 });
    expect(issue).toBe('target_equals_start');
    expect(GOAL_MESSAGES[issue!]).toBe('La cible doit être différente du point de départ.');
  });
  it('valide : poids 79,4 -> 76', () => {
    expect(validateGoalDraft({ measureKey: 'weight_kg', start: 79.4, target: 76 })).toBeNull();
  });
  it('mesure, départ, cible requis', () => {
    expect(validateGoalDraft({ measureKey: null, start: 1, target: 2 })).toBe('measure_required');
    expect(validateGoalDraft({ measureKey: 'weight_kg', start: null, target: 76 })).toBe('start_required');
    expect(validateGoalDraft({ measureKey: 'weight_kg', start: 80, target: null })).toBe('target_required');
  });
  it('hors plage refusé', () => {
    expect(validateGoalDraft({ measureKey: 'weight_kg', start: 80, target: 5 })).toBe('target_out_of_range');
    expect(validateGoalDraft({ measureKey: 'body_fat_pct', start: 90, target: 20 })).toBe('start_out_of_range');
  });
});

describe('7 mesures (ME-4, MEAS-04)', () => {
  it('les 7 mesures sont proposées à la création, dans l ordre E13', () => {
    expect(MEASURES.map((m) => m.chip)).toEqual([
      'Poids', 'Taille', 'Bras', 'Poitrine', 'Cuisses', 'Hanches', 'Masse grasse',
    ]);
  });
  it('les 7 mesures sont proposées à la saisie, dans l ordre E15', () => {
    expect(ENTRY_ORDER).toEqual([
      'weight_kg', 'body_fat_pct', 'waist_cm', 'chest_cm', 'arm_cm', 'thigh_cm', 'hip_cm',
    ]);
    expect(new Set(ENTRY_ORDER).size).toBe(7);
  });
});

describe('latestPerMeasure', () => {
  it('remonte à la dernière valeur renseignée par mesure', () => {
    const r = latestPerMeasure([
      { date: '2026-11-11', weight_kg: 79.4, arm_cm: null },
      { date: '2026-11-05', weight_kg: 80, arm_cm: '37.2', waist_cm: 84 },
    ]);
    expect(r.weight_kg).toEqual({ value: 79.4, date: '2026-11-11' });
    expect(r.arm_cm).toEqual({ value: 37.2, date: '2026-11-05' });
    expect(r.waist_cm?.value).toBe(84);
    expect(r.hip_cm).toBeUndefined();
  });
});

describe('saisie décimale', () => {
  it('virgule et point', () => {
    expect(parseDecimal('79,4')).toBe(79.4);
    expect(parseDecimal(' 76.0 ')).toBe(76);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
  it('format français', () => {
    expect(formatValue(79.4)).toBe('79,4');
    expect(formatValue(76)).toBe('76,0');
  });
});
