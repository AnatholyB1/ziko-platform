import { describe, it, expect, vi } from 'vitest';
import { loadAllPrograms, setActiveProgram, renameProgram, deleteProgram, duplicateProgram } from '../programsService';
import type { ProgramItem } from '../programs';

type Call = { table: string; op: string; args: any[] };

/** Chainable, thenable mock of the supabase query builder. `results[table.op]` or a function. */
function makeClient(results: Record<string, any> = {}) {
  const calls: Call[] = [];
  const rpc = vi.fn(async () => ({ error: null }));
  const from = (table: string) => {
    let op = 'select';
    const chain: any = {
      select: (...a: any[]) => { if (op === 'select') op = 'select'; calls.push({ table, op: 'select', args: a }); return chain; },
      insert: (...a: any[]) => { op = 'insert'; calls.push({ table, op, args: a }); return chain; },
      update: (...a: any[]) => { op = 'update'; calls.push({ table, op, args: a }); return chain; },
      delete: (...a: any[]) => { op = 'delete'; calls.push({ table, op, args: a }); return chain; },
      eq: (...a: any[]) => { calls.push({ table, op: 'eq', args: a }); return chain; },
      or: (...a: any[]) => { calls.push({ table, op: 'or', args: a }); return chain; },
      single: () => { const r = results[`${table}.${op}`]; return Promise.resolve(typeof r === 'function' ? r() : r ?? { data: null, error: null }); },
      then: (res: any, rej: any) => {
        const r = results[`${table}.${op}`];
        return Promise.resolve(typeof r === 'function' ? r() : r ?? { data: [], error: null }).then(res, rej);
      },
    };
    return chain;
  };
  return { client: { from, rpc } as any, calls, rpc };
}

const item = (over: Partial<ProgramItem> = {}): ProgramItem => ({
  id: 'p1', kind: 'ai', source: 'ai', name: 'PPL', subtitle: '', isActive: false, createdAt: '2026-11-01', daysPerWeek: 3, progress: null, ...over,
});

describe('loadAllPrograms', () => {
  it('merges both tables', async () => {
    const { client } = makeClient({
      'ziko_workout_programs.select': { data: [{ id: 'w1', user_id: 'u', name: 'A', is_active: true, created_at: '2026-10-01', is_template: false }], error: null },
      'ziko_ai_generated_programs.select': { data: [{ id: 'a1', user_id: 'u', name: 'B', is_active: false, created_at: '2026-10-02', program_data: {} }], error: null },
    });
    const l = await loadAllPrograms(client, 'u');
    expect(l.map((i) => i.id)).toEqual(['w1', 'a1']);
  });
  it('throws on a network error instead of returning a fallback program (A05)', async () => {
    const { client } = makeClient({
      'ziko_workout_programs.select': { data: null, error: { message: 'Network request failed' } },
      'ziko_ai_generated_programs.select': { data: [], error: null },
    });
    await expect(loadAllPrograms(client, 'u')).rejects.toThrow('Network request failed');
  });
});

describe('setActiveProgram', () => {
  it('uses the RPC (single atomic path), never table updates', async () => {
    const { client, rpc, calls } = makeClient();
    await setActiveProgram(client, 'workout', 'w1');
    expect(rpc).toHaveBeenCalledWith('ziko_set_active_program', { p_kind: 'workout', p_program_id: 'w1' });
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });
  it('surfaces RPC errors', async () => {
    const { client, rpc } = makeClient();
    rpc.mockResolvedValueOnce({ error: { message: 'program not found' } } as any);
    await expect(setActiveProgram(client, 'ai', 'x')).rejects.toThrow('program not found');
  });
});

describe('rename / delete guards', () => {
  it('rename is refused for inactive and coach programs (menu contract), allowed for active own', async () => {
    const { client, calls } = makeClient();
    await expect(renameProgram(client, item({ isActive: false }), 'Neuf')).rejects.toThrow();
    await expect(renameProgram(client, item({ source: 'coach', kind: 'workout', isActive: true }), 'Neuf')).rejects.toThrow();
    await expect(renameProgram(client, item({ isActive: true }), '  ')).rejects.toThrow('nom');
    expect(await renameProgram(client, item({ isActive: true }), ' Neuf  plan ')).toBe('Neuf plan');
    expect(calls.find((c) => c.op === 'update')!.table).toBe('ziko_ai_generated_programs');
    expect(calls.find((c) => c.op === 'update')!.args[0]).toEqual({ name: 'Neuf plan' });
  });
  it('delete is refused for coach programs and targets the right table, no other table touched (D-09)', async () => {
    const { client, calls, rpc } = makeClient();
    await expect(deleteProgram(client, item({ source: 'coach', kind: 'workout' }))).rejects.toThrow();
    await deleteProgram(client, item({ kind: 'workout', source: 'created', isActive: true }));
    expect(calls.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual(['ziko_workout_programs']);
    expect(rpc).not.toHaveBeenCalled(); // no auto-activation of another program
  });
});

describe('duplicateProgram', () => {
  it('ai: copies program_data into an inactive personal copy named "(copie)"', async () => {
    const { client, calls } = makeClient({
      'ziko_ai_generated_programs.select': { data: { goal: 'strength', split_type: 'ppl', days_per_week: 6, program_data: { weeks: [1] } }, error: null },
      'ziko_ai_generated_programs.insert': { data: { id: 'new1' }, error: null },
    });
    const out = await duplicateProgram(client, 'u', item({ name: 'PPL' }), ['PPL']);
    const ins = calls.find((c) => c.op === 'insert')!;
    expect(ins.args[0]).toMatchObject({ user_id: 'u', name: 'PPL (copie)', is_active: false, split_type: 'ppl', program_data: { weeks: [1] } });
    expect(out).toMatchObject({ id: 'new1', isActive: false, name: 'PPL (copie)' });
  });
  it('workout (coach): creates a personal inactive copy with workouts and exercises, no coach fields', async () => {
    const src = {
      description: null, days_per_week: 3, goal: 'strength', weeks_count: 8, created_by_coach_id: 'coach', assigned_to_user_id: 'u',
      program_workouts: [{ name: 'A', day_of_week: 1, order_index: 0, program_exercises: [{ exercise_id: 'e1', sets: 5, reps: 5, order_index: 0 }] }],
    };
    let wIns = 0;
    const { client, calls } = makeClient({
      'ziko_workout_programs.select': { data: src, error: null },
      'ziko_workout_programs.insert': { data: { id: 'np' }, error: null },
      'ziko_program_workouts.insert': () => { wIns += 1; return { data: { id: `nw${wIns}` }, error: null }; },
      'ziko_program_exercises.insert': { data: null, error: null },
    });
    const out = await duplicateProgram(client, 'u', item({ kind: 'workout', source: 'coach', name: 'Force 5x5' }), []);
    const prog = calls.find((c) => c.table === 'ziko_workout_programs' && c.op === 'insert')!.args[0];
    expect(prog).toMatchObject({ user_id: 'u', is_active: false, name: 'Force 5x5 (copie)' });
    expect(prog).not.toHaveProperty('created_by_coach_id');
    expect(prog).not.toHaveProperty('assigned_to_user_id');
    expect(calls.find((c) => c.table === 'ziko_program_exercises' && c.op === 'insert')!.args[0][0]).toMatchObject({ workout_id: 'nw1', exercise_id: 'e1', sets: 5 });
    expect(out).toMatchObject({ id: 'np', source: 'created', isActive: false });
  });
  it('workout: rolls back the new program when copying children fails', async () => {
    const { client, calls } = makeClient({
      'ziko_workout_programs.select': { data: { program_workouts: [{ name: 'A', program_exercises: [] }] }, error: null },
      'ziko_workout_programs.insert': { data: { id: 'np' }, error: null },
      'ziko_program_workouts.insert': { data: null, error: { message: 'boom' } },
    });
    await expect(duplicateProgram(client, 'u', item({ kind: 'workout', source: 'created' }), [])).rejects.toThrow('boom');
    expect(calls.some((c) => c.table === 'ziko_workout_programs' && c.op === 'delete')).toBe(true);
  });
});
