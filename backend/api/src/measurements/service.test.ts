/**
 * Phase 16 (v1.20) - MEAS-02/03/07/08/09 : service des objectifs de mesures (mocks, aucun reseau, aucun modele).
 * Prouve : creation (depart par defaut = derniere mesure, validations, erreurs RPC propagees), modification
 * refusee hors des motifs / sans donnees AVANT toute RPC, RPC appelee avec le motif et la phrase de l'utilisateur,
 * message "annonce a la personne" present (MEAS-08), couplage quete (metrique measurement_logs, ai_meta lie a
 * l'objectif, creation via le plafond de 3 de P14), liste avec % et revisions, dispatch d'action.
 * Ne prouve PAS : les RPC SQL elles-memes (scripts/uat/p16-measurements-sql), ni le choix d'outil du vrai modele.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../tools/db.js', () => ({ clientForUser: vi.fn() }));
const { mockQuest } = vi.hoisted(() => ({ mockQuest: vi.fn() }));
vi.mock('../quests/service.js', () => ({ createQuestFromChat: mockQuest }));

import { createGoal, createGoalQuest, listGoals, manageMeasurementGoals, reviseGoal } from './service.js';

interface Seed {
  goals?: any[];
  readings?: any[];
  revisions?: any[];
  rpc?: Record<string, { data?: unknown; error?: { message: string } | null }>;
}

function makeDb(seed: Seed = {}) {
  const rpcCalls: Array<{ name: string; args: any }> = [];
  const table: Record<string, any[]> = {
    ziko_athlete_goals: seed.goals ?? [],
    ziko_body_measurements: seed.readings ?? [],
    ziko_goal_revisions: seed.revisions ?? [],
  };
  const from = (name: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      not: () => q,
      gte: () => q,
      order: () => q,
      limit: () => q,
      then: (res: any, rej: any) => Promise.resolve({ data: table[name] ?? [], error: null }).then(res, rej),
    };
    return q;
  };
  const db: any = {
    from: vi.fn(from),
    rpc: vi.fn(async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      return seed.rpc?.[name] ?? { data: { success: true, goal_id: 'g-new' }, error: null };
    }),
  };
  return { db, rpcCalls };
}

const goal = (over: any = {}) => ({
  id: 'g1', measure_key: 'weight_kg', start_value: 90, target_value: 80, unit: 'kg', status: 'active',
  start_date: '2026-01-01', target_date: null, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('createGoal', () => {
  it('cree via la RPC service_role avec user_id du jeton ; depart par defaut = derniere mesure', async () => {
    const { db, rpcCalls } = makeDb({ readings: [{ date: '2026-02-01', weight_kg: 82 }] });
    const res = await createGoal('u1', { measure_key: 'weight_kg', target_value: 76 }, { db, today: '2026-02-02' });
    expect(res).toMatchObject({ success: true, goal_id: 'g-new', goal: { start_value: 82, target_value: 76, unit: 'kg' } });
    expect(rpcCalls[0]).toEqual({ name: 'ziko_ai_create_measurement_goal', args: { p_user_id: 'u1', p_measure_key: 'weight_kg', p_start_value: 82, p_target_value: 76, p_target_date: null } });
  });
  it('sans mesure ni start_value : demande la valeur, aucune RPC', async () => {
    const { db, rpcCalls } = makeDb();
    expect(await createGoal('u1', { measure_key: 'weight_kg', target_value: 76 }, { db, today: '2026-02-02' })).toMatchObject({ success: false, error: 'start_value_required' });
    expect(rpcCalls).toHaveLength(0);
  });
  it('validations avant la RPC (mesure inconnue, cible = depart, hors plage, date passee)', async () => {
    const { db, rpcCalls } = makeDb();
    const t = (p: any) => createGoal('u1', p, { db, today: '2026-02-02' });
    expect(await t({ measure_key: 'bmi', target_value: 20 })).toMatchObject({ error: 'invalid_measure' });
    expect(await t({ measure_key: 'weight_kg', start_value: 80, target_value: 80 })).toMatchObject({ error: 'target_equals_start' });
    expect(await t({ measure_key: 'weight_kg', start_value: 80, target_value: 5 })).toMatchObject({ error: 'out_of_range' });
    expect(await t({ measure_key: 'weight_kg', start_value: 80, target_value: 75, target_date: '2026-01-01' })).toMatchObject({ error: 'target_date_in_past' });
    expect(rpcCalls).toHaveLength(0);
  });
  it('propage une erreur metier de la RPC (objectif deja actif) et masque une erreur technique', async () => {
    const a = makeDb({ rpc: { ziko_ai_create_measurement_goal: { data: { success: false, error: 'active_goal_exists' } } } });
    expect(await createGoal('u1', { measure_key: 'weight_kg', start_value: 80, target_value: 75 }, { db: a.db, today: '2026-02-02' })).toEqual({ success: false, error: 'active_goal_exists' });
    const b = makeDb({ rpc: { ziko_ai_create_measurement_goal: { error: { message: 'boom secret' } } } });
    expect(await createGoal('u1', { measure_key: 'weight_kg', start_value: 80, target_value: 75 }, { db: b.db, today: '2026-02-02' })).toEqual({ success: false, error: 'unavailable' });
  });
});

describe('reviseGoal (MEAS-07 / MEAS-08)', () => {
  const stagnant = [{ date: '2026-01-02', weight_kg: 89.8 }, { date: '2026-02-03', weight_kg: 89.7 }];
  it('refuse un motif non prevu : aucune RPC', async () => {
    const { db, rpcCalls } = makeDb({ goals: [goal()], readings: stagnant });
    const res = await reviseGoal('u1', { goal_id: 'g1', reason: 'user_wants_easier', new_target_value: 85 }, { db, today: '2026-02-05' });
    expect(res).toMatchObject({ success: false, error: 'reason_not_met', code: 'reason_not_allowed' });
    expect(rpcCalls).toHaveLength(0);
  });
  it('refuse une stagnation non etablie (trop recent) : aucune RPC', async () => {
    const { db, rpcCalls } = makeDb({ goals: [goal()], readings: stagnant });
    const res = await reviseGoal('u1', { goal_id: 'g1', reason: 'stagnation', new_target_value: 85 }, { db, today: '2026-01-20' });
    expect(res).toMatchObject({ success: false, code: 'goal_too_recent' });
    expect(rpcCalls).toHaveLength(0);
  });
  it('sans objectif en cours / sans changement demande : refus', async () => {
    expect(await reviseGoal('u1', { measure_key: 'weight_kg', reason: 'stagnation', new_target_value: 85 }, { db: makeDb().db })).toMatchObject({ error: 'goal_not_found_or_inactive' });
    expect(await reviseGoal('u1', { goal_id: 'g1', reason: 'stagnation' }, { db: makeDb({ goals: [goal()] }).db })).toMatchObject({ error: 'nothing_to_change' });
  });
  it('stagnation avérée : RPC appelee (motif, detail, user_id du jeton) et message obligatoire pour l utilisateur', async () => {
    const { db, rpcCalls } = makeDb({
      goals: [goal()],
      readings: stagnant,
      rpc: { ziko_ai_revise_measurement_goal: { data: { success: true, revision_id: 'r1', old_target: 80, new_target: 85, old_target_date: null, new_target_date: null } } },
    });
    const res: any = await reviseGoal('u1', { goal_id: 'g1', reason: 'stagnation', new_target_value: 85 }, { db, today: '2026-02-05' });
    expect(res.success).toBe(true);
    expect(res).toMatchObject({ old_target: 80, new_target: 85, reason: 'stagnation', revision_id: 'r1' });
    expect(res.must_tell_user).toMatch(/OBLIGATOIRE/);
    expect(rpcCalls[0].name).toBe('ziko_ai_revise_measurement_goal');
    expect(rpcCalls[0].args).toMatchObject({ p_user_id: 'u1', p_goal_id: 'g1', p_reason: 'stagnation', p_new_target: 85, p_new_target_date: null });
    expect(String(rpcCalls[0].args.p_reason_detail)).toMatch(/%/);
  });
  it('blessure declaree : la phrase de l utilisateur est transmise ; sans elle, refus avant la RPC', async () => {
    const ok = makeDb({ goals: [goal()], rpc: { ziko_ai_revise_measurement_goal: { data: { success: true, revision_id: 'r2', old_target: 80, new_target: 80, new_target_date: '2026-06-01' } } } });
    const res: any = await reviseGoal('u1', { goal_id: 'g1', reason: 'injury_pause', new_target_date: '2026-06-01', user_statement: 'entorse, 3 semaines de repos' }, { db: ok.db, today: '2026-02-05' });
    expect(res.success).toBe(true);
    expect(ok.rpcCalls[0].args.p_user_statement).toBe('entorse, 3 semaines de repos');
    const ko = makeDb({ goals: [goal()] });
    expect(await reviseGoal('u1', { goal_id: 'g1', reason: 'injury_pause', new_target_date: '2026-06-01' }, { db: ko.db, today: '2026-02-05' })).toMatchObject({ code: 'user_statement_required' });
    expect(ko.rpcCalls).toHaveLength(0);
  });
  it('refus SQL (delai de 14 j, sens) traduit en hint ; erreur technique masquee', async () => {
    const a = makeDb({ goals: [goal()], readings: stagnant, rpc: { ziko_ai_revise_measurement_goal: { data: { success: false, error: 'revision_too_soon' } } } });
    expect(await reviseGoal('u1', { goal_id: 'g1', reason: 'stagnation', new_target_value: 85 }, { db: a.db, today: '2026-02-05' })).toMatchObject({ success: false, error: 'revision_too_soon', hint: expect.stringContaining('14 jours') });
    const b = makeDb({ goals: [goal()], readings: stagnant, rpc: { ziko_ai_revise_measurement_goal: { error: { message: 'x' } } } });
    expect(await reviseGoal('u1', { goal_id: 'g1', reason: 'stagnation', new_target_value: 85 }, { db: b.db, today: '2026-02-05' })).toEqual({ success: false, error: 'unavailable' });
  });
});

describe('createGoalQuest (MEAS-09)', () => {
  it('cree une quete measurement_logs liee a l objectif via createQuestFromChat (plafond de 3 de P14)', async () => {
    mockQuest.mockResolvedValue({ success: true });
    const { db } = makeDb({ goals: [goal()] });
    await createGoalQuest('u1', { goal_id: 'g1' }, { db });
    const [uid, proposal, opts] = mockQuest.mock.calls[0];
    expect(uid).toBe('u1');
    expect(proposal).toMatchObject({ metric: 'measurement_logs', scope: 'weekly', target: 2, duration_hours: 168 });
    expect(opts.meta).toMatchObject({ source: 'measurement_goal', goal_id: 'g1', measure_key: 'weight_kg' });
  });
  it('sans objectif en cours : refus, aucune quete', async () => {
    const res = await createGoalQuest('u1', { measure_key: 'weight_kg' }, { db: makeDb().db });
    expect(res).toMatchObject({ success: false, error: 'goal_not_found_or_inactive' });
    expect(mockQuest).not.toHaveBeenCalled();
  });
  it('relaie le refus du plafond de 3 quetes', async () => {
    mockQuest.mockResolvedValue({ success: false, error: 'max_active_quests' });
    expect(await createGoalQuest('u1', { goal_id: 'g1', scope: 'daily' }, { db: makeDb({ goals: [goal()] }).db })).toMatchObject({ error: 'max_active_quests' });
    expect(mockQuest.mock.calls[0][1]).toMatchObject({ scope: 'daily', target: 1, duration_hours: 24 });
  });
});

describe('listGoals / dispatch', () => {
  it('liste avec % de progression (derniere mesure) et revisions recentes', async () => {
    const { db } = makeDb({
      goals: [goal(), goal({ id: 'g2', status: 'achieved', measure_key: 'waist_cm', unit: 'cm' })],
      readings: [{ date: '2026-02-01', weight_kg: 85, waist_cm: 85 }],
      revisions: [{ goal_id: 'g1', reason: 'stagnation', old_target: 80, new_target: 85, created_at: 'x' }],
    });
    const res: any = await listGoals('u1', { db });
    expect(res.goals[0]).toMatchObject({ goal_id: 'g1', current_value: 85, progress_pct: 50 });
    expect(res.goals[1]).toMatchObject({ status: 'achieved', progress_pct: 100 });
    expect(res.recent_revisions).toHaveLength(1);
  });
  it('action inconnue refusee', async () => {
    expect(await manageMeasurementGoals({ action: 'delete' }, 'u1', { db: makeDb().db })).toMatchObject({ success: false, error: 'invalid_action' });
  });
});
