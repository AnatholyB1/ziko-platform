import { describe, it, expect, vi, beforeEach } from 'vitest';

// Table-driven fake of the Supabase query builder: every chain resolves to tables[table].
const tables: Record<string, any> = {};
const calls: Array<{ table: string; op: string; payload?: any }> = [];

function builder(table: string) {
  let op = 'select';
  const b: any = {
    select: () => b,
    insert: (p: any) => { op = 'insert'; calls.push({ table, op, payload: p }); return b; },
    update: (p: any) => { op = 'update'; calls.push({ table, op, payload: p }); return b; },
    delete: () => { op = 'delete'; calls.push({ table, op }); return b; },
    eq: () => b, in: () => b, or: () => b, gte: () => b, order: () => b, is: () => b, limit: () => b,
    single: async () => ({ data: tables[table + ':' + op] ?? tables[table] ?? null, error: null }),
    maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
    then: (res: any) => res({ data: tables[table + ':' + op] ?? tables[table] ?? [], error: null }),
  };
  return b;
}

const rpcMock = vi.fn(async (..._a: any[]) => ({ error: null as any }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: (t: string) => builder(t), rpc: (...a: any[]) => rpcMock(...a) } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));
vi.mock('../authStore', () => ({ useAuthStore: { getState: () => ({ user: { id: 'u1' } }) } }));
vi.mock('../../lib/earnCredits', () => ({
  callCreditsEarn: vi.fn(),
  callCreditsEarnWithResult: vi.fn(async () => ({ credited: false })),
}));

vi.mock('@ziko/plugin-sdk', () => ({
  exerciseNames: { 'Back Squat': 'Squat arrière', 'Bench Press': 'Développé couché' },
}));

import { useWorkoutStore } from '../workoutStore';

const fullBody = {
  id: 'p1',
  goal: 'muscle_gain',
  program_data: { weeks: [{ w: 1, sessions: [
    { name: 'Full Body Power', exercises: [
      { name: 'Squat', sets: 4, reps: '5' },
      { name: 'Developpe couche', sets: 3, reps: '8-10', exercise_id: 'e2' },
    ] },
    { name: 'Upper', exercises: [{ name: 'Row', sets: 3, reps: '10' }] },
  ] }] },
};

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(tables)) delete tables[k];
  useWorkoutStore.setState({ currentSession: null, currentWorkoutExercises: [], activeSets: [], recentSessions: [] } as any);
});

describe('startPlannedSession (D-01, TRAIN-01/02)', () => {
  it('opens the planned session WITH its exercises, never an empty quick session', async () => {
    tables['ziko_ai_generated_programs'] = fullBody;
    tables['ziko_exercises'] = [
      { id: 'e1', name: 'Squat', name_fr: 'Squat' },
      { id: 'e2', name: 'Bench Press', name_fr: 'Developpe couche' },
    ];
    tables['ziko_workout_sessions:insert'] = { id: 's1', name: 'Full Body Power', started_at: new Date().toISOString() };

    const res = await useWorkoutStore.getState().startPlannedSession('p1', 0); // Monday
    expect(res).toEqual({ ok: true, name: 'Full Body Power', exerciseCount: 2, unresolved: [] });
    const st = useWorkoutStore.getState();
    expect(st.currentSession?.id).toBe('s1');
    expect(st.currentWorkoutExercises.map((e) => e.exercise_id)).toEqual(['e1', 'e2']);
    expect(st.currentWorkoutExercises[0].sets).toBe(4);
    expect(st.currentWorkoutExercises[1]).toMatchObject({ reps: null, reps_min: 8, reps_max: 10 });
    const insert = calls.find((c) => c.table === 'ziko_workout_sessions' && c.op === 'insert');
    expect(insert?.payload.name).toBe('Full Body Power');
  });

  it('rest day -> starts the next planned session (Tuesday -> Wednesday session)', async () => {
    tables['ziko_ai_generated_programs'] = fullBody; // 2 sessions -> Mon, Thu
    tables['ziko_exercises'] = [{ id: 'e3', name: 'Row', name_fr: null }];
    tables['ziko_workout_sessions:insert'] = { id: 's2', name: 'Upper', started_at: new Date().toISOString() };
    const res = await useWorkoutStore.getState().startPlannedSession('p1', 1);
    expect(res).toMatchObject({ ok: true, name: 'Upper' });
  });

  it('fails cleanly (no session row) when the program is missing or has no usable exercise', async () => {
    const r1 = await useWorkoutStore.getState().startPlannedSession('nope', 0);
    expect(r1).toEqual({ ok: false, reason: 'no_program' });

    tables['ziko_ai_generated_programs'] = fullBody;
    tables['ziko_exercises'] = []; // nothing resolvable -> would be an empty session
    const r2 = await useWorkoutStore.getState().startPlannedSession('p1', 0);
    expect(r2).toEqual({ ok: false, reason: 'no_exercises', unresolved: ['Squat', 'Developpe couche'] });
    expect(calls.some((c) => c.table === 'ziko_workout_sessions' && c.op === 'insert')).toBe(false);
    expect(useWorkoutStore.getState().currentSession).toBeNull();
  });
});

describe('startPlannedSession : exercice inconnu ne bloque pas la seance (run4 P24)', () => {
  it('"Squat" absent du catalogue sous ce nom : resolu vers Back Squat (alias), seance demarree', async () => {
    tables['ziko_ai_generated_programs'] = fullBody;
    tables['ziko_exercises'] = [
      { id: 'e1', name: 'back squat', name_fr: null },
      { id: 'e2', name: 'Bench Press', name_fr: null },
    ];
    tables['ziko_workout_sessions:insert'] = { id: 's1', name: 'Full Body Power', started_at: new Date().toISOString() };
    const res = await useWorkoutStore.getState().startPlannedSession('p1', 0);
    expect(res).toEqual({ ok: true, name: 'Full Body Power', exerciseCount: 2, unresolved: [] });
    expect(useWorkoutStore.getState().currentWorkoutExercises.map((e) => e.exercise_id)).toEqual(['e1', 'e2']);
  });

  it('un exercice introuvable est signale (unresolved) mais la seance demarre avec les autres', async () => {
    tables['ziko_ai_generated_programs'] = fullBody;
    tables['ziko_exercises'] = [{ id: 'e2', name: 'Bench Press', name_fr: 'Developpe couche' }];
    tables['ziko_workout_sessions:insert'] = { id: 's1', name: 'Full Body Power', started_at: new Date().toISOString() };
    const res = await useWorkoutStore.getState().startPlannedSession('p1', 0);
    expect(res).toEqual({ ok: true, name: 'Full Body Power', exerciseCount: 1, unresolved: ['Squat'] });
    expect(useWorkoutStore.getState().currentSession?.id).toBe('s1');
  });
});

describe('discardSession (D-02, TRAIN-03)', () => {
  it('deletes the session row and its children and clears state; no credit/XP path', async () => {
    useWorkoutStore.setState({ currentSession: { id: 's9' } as any, currentWorkoutExercises: [{}] as any });
    await useWorkoutStore.getState().discardSession();
    expect(calls.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual([
      'ziko_session_sets', 'ziko_session_exercises', 'ziko_workout_sessions',
    ]);
    expect(useWorkoutStore.getState().currentSession).toBeNull();
    expect(useWorkoutStore.getState().currentWorkoutExercises).toEqual([]);
  });
});

describe('loadRecentSessions filter (D-02)', () => {
  it('drops sessions without validated sets from Recent', async () => {
    tables['ziko_workout_sessions'] = [
      { id: 'a', total_sets: 10, total_volume_kg: 2000 },
      { id: 'b', total_sets: 0, total_volume_kg: 0 },
      { id: 'c', total_sets: null, total_volume_kg: null },
    ];
    await useWorkoutStore.getState().loadRecentSessions(30);
    expect(useWorkoutStore.getState().recentSessions.map((s) => s.id)).toEqual(['a']);
  });
});

describe('setActiveProgram (P7, TRAIN-07)', () => {
  it('goes through the atomic RPC, no direct is_active updates, no auto-activation on load', async () => {
    rpcMock.mockClear();
    tables['ziko_workout_programs'] = [{ id: 'p1', is_active: false }];
    await useWorkoutStore.getState().setActiveProgram('p1');
    expect(rpcMock).toHaveBeenCalledWith('ziko_set_active_program', { p_kind: 'workout', p_program_id: 'p1' });
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
    expect(useWorkoutStore.getState().activeProgram).toBeNull(); // 0 active stays 0 (D-09)
  });
  it('throws when the RPC fails', async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: 'program not found' } });
    await expect(useWorkoutStore.getState().setActiveProgram('x')).rejects.toThrow('program not found');
  });
});
