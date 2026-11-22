/**
 * Phase 16 (v1.20) - MEAS-02 : evenement `goal` de l'onboarding IA (fonctions pures).
 * Prouve : seule une charge utile complete et coherente donne une carte, libelles FR, pas de doublon.
 * Ne prouve PAS le rendu natif ni le flux SSE reel (UAT emulateur avec le faux Anthropic).
 */
import { describe, it, expect } from 'vitest';
import { addGoal, goalDirectionLabel, goalSummary, parseGoalEvent } from './onboardingGoals';

const ok = { id: 'g1', measure: 'Poids', measure_key: 'weight_kg', start_value: 82, target_value: 76, unit: 'kg', target_date: null };

describe('parseGoalEvent', () => {
  it('accepte une charge utile complete', () => expect(parseGoalEvent(ok)).toMatchObject({ id: 'g1', measure_key: 'weight_kg', start_value: 82, target_value: 76 }));
  it('refuse null, mesure absente, valeurs non numeriques, cible = depart, unite absente', () => {
    expect(parseGoalEvent(null)).toBeNull();
    expect(parseGoalEvent({ ...ok, measure_key: undefined })).toBeNull();
    expect(parseGoalEvent({ ...ok, target_value: 'x' })).toBeNull();
    expect(parseGoalEvent({ ...ok, target_value: 82 })).toBeNull();
    expect(parseGoalEvent({ ...ok, unit: '' })).toBeNull();
  });
});

describe('libelles', () => {
  const g = parseGoalEvent(ok)!;
  it('resume', () => expect(goalSummary(g)).toBe('Poids : 82 → 76 kg'));
  it('direction', () => {
    expect(goalDirectionLabel(g)).toBe('Baisse de 6 kg');
    expect(goalDirectionLabel({ ...g, start_value: 36, target_value: 40.5, unit: 'cm' })).toBe('Hausse de 4,5 cm');
  });
});

describe('addGoal', () => {
  it('ne duplique pas (id, ou mesure sans id)', () => {
    const g = parseGoalEvent(ok)!;
    expect(addGoal(addGoal([], g), g)).toHaveLength(1);
    const noId = { ...g, id: null };
    expect(addGoal([noId], { ...noId })).toHaveLength(1);
    expect(addGoal([g], { ...g, id: 'g2', measure_key: 'arm_cm' })).toHaveLength(2);
  });
});
