import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatedStartFeedback } from '../plannedStartFeedback';

describe('generatedStartFeedback (UATN-03)', () => {
  it('seance demarree -> navigation vers la seance', () => {
    expect(generatedStartFeedback({ ok: true })).toEqual({ navigate: true });
  });
  it('exercices ignores -> navigation + toast', () => {
    const fb = generatedStartFeedback({ ok: true, unresolved: ['Xyz'] });
    expect(fb.navigate).toBe(true);
    expect(fb.toast).toContain('Xyz');
  });
  it('exercices non reconnus : jamais ignores en silence, message "N exercice(s) non reconnu(s) ignore(s) : ..."', () => {
    const one = generatedStartFeedback({ ok: true, unresolved: ['Gainage planche'] });
    expect(one.toast).toBe('1 exercice non reconnu ignoré : Gainage planche');
    const many = generatedStartFeedback({ ok: true, unresolved: ['A b', 'C d', 'E f', 'G h'] });
    expect(many.toast).toBe('4 exercices non reconnus ignorés : A b, C d, E f +1');
    expect(many.navigate).toBe(true);
  });
  it('remplacements : resume compact (1er + "+N"), liste complete dans toastDetail', () => {
    const rep = [
      { from: 'Squat goblet', to: 'dumbbell goblet squat' },
      { from: 'Rowing unilatéral', to: 'single arm cable row' },
      { from: 'Gainage planche', to: 'weighted front plank' },
    ];
    const fb = generatedStartFeedback({ ok: true, replaced: rep });
    expect(fb.toast).toBe('3 exercices remplacés : Squat goblet par dumbbell goblet squat +2');
    expect(fb.toast!.length).toBeLessThan(70);
    expect(fb.toastDetail).toBe(
      'Exercices remplacés : Squat goblet par dumbbell goblet squat, Rowing unilatéral par single arm cable row, Gainage planche par weighted front plank',
    );
  });
  it('un seul remplacement : pas de detail separe', () => {
    const fb = generatedStartFeedback({ ok: true, replaced: [{ from: 'A', to: 'B' }] });
    expect(fb.toast).toBe('Exercice remplacé : A par B');
    expect(fb.toastDetail).toBeUndefined();
  });
  it('remplacements + ignores : resume + ligne ignores, detail complet', () => {
    const fb = generatedStartFeedback({ ok: true, replaced: [{ from: 'A', to: 'B' }, { from: 'C', to: 'D' }], unresolved: ['Zz'] });
    expect(fb.toast).toBe('2 exercices remplacés : A par B +1 · 1 exercice non reconnu ignoré : Zz');
    expect(fb.toastDetail).toBe('Exercices remplacés : A par B, C par D · 1 exercice non reconnu ignoré : Zz');
  });
  it('rien charge -> aucune navigation, message de regeneration', () => {
    const fb = generatedStartFeedback({ ok: false, reason: 'no_exercises', unresolved: ['Xyz'] });
    expect(fb.navigate).toBe(false);
    expect(fb.alert?.message).toContain('Régénère');
  });
});

describe('ai-generate : "Démarrer cette séance" charge la séance générée', () => {
  const src = readFileSync(resolve(__dirname, '../../../app/(app)/workout/ai-generate.tsx'), 'utf8');
  it('appelle startGeneratedSession avec les exercices générés', () => {
    expect(src).toContain('startGeneratedSession(generatedSession.exercises');
  });
  it('ne pousse plus /workout/session sans charger la séance (onPress direct)', () => {
    expect(src).not.toMatch(/onPress=\{\(\) => router\.push\('\/\(app\)\/workout\/session'\)\}/);
  });
});
