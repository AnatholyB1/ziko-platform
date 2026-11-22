import { describe, it, expect } from 'vitest';
import { activeProgramView, chooseActive, coachWorkoutsToProgramData, getActiveProgram, loadProgramForSession } from '../activeProgram';

describe('activeProgramView (run7 : Entrainement vs Programmes)', () => {
  const prog = (program_data: any) => ({ id: 'p', kind: 'coach' as const, name: 'X', goal: null, program_data });
  it('une erreur de lecture sans donnee n est PAS "aucun programme"', () => {
    expect(activeProgramView({ isLoading: false, isError: true, program: undefined })).toBe('error');
  });
  it('chargement puis vide', () => {
    expect(activeProgramView({ isLoading: true, isError: false, program: undefined })).toBe('loading');
    expect(activeProgramView({ isLoading: false, isError: false, program: null })).toBe('empty');
  });
  it('programme coach sans jour : message dedie, jamais un ecran vide', () => {
    expect(activeProgramView({ isLoading: false, isError: false, program: prog(coachWorkoutsToProgramData([])) })).toBe('no-sessions');
  });
  it('programme avec seances : ready, meme si une relecture echoue (donnee en cache)', () => {
    const p = prog(coachWorkoutsToProgramData([{ id: 'w', name: 'A', day_of_week: 1, program_exercises: [] }]));
    expect(activeProgramView({ isLoading: false, isError: true, program: p })).toBe('ready');
  });
});
import { normalizePlanSessions, pickSessionForToday } from '../workoutPlan';

// Faux client chaine : chaque table renvoie ses lignes ; les filtres sont ignores (les tests posent les lignes
// utiles). `.maybeSingle()` renvoie la 1re ligne.
function fakeClient(tables: Record<string, any[] | { error: string }>) {
  return {
    from(table: string) {
      const t = tables[table];
      const rows = Array.isArray(t) ? t : [];
      const error = !Array.isArray(t) && t ? { message: t.error } : null;
      const q: any = {
        select: () => q,
        eq: () => q,
        or: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: rows[0] ?? null, error }),
        then: (res: any) => res({ data: rows, error }),
      };
      return q;
    },
  };
}

const COACH_PROGRAM = { id: 'c1', name: 'Force 5x5, bloc 2', is_active: true, created_at: '2026-11-10T00:00:00Z', created_by_coach_id: 'coach', assigned_to_user_id: 'u1' };
const COACH_WORKOUTS = [
  {
    id: 'w2', name: 'Bas du corps', day_of_week: 4, order_index: 1,
    program_exercises: [{ order_index: 0, exercise_id: 'e-sq', sets: 5, reps: 5, rest_seconds: 180, exercises: { name: 'barbell full squat', name_fr: null } }],
  },
  {
    id: 'w1', name: 'Haut du corps', day_of_week: 1, order_index: 0,
    program_exercises: [
      { order_index: 1, exercise_id: 'e-row', sets: 5, reps: 5, exercises: { name: 'barbell bent over row' } },
      { order_index: 0, exercise_id: 'e-bp', sets: 5, reps: 5, exercises: { name: 'barbell bench press' } },
    ],
  },
];
const AI_PROGRAM = { id: 'a1', goal: 'strength', is_active: true, created_at: '2026-11-01T00:00:00Z', program_data: { sessions: [{ name: 'S1', exercises: [] }] } };

describe('getActiveProgram (run5 accueil : programme coach actif)', () => {
  it('programme COACH actif seul -> trouve, mis a la forme commune (kind coach, seances du plan)', async () => {
    const p = await getActiveProgram(fakeClient({ ziko_workout_programs: [COACH_PROGRAM], ziko_ai_generated_programs: [], ziko_program_workouts: COACH_WORKOUTS }), 'u1');
    expect(p).toMatchObject({ id: 'c1', kind: 'coach', name: 'Force 5x5, bloc 2', goal: null });
    const plan = normalizePlanSessions(p!.program_data);
    expect(plan.map((s) => s.name)).toEqual(['Haut du corps', 'Bas du corps']); // tri par jour
    expect(plan[0].dayIndex).toBe(0); // lundi
    expect(plan[1].dayIndex).toBe(3); // jeudi
    expect(plan[0].exercises.map((e) => e.name)).toEqual(['barbell bench press', 'barbell bent over row']); // ordre
    expect(plan[0].exercises[0]).toMatchObject({ exercise_id: 'e-bp', sets: 5, reps: 5 });
  });
  it('programme IA actif seul -> inchange', async () => {
    const p = await getActiveProgram(fakeClient({ ziko_workout_programs: [], ziko_ai_generated_programs: [AI_PROGRAM] }), 'u1');
    expect(p).toMatchObject({ id: 'a1', kind: 'ai', goal: 'strength' });
  });
  it('aucun programme -> null (vrai "Aucun programme actif")', async () => {
    expect(await getActiveProgram(fakeClient({ ziko_workout_programs: [], ziko_ai_generated_programs: [] }), 'u1')).toBeNull();
  });
  it('erreur de lecture sans aucun resultat -> propagee (pas de faux "aucun programme")', async () => {
    await expect(getActiveProgram(fakeClient({ ziko_workout_programs: { error: 'boom' }, ziko_ai_generated_programs: [] }), 'u1')).rejects.toBeTruthy();
  });
  it('incoherence (deux actifs) : le plus recent gagne, jamais les deux', () => {
    expect(chooseActive(COACH_PROGRAM, AI_PROGRAM)?.kind).toBe('coach');
    expect(chooseActive({ ...COACH_PROGRAM, created_at: '2026-10-01T00:00:00Z' }, AI_PROGRAM)?.kind).toBe('ai');
    expect(chooseActive(null, null)).toBeNull();
  });
});

describe('loadProgramForSession (demarrage de seance quel que soit la table)', () => {
  it('id du programme coach : table IA vide -> repli sur ziko_workout_programs, seance du jour resolue', async () => {
    const { program, error } = await loadProgramForSession(
      fakeClient({ ziko_ai_generated_programs: [], ziko_workout_programs: [COACH_PROGRAM], ziko_program_workouts: COACH_WORKOUTS }),
      'u1',
      'c1',
    );
    expect(error).toBe(false);
    expect(program?.kind).toBe('coach');
    const jeudi = pickSessionForToday(normalizePlanSessions(program!.program_data), 3);
    expect(jeudi?.session.name).toBe('Bas du corps');
    expect(jeudi?.isToday).toBe(true);
    // la seance garde la reference de sa journee de programme
    expect((program!.program_data as any).sessions[jeudi!.session.sourceIndex].workout_id).toBe('w2');
  });
  it('id de programme IA -> table IA', async () => {
    const { program } = await loadProgramForSession(fakeClient({ ziko_ai_generated_programs: [AI_PROGRAM] }), 'u1', 'a1');
    expect(program?.kind).toBe('ai');
  });
  it('inconnu -> program null sans erreur ; erreur base -> error true', async () => {
    expect(await loadProgramForSession(fakeClient({ ziko_ai_generated_programs: [], ziko_workout_programs: [] }), 'u1', 'x')).toEqual({ program: null, error: false });
    expect((await loadProgramForSession(fakeClient({ ziko_ai_generated_programs: { error: 'x' } }), 'u1', 'x')).error).toBe(true);
  });
});

describe('coachWorkoutsToProgramData', () => {
  it('entrees vides / exercices sans nom', () => {
    expect(coachWorkoutsToProgramData(null).sessions).toEqual([]);
    const d = coachWorkoutsToProgramData([{ id: 'w', name: 'X', day_of_week: 2, program_exercises: [{ sets: 3 }] }]);
    expect(d.sessions[0].exercises).toEqual([]);
  });
});
