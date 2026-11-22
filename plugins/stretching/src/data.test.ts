import { describe, it, expect } from 'vitest';
import { saveRoutine, insertLog, fetchDefaultRoutine, createExercise } from './data';
import { normalizeRoutineExercise } from './lib';

/** Faux client Supabase en memoire pour ziko_stretching_routines/logs, avec l'index unique partiel (1 defaut / user). */
function fakeDb(initial: any[] = [], opts: { failWrite?: boolean } = {}) {
  const routines = initial.map((r) => ({ user_id: 'u1', is_default: false, ...r }));
  const logs: any[] = [];
  const calls: string[] = [];
  const checkUnique = () => {
    const d = routines.filter((r) => r.user_id === 'u1' && r.is_default);
    if (d.length > 1) throw new Error('duplicate key value violates unique constraint ziko_uq_stretching_routines_one_default');
  };
  const builder = (table: string) => {
    let filters: Array<(r: any) => boolean> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: any = null;
    const api: any = {
      select: () => api,
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return api; },
      neq: (k: string, v: any) => { filters.push((r) => r[k] !== v); return api; },
      in: (k: string, vs: any[]) => { filters.push((r) => vs.includes(r[k])); return api; },
      limit: () => api,
      update: (p: any) => { op = 'update'; patch = p; return api; },
      insert: (p: any) => { op = 'insert'; patch = p; return api; },
      single: async () => ({ data: { id: 'log-1', ...patch }, error: null }),
      then: (resolve: any) => {
        const run = () => {
          if (table === 'ziko_stretching_logs') { logs.push(patch); return { data: null, error: null }; }
          if (op === 'select') return { data: routines.filter((r) => filters.every((f) => f(r))), error: null };
          if (opts.failWrite && (patch.name !== undefined)) return { data: null, error: { message: 'boom' } };
          calls.push(op);
          if (op === 'update') {
            routines.filter((r) => filters.every((f) => f(r))).forEach((r) => Object.assign(r, patch));
            checkUnique();
          } else {
            routines.push(patch);
            checkUnique();
          }
          return { data: null, error: null };
        };
        return Promise.resolve(run()).then(resolve);
      },
    };
    return api;
  };
  return { client: { from: (t: string) => builder(t) }, routines, logs, calls };
}

const ex = [normalizeRoutineExercise({ name: 'Cobra', duration_seconds: 30 })];

describe('saveRoutine : routine par defaut unique (ST-3)', () => {
  it('definir une 2e routine par defaut retire la 1re (jamais 2 defauts)', async () => {
    const db = fakeDb([{ id: 'r1', is_default: true, name: 'A' }]);
    await saveRoutine(db.client, 'u1', { name: 'B', exercises: ex, is_default: true });
    const defaults = db.routines.filter((r) => r.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe('B');
    expect(db.routines.find((r) => r.id === 'r1')!.is_default).toBe(false);
  });

  it('sans case Routine par defaut, ne touche pas au defaut existant', async () => {
    const db = fakeDb([{ id: 'r1', is_default: true, name: 'A' }]);
    await saveRoutine(db.client, 'u1', { name: 'B', exercises: ex, is_default: false });
    expect(db.routines.find((r) => r.id === 'r1')!.is_default).toBe(true);
    expect(db.routines.filter((r) => r.is_default)).toHaveLength(1);
  });

  it('mise a jour d une routine deja par defaut : reste l unique defaut', async () => {
    const db = fakeDb([{ id: 'r1', is_default: true, name: 'A' }, { id: 'r2', name: 'C' }]);
    await saveRoutine(db.client, 'u1', { id: 'r1', name: 'A2', exercises: ex, is_default: true });
    expect(db.routines.filter((r) => r.is_default).map((r) => r.id)).toEqual(['r1']);
    expect(db.routines.find((r) => r.id === 'r1')!.name).toBe('A2');
  });

  it('echec d ecriture : l ancien defaut est restaure', async () => {
    const db = fakeDb([{ id: 'r1', is_default: true, name: 'A' }], { failWrite: true });
    await expect(saveRoutine(db.client, 'u1', { name: 'B', exercises: ex, is_default: true })).rejects.toThrow('boom');
    expect(db.routines.find((r) => r.id === 'r1')!.is_default).toBe(true);
  });

  it('ecrit duree, groupes et exercices ordonnes', async () => {
    const db = fakeDb();
    const two = [normalizeRoutineExercise({ name: 'B', muscle_group: 'legs', duration_seconds: 60 }), ...ex];
    await saveRoutine(db.client, 'u1', { name: '  Ma routine ', exercises: two, is_default: false });
    const r = db.routines[0];
    expect(r.name).toBe('Ma routine');
    expect(r.exercises.map((e: any) => e.name)).toEqual(['B', 'Cobra']);
    expect(r.duration_minutes).toBe(2);
    expect(r.muscle_groups).toEqual(['legs', 'full_body']);
  });
});

describe('fetchDefaultRoutine : absence de carte sans defaut (ST-4)', () => {
  it('null si aucune routine par defaut', async () => {
    const db = fakeDb([{ id: 'r1', name: 'A', exercises: [] }]);
    expect(await fetchDefaultRoutine(db.client, 'u1')).toBeNull();
  });
  it('retourne la routine par defaut normalisee', async () => {
    const db = fakeDb([{ id: 'r1', name: 'A', exercises: [{ name: 'x', duration_seconds: 20 }], is_default: true }]);
    const r = await fetchDefaultRoutine(db.client, 'u1');
    expect(r?.id).toBe('r1');
    expect(r?.exercises[0].measure).toBe('duration');
  });
});

describe('insertLog : le log stretching est un log, pas une serie', () => {
  it('ecrit routine_id, duree et date locale dans ziko_stretching_logs uniquement', async () => {
    const db = fakeDb();
    const touched: string[] = [];
    const client = { from: (t: string) => { touched.push(t); return db.client.from(t); } };
    const id = await insertLog(client, 'u1', { id: 'r1', name: 'Réveil', exercises: ex }, new Date(2026, 10, 12, 0, 30));
    expect(id).toBe('log-1');
    expect(touched).toEqual(['ziko_stretching_logs']);
  });
});

describe('createExercise', () => {
  it('envoie user_id, mesure duree sans reps, ou reps sans duree', async () => {
    let sent: any = null;
    const client = {
      from: () => ({ insert: (p: any) => { sent = p; return { select: () => ({ single: async () => ({ data: { id: 'n', ...p }, error: null }) }) }; } }),
    };
    await createExercise(client, 'u1', { name: ' Pigeon ', zone: 'hips', measure: 'duration', duration_seconds: 40, reps: 10, sides: 2, instructions: ' x ' });
    expect(sent).toMatchObject({ user_id: 'u1', name: 'Pigeon', muscle_group: 'hips', duration_seconds: 40, reps: null, sides: 2, instructions: 'x' });
    await createExercise(client, 'u1', { name: 'Chat', zone: 'back', measure: 'reps', duration_seconds: 30, reps: 12, sides: 1, instructions: '' });
    expect(sent).toMatchObject({ measure: 'reps', duration_seconds: null, reps: 12 });
  });
});
