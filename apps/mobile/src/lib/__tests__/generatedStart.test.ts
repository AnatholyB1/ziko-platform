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
