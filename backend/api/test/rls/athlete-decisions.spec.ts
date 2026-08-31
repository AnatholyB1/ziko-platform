// Phase 42 plan 03 (v1.18, decision-system-foundation) — FOUND-02 coverage
// for public.athlete_decisions.
// Migrations under test:
//   supabase/migrations/20260831120100_athlete_decisions.sql
//     (append-only journal table + SELECT-only RLS)
//   supabase/migrations/20260831120200_athlete_decisions_rpc.sql
//     (public.record_athlete_decision() RPC + GRANT/REVOKE lockdown)
// Follows the house shape from premium-grant-rpc.spec.ts verbatim: same
// RUN_DB guard, same getAdminClient/getAnonClient/createTestUser/
// cleanupTestUsers fixtures, same skipIf(!RUN_DB) guard on the describe block.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, createTestUser, cleanupTestUsers } from './fixtures';

// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec creates users and writes
// athlete_decisions journal rows via the RPC, so it must never run there.
// See premium-grant-rpc.spec.ts for the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('athlete_decisions — evidence contract, append-only immutability (FOUND-02)', () => {
  let admin: ReturnType<typeof getAdminClient>;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    admin = getAdminClient();
  });

  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  it('evidence required: a null p_evidence returns evidence_required and writes no journal row', async () => {
    const a = await createTestUser('athlete-decisions-evidence-null');
    createdUserIds.push(a.id);

    const { data, error } = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'no evidence',
      p_rationale: null,
      p_evidence: null,
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(error).toBeNull();
    expect(data.success).toBe(false);
    expect(data.error).toBe('evidence_required');

    const { data: rows, error: selectError } = await admin
      .from('athlete_decisions')
      .select('id')
      .eq('user_id', a.id);
    expect(selectError).toBeNull();
    expect(rows?.length ?? 0).toBe(0);
  });

  it('evidence must be an object: a JSON array for p_evidence also returns evidence_required', async () => {
    const a = await createTestUser('athlete-decisions-evidence-array');
    createdUserIds.push(a.id);

    const { data, error } = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'array evidence',
      p_rationale: null,
      p_evidence: [],
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(error).toBeNull();
    expect(data.error).toBe('evidence_required');

    const { data: rows, error: selectError } = await admin
      .from('athlete_decisions')
      .select('id')
      .eq('user_id', a.id);
    expect(selectError).toBeNull();
    expect(rows?.length ?? 0).toBe(0);
  });

  it('happy path: a populated p_evidence object round-trips the summary/rationale/evidence into a single journal row', async () => {
    const a = await createTestUser('athlete-decisions-happy-path');
    createdUserIds.push(a.id);

    const evidence = { workouts_completed: 4, habits_logged: 12 };
    const { data, error } = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'onboarding decision summary',
      p_rationale: 'onboarding decision rationale',
      p_evidence: evidence,
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(typeof data.decision_id).toBe('string');
    expect(data.decision_id.length).toBeGreaterThan(0);

    const { data: rows, error: selectError } = await admin
      .from('athlete_decisions')
      .select('id, summary, rationale, evidence')
      .eq('user_id', a.id);
    expect(selectError).toBeNull();
    expect(rows?.length).toBe(1);
    expect(rows?.[0].summary).toBe('onboarding decision summary');
    expect(rows?.[0].rationale).toBe('onboarding decision rationale');
    expect(rows?.[0].evidence).toEqual(evidence);
  });

  it('own-read: the athlete\'s own client reads their journal rows', async () => {
    const a = await createTestUser('athlete-decisions-own-read');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'own read seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    expect(seed.data.success).toBe(true);

    const { data, error } = await a.client.from('athlete_decisions').select('id').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });

  it('cross-read denied: athlete B reads athlete A\'s journal → RLS silently filters, 0 rows', async () => {
    const a = await createTestUser('athlete-decisions-cross-a');
    const b = await createTestUser('athlete-decisions-cross-b');
    createdUserIds.push(a.id, b.id);

    const seed = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'cross-read seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();

    const { data, error } = await b.client.from('athlete_decisions').select('id').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('direct INSERT is blocked for the admin client — proves the table-level REVOKE that makes the journal append-only-through-the-RPC', async () => {
    const a = await createTestUser('athlete-decisions-admin-insert');
    createdUserIds.push(a.id);

    const result = await admin.from('athlete_decisions').insert({
      user_id: a.id,
      decision_type: 'onboarding_profile',
      summary: 'direct insert attempt',
      evidence: { attempt: 'direct-admin-insert' },
    });
    expect(result.error).not.toBeNull();
  });

  it('direct UPDATE is blocked for the admin client — immutability of a genuinely existing row', async () => {
    const a = await createTestUser('athlete-decisions-admin-update');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'update-target seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    const decisionId = seed.data.decision_id as string;
    expect(decisionId.length).toBeGreaterThan(0);

    const result = await admin.from('athlete_decisions').update({ summary: 'tampered' }).eq('id', decisionId);
    expect(result.error).not.toBeNull();
  });

  it('direct DELETE is blocked for the admin client — append-only, no client of any kind can remove a row', async () => {
    const a = await createTestUser('athlete-decisions-admin-delete');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'delete-target seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    const decisionId = seed.data.decision_id as string;

    const result = await admin.from('athlete_decisions').delete().eq('id', decisionId);
    expect(result.error).not.toBeNull();
  });

  it('authenticated client INSERT/UPDATE/DELETE on athlete_decisions are all blocked', async () => {
    const a = await createTestUser('athlete-decisions-authed-writes');
    createdUserIds.push(a.id);

    const seed = await admin.rpc('record_athlete_decision', {
      p_user_id: a.id,
      p_decision_type: 'onboarding_profile',
      p_week_of: null,
      p_summary: 'authenticated-write-block seed',
      p_rationale: null,
      p_evidence: { seeded_by: 'athlete-decisions.spec' },
      p_outcome: {},
      p_source: 'onboarding_tool',
      p_state_patch: {},
    });
    expect(seed.error).toBeNull();
    const decisionId = seed.data.decision_id as string;

    const insertResult = await a.client.from('athlete_decisions').insert({
      user_id: a.id,
      decision_type: 'onboarding_profile',
      summary: 'authenticated insert attempt',
      evidence: { attempt: 'authenticated-insert' },
    });
    expect(insertResult.error).not.toBeNull();

    const updateResult = await a.client.from('athlete_decisions').update({ summary: 'pwned' }).eq('id', decisionId);
    expect(updateResult.error).not.toBeNull();

    const deleteResult = await a.client.from('athlete_decisions').delete().eq('id', decisionId);
    expect(deleteResult.error).not.toBeNull();
  });
});
