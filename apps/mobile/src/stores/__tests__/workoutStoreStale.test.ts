import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Run4 : seance fantome ("Seance en cours Lower 705 min", "Reprendre" -> seance rapide vide).
// Horloge factice : l'heure systeme est figee, on fait varier started_at.
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
    single: async () => ({ data: tables[table] ?? null, error: null }),
    maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
    then: (res: any) => res({ data: op === 'select' ? (tables[table] ?? []) : null, error: null }),
  };
  return b;
}

vi.mock('../../lib/supabase', () => ({ supabase: { from: (t: string) => builder(t), rpc: vi.fn(async () => ({ error: null })) } }));
const asyncStore: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => asyncStore[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => { asyncStore[k] = v; }),
    removeItem: vi.fn(async (k: string) => { delete asyncStore[k]; }),
  },
}));
vi.mock('../authStore', () => ({ useAuthStore: { getState: () => ({ user: { id: 'u1' } }) } }));
const earn = vi.hoisted(() => ({ callCreditsEarn: vi.fn(), callCreditsEarnWithResult: vi.fn(async () => ({ credited: true })) }));
vi.mock('../../lib/earnCredits', () => earn);
vi.mock('@ziko/plugin-sdk', () => ({ exerciseNames: {} }));

import { useWorkoutStore } from '../workoutStore';

const NOW = new Date('2026-11-13T13:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function openSession(startedAt: string) {
  const row = { id: 's1', name: 'Lower', started_at: startedAt, ended_at: null };
  tables['ziko_workout_sessions'] = row;
  asyncStore['workout:activeSession:u1'] = JSON.stringify(row);
  return row;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  calls.length = 0;
  for (const k of Object.keys(tables)) delete tables[k];
  for (const k of Object.keys(asyncStore)) delete asyncStore[k];
  earn.callCreditsEarnWithResult.mockClear();
  useWorkoutStore.setState({ currentSession: null, currentWorkoutExercises: [], activeSets: [] } as any);
});
afterEach(() => vi.useRealTimers());

describe('restoreSession : seance fantome', () => {
  it('ouverte depuis 705 min avec des series : cloturee a l\'heure de la derniere serie, plus proposee, ni credit ni XP', async () => {
    openSession(hoursAgo(11.75));
    tables['ziko_session_sets'] = [{ completed_at: hoursAgo(11), created_at: hoursAgo(11) }, { completed_at: hoursAgo(11.5), created_at: hoursAgo(11.5) }];
    await useWorkoutStore.getState().restoreSession();
    expect(useWorkoutStore.getState().currentSession).toBeNull();
    const upd = calls.find((c) => c.table === 'ziko_workout_sessions' && c.op === 'update');
    expect(upd?.payload).toEqual({ ended_at: hoursAgo(11), total_sets: 2 });
    expect(earn.callCreditsEarnWithResult).not.toHaveBeenCalled();
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
    expect(asyncStore['workout:activeSession:u1']).toBeUndefined();
  });

  it('sans aucune serie validee : supprimee (rien en base), jamais reprise, meme recente', async () => {
    openSession(hoursAgo(0.2));
    tables['ziko_session_sets'] = [];
    await useWorkoutStore.getState().restoreSession();
    expect(useWorkoutStore.getState().currentSession).toBeNull();
    expect(calls.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual([
      'ziko_session_sets', 'ziko_session_exercises', 'ziko_workout_sessions',
    ]);
    expect(earn.callCreditsEarnWithResult).not.toHaveBeenCalled();
  });

  it('recente avec des series : reprise normale (rien de cloture)', async () => {
    const row = openSession(hoursAgo(1));
    tables['ziko_session_sets'] = [{ completed_at: hoursAgo(0.5), created_at: hoursAgo(0.5) }];
    await useWorkoutStore.getState().restoreSession();
    expect(useWorkoutStore.getState().currentSession).toEqual(row);
    expect(calls.filter((c) => c.op === 'update' || c.op === 'delete')).toHaveLength(0);
  });

  it('pile a la limite de 6 h : reprenable ; juste au-dela : cloturee', async () => {
    openSession(hoursAgo(6));
    tables['ziko_session_sets'] = [{ completed_at: hoursAgo(5), created_at: hoursAgo(5) }];
    await useWorkoutStore.getState().restoreSession();
    expect(useWorkoutStore.getState().currentSession?.id).toBe('s1');

    useWorkoutStore.setState({ currentSession: null } as any);
    openSession(new Date(NOW.getTime() - 6 * 3600_000 - 1000).toISOString());
    await useWorkoutStore.getState().restoreSession();
    expect(useWorkoutStore.getState().currentSession).toBeNull();
  });
});

describe('settleStaleSession (seance en memoire)', () => {
  it('une seance neuve sans serie reste reprenable (l\'anciennete seule decide)', async () => {
    useWorkoutStore.setState({ currentSession: { id: 's1', started_at: hoursAgo(0.1) } as any });
    expect(await useWorkoutStore.getState().settleStaleSession()).toBe(false);
    expect(useWorkoutStore.getState().currentSession?.id).toBe('s1');
  });

  it('perimee et vide : supprimee, retiree de l\'etat', async () => {
    useWorkoutStore.setState({ currentSession: { id: 's1', started_at: hoursAgo(12) } as any });
    tables['ziko_session_sets'] = [];
    expect(await useWorkoutStore.getState().settleStaleSession()).toBe(true);
    expect(useWorkoutStore.getState().currentSession).toBeNull();
    expect(calls.some((c) => c.table === 'ziko_workout_sessions' && c.op === 'delete')).toBe(true);
  });

  it('perimee avec series : cloturee sans credit ni XP', async () => {
    useWorkoutStore.setState({ currentSession: { id: 's1', started_at: hoursAgo(12) } as any });
    tables['ziko_session_sets'] = [{ completed_at: hoursAgo(11.5), created_at: hoursAgo(11.5) }];
    expect(await useWorkoutStore.getState().settleStaleSession()).toBe(true);
    expect(calls.find((c) => c.op === 'update')?.payload).toEqual({ ended_at: hoursAgo(11.5), total_sets: 1 });
    expect(earn.callCreditsEarnWithResult).not.toHaveBeenCalled();
  });
});
