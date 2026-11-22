import { describe, expect, it } from 'vitest';
import { cleanExerciseName, withCatalogIds } from './catalogIds.js';
import { findCatalogExercises } from './catalogSearch.js';
import { normalizeExercise, normalizeProgram } from './draft.js';

const ROWS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'dumbbell incline bench press', name_fr: 'développé couché incliné haltères' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'lever lying leg curl', name_fr: 'curl jambes allongé machine' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'barbell full squat', name_fr: 'squat complet barre' },
];

function fakeDb(rows = ROWS): any {
  return {
    from: () => {
      let or = '';
      const q: any = {
        select: () => q,
        or: (s: string) => { or = s; return q; },
        limit: async () => {
          const pats = or.split(',').map((c) => c.split('.ilike.')[1].replace(/%/g, '').toLowerCase());
          return { data: rows.filter((r) => pats.some((p) => r.name.toLowerCase().includes(p) || (r.name_fr ?? '').toLowerCase().includes(p))) };
        },
      };
      return q;
    },
  };
}

const program = (names: string[]) =>
  normalizeProgram({ name: 'P', sessions: [{ name: 'S', day_of_week: 1, exercises: names.map((name) => ({ name, sets: 3, reps: '8' })) }], weeks_count: 1 });

describe('cleanExerciseName', () => {
  it('drops parenthetical notes', () => {
    expect(cleanExerciseName('Squat barre (avec ceinture)')).toBe('Squat barre');
    expect(cleanExerciseName('(machine)')).toBe('(machine)');
  });
});

describe('normalizeExercise', () => {
  it('keeps a valid exercise_id and drops an invalid one', () => {
    expect(normalizeExercise({ name: 'x', sets: 3, reps: '8', exercise_id: ROWS[0].id }).exercise_id).toBe(ROWS[0].id);
    expect(normalizeExercise({ name: 'x', sets: 3, reps: '8', exercise_id: 'nope' }).exercise_id).toBeUndefined();
  });
});

describe('withCatalogIds', () => {
  it('attaches catalogue ids to recognised exercises and leaves unknown ones alone', async () => {
    const out = await withCatalogIds(fakeDb(), program(['Squat barre (avec ceinture)', 'Zzz inconnu']));
    const ex = out.weeks[0].sessions[0].exercises;
    expect(ex[0].exercise_id).toBe(ROWS[2].id);
    expect(ex[1].exercise_id).toBeUndefined();
  });
  it('never throws when the catalogue query fails', async () => {
    const db: any = { from: () => { throw new Error('boom'); } };
    const p = program(['Squat barre']);
    await expect(withCatalogIds(db, p)).resolves.toBe(p);
  });
});

describe('findCatalogExercises', () => {
  it('returns catalogue names with ids per query', async () => {
    const res = await findCatalogExercises(fakeDb(), ['Développé incliné haltères', 'Leg curl couché (machine)']);
    expect(res[0].results[0].id).toBe(ROWS[0].id);
    expect(res[1].results.map((r) => r.id)).toContain(ROWS[1].id);
  });
});
