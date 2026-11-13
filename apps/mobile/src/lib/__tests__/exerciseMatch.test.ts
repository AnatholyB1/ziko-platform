import { describe, it, expect, vi } from 'vitest';
import { resolveExercise, searchPatternsFor, normalizeExerciseName } from '../exerciseMatch';
import { plannedStartFeedback, applyPlannedStartFeedback } from '../plannedStartFeedback';

const FR = { 'Back Squat': 'Squat arrière', 'Bench Press': 'Développé couché' };
const rows = [
  { id: 'a', name: 'back squat', name_fr: null },
  { id: 'b', name: 'jump squat', name_fr: null },
  { id: 'c', name: 'barbell front squat', name_fr: null },
  { id: 'd', name: 'Bench Press', name_fr: null },
];

describe('normalizeExerciseName', () => {
  it('casse, accents et ponctuation', () => {
    expect(normalizeExerciseName('  Développé-Couché (barre) ')).toBe('developpe couche barre');
  });
});

describe('resolveExercise (P24 run4)', () => {
  it('exact normalise insensible a la casse et aux accents', () => {
    expect(resolveExercise('BACK  SQUAT', rows, FR)?.id).toBe('a');
  });
  it('"Squat" absent sous ce nom -> alias generique vers le squat arriere (jamais jump squat)', () => {
    expect(resolveExercise('Squat', rows, FR)?.id).toBe('a');
  });
  it('anglais <-> francais via exerciseNames', () => {
    expect(resolveExercise('Développé couché', rows, FR)?.id).toBe('d');
    expect(resolveExercise('squat arriere', rows, FR)?.id).toBe('a');
  });
  it('unique plus proche : accepte, plusieurs -> ambigu -> null', () => {
    expect(resolveExercise('front squat', rows, FR)?.id).toBe('c');
    expect(resolveExercise('squat', rows.filter((r) => r.id !== 'a'), FR)).toBeNull();
  });
  it('inconnu ou vide -> null', () => {
    expect(resolveExercise('Zercher carry', rows, FR)).toBeNull();
    expect(resolveExercise('', rows, FR)).toBeNull();
  });
});

describe('searchPatternsFor', () => {
  it('mot le plus long, alias et equivalent anglais d\'un nom francais', () => {
    expect(searchPatternsFor('Squat', FR)).toContain('%squat%');
    expect(searchPatternsFor('Développé couché', FR)).toContain('%Bench Press%');
  });
});

describe('plannedStartFeedback', () => {
  it('seance demarree avec des exercices non resolus : navigue + toast neutre qui les liste', () => {
    const fb = plannedStartFeedback({ ok: true, unresolved: ['Zercher carry'] });
    expect(fb.navigate).toBe(true);
    expect(fb.toast).toContain('Zercher carry');
    expect(fb.alert).toBeUndefined();
  });
  it('tout resolu : aucun message', () => {
    expect(plannedStartFeedback({ ok: true, unresolved: [] })).toEqual({ navigate: true });
  });
  it('aucun exercice resolu : alerte claire + lien vers l\'edition, pas de navigation', () => {
    const deps = { toast: vi.fn(), alert: vi.fn(), openEdit: vi.fn(), openSession: vi.fn() };
    applyPlannedStartFeedback({ ok: false, reason: 'no_exercises', unresolved: ['X', 'Y'] }, deps);
    expect(deps.openSession).not.toHaveBeenCalled();
    expect(deps.alert).toHaveBeenCalledTimes(1);
    const [title, msg, buttons] = deps.alert.mock.calls[0];
    expect(title).toBe('Séance indisponible');
    expect(msg).toContain('X, Y');
    buttons[0].onPress();
    expect(deps.openEdit).toHaveBeenCalled();
  });
});
