import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { programHeader, programProgress, programProvenance, normalizeWorkoutRow } from '../programs';
import { itemSubtitle } from '../periodization';
// Traducteur de test : la vraie table (`strength` -> `Force`) est verifiee par packages/plugin-sdk/src/displayLabels.test.ts ;
// un import relatif du SDK sortirait du projet TS mobile (TS6307).
const goalLabel = (g: string | null | undefined, fb = ''): string => (g === 'strength' ? 'Force' : g === 'muscle_gain' ? 'Prise de masse' : g || fb);

const ME = 'user-1';

describe('programHeader : nom et provenance reels (UAT run 9, defaut 3)', () => {
  it('programme cree par l\'utilisateur dans l\'atelier : son nom, "Cree par moi", jamais "Coach Ziko"', () => {
    const h = programHeader({ kind: 'ai', name: 'Bloc de force', goal: 'strength', program_data: { generated: true } }, ME, goalLabel);
    expect(h.title).toBe('Bloc de force');
    expect(h.sub).toBe('Créé par moi');
    expect(h.sub).not.toMatch(/Coach Ziko|Intermédiaire/);
  });

  it('programme genere par l\'atelier IA : "Atelier IA"', () => {
    const h = programHeader({ kind: 'ai', name: 'Prise de masse', goal: 'muscle_gain', program_data: {} }, ME, goalLabel);
    expect(h).toMatchObject({ title: 'Prise de masse', provenance: 'ai', sub: 'Atelier IA' });
  });

  it('programme assigne par un coach : "Cree par ton coach" ; cree par moi dans la table coach : "Cree par moi"', () => {
    expect(programHeader({ kind: 'coach', name: 'Force 8 semaines', assigned_to_user_id: ME, created_by_coach_id: 'c1' }, ME, goalLabel).provenance).toBe('coach');
    expect(programProvenance({ kind: 'coach', created_by_coach_id: 'c1' }, ME)).toBe('coach');
    expect(programProvenance({ kind: 'coach', created_by_coach_id: ME, user_id: ME }, ME)).toBe('me');
  });

  it('sans nom : repli sur l\'objectif TRADUIT (jamais `strength`)', () => {
    expect(programHeader({ kind: 'ai', name: '  ', goal: 'strength' }, ME, goalLabel).title).toBe('Force');
    expect(programHeader({ kind: 'ai', name: null, goal: null }, ME, goalLabel, 'Programme').title).toBe('Programme');
  });
});

describe('frise "Ma suite" : objectif traduit (defaut 3)', () => {
  const item = { id: 'a', position: 1, status: 'next', name: 'Phase', weeks: 6, goal: 'strength' } as any;
  it('`strength` devient `Force`', () => {
    expect(itemSubtitle(item, (g) => goalLabel(g, g))).toBe('6 semaines · Force');
  });
  it('sans traducteur : valeur brute (compat)', () => {
    expect(itemSubtitle(item)).toBe('6 semaines · strength');
  });
  it('l\'ecran passe goalLabel', () => {
    const src = readFileSync(resolve(__dirname, '../../../app/(app)/workout/sequence.tsx'), 'utf8');
    expect(src).toMatch(/itemSubtitle\(it, \(g\) => goalLabel\(g, g\)\)/);
  });
});

describe('programProgress : une seule progression pour Programmes et Entrainement (defaut 4)', () => {
  const coachRow = { id: 'p1', name: 'Force', weeks_count: 8, current_cycle_week: 3, is_active: true, created_by_coach_id: 'c1' };
  it('semaine 3 sur 8 = 38 %', () => {
    expect(programProgress(coachRow)).toEqual({ week: 3, total: 8, percent: 38 });
  });
  it('la liste Programmes et l\'onglet Entrainement lisent exactement la meme valeur', () => {
    expect(normalizeWorkoutRow(coachRow, ME).progress).toEqual(programProgress(coachRow));
  });
  it('semaine au-dela du cycle : plafonnee ; donnees absentes : null (jamais "1 / 0")', () => {
    expect(programProgress({ ...coachRow, current_cycle_week: 12 })).toEqual({ week: 8, total: 8, percent: 100 });
    expect(programProgress({ id: 'x', program_data: { weeks: [1, 2] } })).toBeNull();
    expect(programProgress(null)).toBeNull();
  });
  it('l\'onglet Entrainement n\'invente plus la semaine 1', () => {
    const src = readFileSync(resolve(__dirname, '../../../app/(app)/workout/index.tsx'), 'utf8');
    expect(src).not.toMatch(/const currentWeek = 1/);
    expect(src).not.toMatch(/Coach Ziko · Intermédiaire/);
    expect(src).toMatch(/programProgress\(activeProgram/);
    expect(src).toMatch(/programHeader\(activeProgram/);
  });
});
