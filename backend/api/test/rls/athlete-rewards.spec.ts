// Phase 45 (v1.18, non-punitive-tiered-rewards) - REWARD-03, REWARD-04
// live-DB coverage for ziko_reward_catalog, ziko_athlete_rewards and the
// ziko_grant_reward() RPC.
// Migrations under test (supabase/portfolio-migrations/):
//   20261107100000_ziko_reward_catalog.sql
//   20261107100100_ziko_athlete_rewards.sql
//   20261107100200_ziko_grant_reward_rpc.sql
// Same house shape as athlete-goals.spec.ts: RUN_DB guard + describe.skipIf.
// NOT run against any database when authored; it only runs when the test
// project env is configured and the migrations have been applied.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('athlete rewards - catalog reads, write lockdown, grant RPC (REWARD-03, REWARD-04)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  /** Puts the athlete at `tier` through the one real write path (points/tier are GREATEST-ratcheted). */
  async function seedTier(userId: string, tier: number, points: number) {
    return admin.rpc('ziko_record_athlete_decision', {
      p_user_id: userId,
      p_decision_type: 'goal_created',
      p_week_of: null,
      p_summary: 'seed for athlete-rewards.spec',
      p_rationale: 'seed',
      p_evidence: { seeded_by: 'athlete-rewards.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: { tier, points },
    });
  }

  async function catalogIds(tier: number): Promise<string[]> {
    const { data, error } = await admin
      .from('ziko_reward_catalog')
      .select('id')
      .eq('tier', tier)
      .eq('active', true)
      .order('sort_order');
    expect(error).toBeNull();
    return (data ?? []).map((r: { id: string }) => r.id);
  }

  function grant(userId: string, rewardId: string, weekOf = '2026-11-08') {
    return admin.rpc('ziko_grant_reward', {
      p_user_id: userId,
      p_reward_id: rewardId,
      p_week_of: weekOf,
      p_summary: 'grant for athlete-rewards.spec',
      p_rationale: 'spec',
      p_evidence: { seeded_by: 'athlete-rewards.spec' },
      p_source: 'weekly_review_cron',
    });
  }

  it('the seed provides at least 4 active rewards for each of tiers 2, 3 and 4', async () => {
    for (const tier of [2, 3, 4]) {
      expect((await catalogIds(tier)).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('an authenticated athlete can read the active catalog but cannot write it', async () => {
    const a = await createTestUser('rewards-catalog-read');
    createdUserIds.push(a.id);
    const read = await a.client.from('ziko_reward_catalog').select('id, key').limit(3);
    expect(read.error).toBeNull();
    expect(read.data?.length).toBeGreaterThan(0);

    const insert = await a.client.from('ziko_reward_catalog').insert({
      tier: 2, key: 'pwn', kind: 'badge', icon: 'x', label_fr: 'x', label_en: 'x',
    });
    expect(insert.error).not.toBeNull();
    const service = await admin.from('ziko_reward_catalog').update({ label_en: 'pwn' }).eq('tier', 2);
    expect(service.error).not.toBeNull();
  });

  it('grant happy path: journals a reward_grant decision and inserts the reward, visible to its owner only', async () => {
    const a = await createTestUser('rewards-grant-happy');
    const b = await createTestUser('rewards-grant-other');
    createdUserIds.push(a.id, b.id);
    expect((await seedTier(a.id, 2, 50)).data.success).toBe(true);
    const [rewardId] = await catalogIds(2);

    const res = await grant(a.id, rewardId!);
    expect(res.error).toBeNull();
    expect(res.data.success).toBe(true);

    const own = await a.client.from('ziko_athlete_rewards').select('reward_id, tier, decision_id').eq('user_id', a.id);
    expect(own.data?.length).toBe(1);
    expect(own.data?.[0].reward_id).toBe(rewardId);
    expect(own.data?.[0].decision_id).toBe(res.data.decision_id);

    const cross = await b.client.from('ziko_athlete_rewards').select('id').eq('user_id', a.id);
    expect(cross.error).toBeNull();
    expect(cross.data?.length ?? 0).toBe(0);

    const decision = await admin.from('ziko_athlete_decisions').select('decision_type, outcome').eq('id', res.data.decision_id).single();
    expect(decision.data?.decision_type).toBe('reward_grant');
    expect(decision.data?.outcome.tier).toBe(2);
  });

  it('idempotent: the same (user, week, tier) and the same reward cannot be granted twice', async () => {
    const a = await createTestUser('rewards-grant-idempotent');
    createdUserIds.push(a.id);
    await seedTier(a.id, 2, 50);
    const ids = await catalogIds(2);

    expect((await grant(a.id, ids[0]!)).data.success).toBe(true);
    const sameReward = await grant(a.id, ids[0]!);
    expect(sameReward.data).toMatchObject({ success: false, error: 'already_granted' });
    const sameTierOtherReward = await grant(a.id, ids[1]!);
    expect(sameTierOtherReward.data).toMatchObject({ success: false, error: 'already_granted' });

    const rows = await admin.from('ziko_athlete_rewards').select('id').eq('user_id', a.id);
    expect(rows.data?.length).toBe(1);
    const decisions = await admin.from('ziko_athlete_decisions').select('id').eq('user_id', a.id).eq('decision_type', 'reward_grant');
    expect(decisions.data?.length).toBe(1);
  });

  it('a reward for a tier the athlete has not reached is refused and leaves no decision row', async () => {
    const a = await createTestUser('rewards-grant-tier-guard');
    createdUserIds.push(a.id);
    await seedTier(a.id, 2, 50);
    const [tier3] = await catalogIds(3);

    const res = await grant(a.id, tier3!);
    expect(res.data).toMatchObject({ success: false, error: 'tier_not_reached' });
    const decisions = await admin.from('ziko_athlete_decisions').select('id').eq('user_id', a.id).eq('decision_type', 'reward_grant');
    expect(decisions.data?.length ?? 0).toBe(0);
  });

  it('write lockdown: no client role (authenticated, anon, service_role) can insert, update or delete athlete rewards', async () => {
    const a = await createTestUser('rewards-write-lockdown');
    createdUserIds.push(a.id);
    await seedTier(a.id, 2, 50);
    const [rewardId] = await catalogIds(2);
    const res = await grant(a.id, rewardId!);
    const granted = (await admin.from('ziko_athlete_rewards').select('id').eq('user_id', a.id).single()).data!.id;

    const row = { user_id: a.id, reward_id: rewardId, tier: 2 };
    expect((await a.client.from('ziko_athlete_rewards').insert(row)).error).not.toBeNull();
    expect((await a.client.from('ziko_athlete_rewards').delete().eq('id', granted)).error).not.toBeNull();
    expect((await a.client.from('ziko_athlete_rewards').update({ tier: 4 }).eq('id', granted)).error).not.toBeNull();

    const anon = getAnonClient();
    expect((await anon.from('ziko_athlete_rewards').insert(row)).error).not.toBeNull();
    expect((await anon.from('ziko_athlete_rewards').delete().eq('id', granted)).error).not.toBeNull();

    expect((await admin.from('ziko_athlete_rewards').insert(row)).error).not.toBeNull();
    expect((await admin.from('ziko_athlete_rewards').delete().eq('id', granted)).error).not.toBeNull();
    expect((await admin.from('ziko_athlete_rewards').update({ tier: 4 }).eq('id', granted)).error).not.toBeNull();

    // The reward survives every attempt (never revoked) and the RPC is not callable by athletes.
    const still = await admin.from('ziko_athlete_rewards').select('id').eq('user_id', a.id);
    expect(still.data?.length).toBe(1);
    const viaClient = await a.client.rpc('ziko_grant_reward', {
      p_user_id: a.id, p_reward_id: rewardId, p_week_of: '2026-11-15', p_summary: 'x', p_rationale: 'x', p_evidence: {}, p_source: 'weekly_review_cron',
    });
    expect(viaClient.error).not.toBeNull();
    expect(res.error).toBeNull();
  });

  it('monotonic points/tier: a later lower patch through the RPC never decreases them (a missed week cannot downgrade)', async () => {
    const a = await createTestUser('rewards-monotonic');
    createdUserIds.push(a.id);
    await seedTier(a.id, 3, 160);
    await seedTier(a.id, 1, 0);
    const state = await admin.from('ziko_athlete_state').select('points, tier, level').eq('user_id', a.id).single();
    expect(state.data).toMatchObject({ points: 160, tier: 3, level: 1 });
  });
});
