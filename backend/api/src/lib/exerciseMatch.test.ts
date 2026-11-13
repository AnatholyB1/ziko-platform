import { describe, it, expect } from 'vitest';
import { matchExerciseNames, normalizeExerciseName } from './exerciseMatch.js';
import { createWorkshopTools } from '../workshop/tools.js';

describe('matchExerciseNames', () => {
  const names = ['Jump Squat', 'Squat', 'Front Squat', 'Développé couché', 'Soulevé de terre'];

  it('exact normalise prioritaire : "squat" -> Squat, jamais Jump Squat', () => {
    expect(matchExerciseNames('squat', names)).toEqual(['Squat']);
    expect(matchExerciseNames('SQUAT ', names)).toEqual(['Squat']);
  });
  it('insensible aux accents et a la ponctuation', () => {
    expect(matchExerciseNames('developpe couche', names)).toEqual(['Développé couché']);
    expect(matchExerciseNames('Souleve-de-terre', names)).toEqual(['Soulevé de terre']);
  });
  it('sans exact : le plus proche seulement s il est unique', () => {
    expect(matchExerciseNames('jump', ['Jump Squat', 'Squat'])).toEqual(['Jump Squat']);
    expect(matchExerciseNames('squat', ['Jump Squat', 'Front Squat'])).toEqual([]); // ambigu
    expect(matchExerciseNames('curl', names)).toEqual([]);
  });
  it('requete vide -> rien', () => {
    expect(matchExerciseNames('  ', names)).toEqual([]);
    expect(normalizeExerciseName('Élévation  latérale!')).toBe('elevation laterale');
  });
});

describe('workshop_get_context : filtre par exercice (bilan P24)', () => {
  it('"Squat" ne remonte pas les series de "Jump Squat"', async () => {
    const ctx: any = {
      records: [
        { exercise: 'Squat', e1rm_kg: 140, best_set: '120 kg x 5' },
        { exercise: 'Jump Squat', e1rm_kg: 60, best_set: '40 kg x 5' },
      ],
      recentSessions: [
        { id: 's1', top_sets: [{ exercise: 'Squat', weight_kg: 120, reps: 5 }, { exercise: 'Jump Squat', weight_kg: 40, reps: 5 }] },
      ],
    };
    const tools: any = createWorkshopTools({ getContext: async () => ctx } as any);
    const out: any = await tools.workshop_get_context.execute({ exercise: 'squat' }, {} as any);
    expect(out.records.map((r: any) => r.exercise)).toEqual(['Squat']);
    expect(out.sessions[0].top_sets.map((t: any) => t.exercise)).toEqual(['Squat']);
  });
});
