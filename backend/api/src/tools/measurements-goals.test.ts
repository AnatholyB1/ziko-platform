/**
 * Phase 16 (v1.20) - MEAS-03 / MEAS-09 : enregistrement de l'outil measurements_goals (additif au registre) et
 * extension de la metrique de quete. Prouve : outil expose a l'agent (schema + executeur), pas d'action de
 * suppression d'objectif, motifs de modification limites aux 4 prevus dans le schema, quests_create accepte
 * measurement_logs, liste blanche de metriques cote regles pures. Ne prouve PAS le choix d'outil du vrai modele.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: vi.fn() })) }));

import { allToolSchemas, getToolExecutor, INTERNAL_ONLY_TOOLS } from './registry.js';
import { QUEST_METRICS, normalizeProposal } from '../quests/rules.js';

describe('measurements_goals dans le registre', () => {
  const schema: any = allToolSchemas.find((t) => t.name === 'measurements_goals');
  it('est expose (schema + executeur) et n\'est pas interne', () => {
    expect(schema).toBeTruthy();
    expect(getToolExecutor('measurements_goals')).toBeTypeOf('function');
    expect(INTERNAL_ONLY_TOOLS.has('measurements_goals')).toBe(false);
  });
  it('actions : list, create, revise, quest (aucune suppression)', () => {
    expect(schema.parameters.properties.action.enum).toEqual(['list', 'create', 'revise', 'quest']);
    expect(schema.parameters.required).toEqual(['action']);
  });
  it('motifs de modification = les 4 prevus', () => {
    expect(schema.parameters.properties.reason.enum).toEqual(['stagnation', 'pace', 'injury_pause', 'main_goal_change']);
  });
  it('les 3 outils de mesures existants sont inchanges', () => {
    for (const n of ['measurements_log', 'measurements_get_history', 'measurements_get_progress']) {
      expect(allToolSchemas.some((t) => t.name === n)).toBe(true);
    }
  });
});

describe('metrique de quete measurement_logs', () => {
  it('est dans la liste blanche et normalisee (cible bornee 1..7)', () => {
    expect(QUEST_METRICS).toContain('measurement_logs');
    const p = normalizeProposal({ title: 'Mesure-toi', metric: 'measurement_logs', target: 20, scope: 'weekly', duration_hours: 168 });
    expect(p).toMatchObject({ metric: 'measurement_logs', target: 7, unit: 'mesures' });
  });
  it('quests_create accepte measurement_logs dans son schema', () => {
    const q: any = allToolSchemas.find((t) => t.name === 'quests_create');
    expect(q.parameters.properties.metric.enum).toContain('measurement_logs');
  });
});
