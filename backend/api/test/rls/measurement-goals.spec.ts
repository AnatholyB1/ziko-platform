// v1.20 Phase 15 (MEAS-01, MEAS-05, MEAS-06) -- objectifs de mesures dans ziko_athlete_goals.
// Migrations sous test :
//   supabase/portfolio-migrations/20261201150100_measurement_goals_extend.sql
//   supabase/portfolio-migrations/20261201150200_measurement_goals_achieved_trigger.sql
// Meme garde RUN_DB que athlete-goals.spec.ts : ne tourne que contre une base de test
// (SUPABASE_TEST_URL === SUPABASE_URL), jamais en CI "verify" ni contre la production.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('measurement goals -- RPC-only creation, locked while active, auto-achieved (MEAS-01/05/06)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  it('ME-2: the RPC creates a goal row (start 79.4, target 76, unit kg, active) owned by the caller', async () => {
    const a = await createTestUser('meas-goal-create');
    createdUserIds.push(a.id);

    const res = await a.client.rpc('ziko_create_measurement_goal', {
      p_measure_key: 'weight_kg',
      p_start_value: 79.4,
      p_target_value: 76,
      p_target_date: null,
    });
    expect(res.error).toBeNull();
    expect(res.data.success).toBe(true);

    const { data } = await a.client
      .from('ziko_athlete_goals')
      .select('measure_key, start_value, target_value, unit, status, user_id')
      .eq('id', res.data.goal_id)
      .single();
    expect(data?.measure_key).toBe('weight_kg');
    expect(Number(data?.start_value)).toBe(79.4);
    expect(Number(data?.target_value)).toBe(76);
    expect(data?.unit).toBe('kg');
    expect(data?.status).toBe('active');
    expect(data?.user_id).toBe(a.id);
  });

  it('ME-7 / D-05: target equal to start, out of range, unknown measure and a second active goal on the same measure are all rejected', async () => {
    const a = await createTestUser('meas-goal-validate');
    createdUserIds.push(a.id);

    const same = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'arm_cm', p_start_value: 37.2, p_target_value: 37.2 });
    expect(same.data.error).toBe('target_equals_start');
    const range = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'weight_kg', p_start_value: 80, p_target_value: 5 });
    expect(range.data.error).toBe('out_of_range');
    const bad = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'nope', p_start_value: 1, p_target_value: 2 });
    expect(bad.data.error).toBe('invalid_measure');

    const first = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'waist_cm', p_start_value: 88, p_target_value: 82 });
    expect(first.data.success).toBe(true);
    const dup = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'waist_cm', p_start_value: 88, p_target_value: 80 });
    expect(dup.data.error).toBe('active_goal_exists');
  });

  it('ME-5: the athlete client cannot update start/target of its active goal, nor insert/delete rows directly; anon cannot call the RPC', async () => {
    const a = await createTestUser('meas-goal-lock');
    createdUserIds.push(a.id);

    const res = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'weight_kg', p_start_value: 82, p_target_value: 76 });
    const goalId = res.data.goal_id as string;

    const upd = await a.client.from('ziko_athlete_goals').update({ target_value: 70 }).eq('id', goalId);
    expect(upd.error).not.toBeNull();
    const ins = await a.client.from('ziko_athlete_goals').insert({ user_id: a.id, goal_text: 'direct insert' });
    expect(ins.error).not.toBeNull();
    const del = await a.client.from('ziko_athlete_goals').delete().eq('id', goalId);
    expect(del.error).not.toBeNull();

    const { data } = await admin.from('ziko_athlete_goals').select('target_value').eq('id', goalId).single();
    expect(Number(data?.target_value)).toBe(76);

    const anon = await getAnonClient().rpc('ziko_create_measurement_goal', { p_measure_key: 'weight_kg', p_start_value: 82, p_target_value: 76 });
    expect(anon.error).not.toBeNull();
  });

  it('MEAS-05/06: a measurement crossing the target flips the goal to achieved; the next goal on the same measure can then be created (history kept)', async () => {
    const a = await createTestUser('meas-goal-achieve');
    createdUserIds.push(a.id);

    const res = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'weight_kg', p_start_value: 82, p_target_value: 76 });
    const goalId = res.data.goal_id as string;

    await a.client.from('ziko_body_measurements').insert({ user_id: a.id, weight_kg: 78 });
    let { data } = await a.client.from('ziko_athlete_goals').select('status').eq('id', goalId).single();
    expect(data?.status).toBe('active');

    await a.client.from('ziko_body_measurements').insert({ user_id: a.id, weight_kg: 75.8 });
    ({ data } = await a.client.from('ziko_athlete_goals').select('status, achieved_at, achieved_value').eq('id', goalId).single() as any);
    expect(data?.status).toBe('achieved');
    expect(data?.achieved_at).not.toBeNull();

    const next = await a.client.rpc('ziko_create_measurement_goal', { p_measure_key: 'weight_kg', p_start_value: 75.8, p_target_value: 72 });
    expect(next.data.success).toBe(true);
    const all = await a.client.from('ziko_athlete_goals').select('id, status').eq('measure_key', 'weight_kg');
    expect(all.data?.length).toBe(2);
  });
});
