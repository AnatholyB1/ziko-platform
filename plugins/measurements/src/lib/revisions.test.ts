/**
 * Phase 16 (v1.20) - MEAS-08 : libelles des modifications d'objectif par l'IA (fonctions pures).
 * Prouve : une raison lisible pour chacun des 4 motifs (et un repli neutre), description cible/date, tri et
 * filtre des non acquittees. Ne prouve PAS le rendu du bandeau (UAT emulateur).
 */
import { describe, it, expect } from 'vitest';
import { REVISION_REASON_LABELS, describeRevisionChange, reasonLabel, unacknowledged, type GoalRevisionRow } from './revisions';

const rev = (over: Partial<GoalRevisionRow> = {}): GoalRevisionRow => ({
  id: 'r', goal_id: 'g', measure_key: 'weight_kg', reason: 'stagnation', reason_detail: null,
  old_target: 80, new_target: 85, old_target_date: null, new_target_date: null, acknowledged_at: null,
  created_at: '2026-02-01T10:00:00Z', ...over,
});

describe('reasonLabel', () => {
  it('un libelle par motif prevu, sans mot punitif', () => {
    expect(Object.keys(REVISION_REASON_LABELS).sort()).toEqual(['injury_pause', 'main_goal_change', 'pace', 'stagnation']);
    for (const k of Object.keys(REVISION_REASON_LABELS)) expect(reasonLabel(k)).not.toMatch(/échec|raté|pénalit/i);
  });
  it('repli neutre pour un motif inconnu', () => expect(reasonLabel('autre')).toBe('Ajustement de ton coach IA'));
});

describe('describeRevisionChange', () => {
  it('cible modifiee', () => expect(describeRevisionChange(rev(), 'kg')).toBe('Cible 80 → 85 kg'));
  it('decimales a la francaise', () => expect(describeRevisionChange(rev({ old_target: 79.5, new_target: 82.25 }), 'kg')).toBe('Cible 79,5 → 82,3 kg'));
  it('date seule modifiee', () => expect(describeRevisionChange(rev({ new_target: 80, new_target_date: '2026-09-01' }), 'kg')).toBe('Nouvelle date : 01/09/2026'));
  it('cible et date', () => expect(describeRevisionChange(rev({ new_target_date: '2026-09-01' }), 'kg')).toBe('Cible 80 → 85 kg · Nouvelle date : 01/09/2026'));
});

describe('unacknowledged', () => {
  it('filtre les acquittees et trie par date decroissante', () => {
    const out = unacknowledged([rev({ id: 'a' }), rev({ id: 'b', created_at: '2026-03-01T10:00:00Z' }), rev({ id: 'c', acknowledged_at: '2026-02-02T00:00:00Z' })]);
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
