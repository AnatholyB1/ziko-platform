// Verification statique des migrations de la phase 18 (elles ne sont jamais appliquees par l'agent).
// Ne prouve PAS le comportement reel de la RLS : voir backend/api/test/rls/stretching.spec.ts (RUN_DB).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '../../../supabase/portfolio-migrations');
const ex = readFileSync(join(dir, '20261201180100_stretching_exercises.sql'), 'utf8');
const def = readFileSync(join(dir, '20261201180200_stretching_default_routine.sql'), 'utf8');

describe('20261201180100_stretching_exercises', () => {
  it('RLS activee, lecture catalogue + propres lignes', () => {
    expect(ex).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(ex).toMatch(/FOR SELECT TO authenticated\s+USING \(user_id IS NULL OR \(SELECT auth\.uid\(\)\) = user_id\)/);
  });
  it('ecriture client uniquement sur ses lignes : aucune policy d ecriture n autorise user_id NULL', () => {
    const writes = ex.match(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE)[^;]*;/g) ?? [];
    expect(writes).toHaveLength(3);
    for (const w of writes) {
      expect(w).toMatch(/\(SELECT auth\.uid\(\)\) = user_id/);
      expect(w).not.toMatch(/IS NULL/);
    }
  });
  it('REVOKE explicite des privileges de structure et de anon', () => {
    expect(ex).toMatch(/REVOKE ALL ON TABLE public\.ziko_stretching_exercises FROM PUBLIC, anon/);
    expect(ex).toMatch(/REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public\.ziko_stretching_exercises FROM authenticated, service_role/);
  });
  it('seed : 24 exercices de catalogue (user_id NULL), 6 par zone, noms uniques', () => {
    const rows = ex.match(/^  \(NULL, '(?:[^']|'')*',\s*'(?:back|legs|shoulders|hips)'/gm) ?? [];
    expect(rows).toHaveLength(24);
    const byZone: Record<string, number> = {};
    for (const r of rows) {
      const z = r.match(/'(back|legs|shoulders|hips)'$/)![1];
      byZone[z] = (byZone[z] ?? 0) + 1;
    }
    expect(byZone).toEqual({ back: 6, legs: 6, shoulders: 6, hips: 6 });
    const names = rows.map((r) => r.match(/^  \(NULL, '((?:[^']|'')*)'/)![1]);
    expect(new Set(names).size).toBe(24);
    expect(ex).toMatch(/ON CONFLICT DO NOTHING/);
  });
  it('contrainte mesure/valeur : duree ou repetitions renseignee', () => {
    expect(ex).toMatch(/measure = 'duration' AND duration_seconds IS NOT NULL/);
    expect(ex).toMatch(/measure = 'reps' AND reps IS NOT NULL/);
  });
});

describe('20261201180200_stretching_default_routine', () => {
  it('is_default + index unique partiel (1 defaut par user) + routine_id sur les logs', () => {
    expect(def).toMatch(/ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false/);
    expect(def).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ziko_uq_stretching_routines_one_default\s+ON public\.ziko_stretching_routines \(user_id\) WHERE is_default/);
    expect(def).toMatch(/ziko_stretching_logs\s+ADD COLUMN IF NOT EXISTS routine_id text/);
  });
  it('ne modifie aucune migration existante (nouveau fichier, aucune suppression de table)', () => {
    expect(def).not.toMatch(/DROP /);
    expect(ex).not.toMatch(/DROP /);
  });
});
