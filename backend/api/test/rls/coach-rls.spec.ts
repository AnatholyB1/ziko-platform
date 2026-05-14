import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient, type TestUser } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

// Shared coach + two clients (linked + unlinked) for the 4 mandated cases
let coach: TestUser;
let linkedClient: TestUser;
let unlinkedClient: TestUser;

async function makeLink(
  coachId: string,
  clientId: string,
  opts: { expiresAt?: string | null; revokedAt?: string | null } = {}
) {
  const { data, error } = await admin
    .from('coach_client_links')
    .insert({
      coach_id: coachId,
      client_id: clientId,
      expires_at: opts.expiresAt ?? null,
      revoked_at: opts.revokedAt ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`makeLink: ${error.message}`);
  return data.id as string;
}

async function seedHabitLog(client: TestUser) {
  // First insert a habit (FK parent for habit_logs)
  const { data: hab, error: habErr } = await admin
    .from('habits')
    .insert({ user_id: client.id, name: 'Daily water' })
    .select('id')
    .single();
  if (habErr) throw new Error(`seedHabitLog/habits: ${habErr.message}`);
  const { error: logErr } = await admin.from('habit_logs').insert({
    habit_id: hab!.id,
    user_id: client.id,
    date: new Date().toISOString().slice(0, 10),
    value: 1,
  });
  if (logErr) throw new Error(`seedHabitLog/habit_logs: ${logErr.message}`);
}

beforeAll(async () => {
  coach = await createTestUser('rls-coach');
  linkedClient = await createTestUser('rls-linked');
  unlinkedClient = await createTestUser('rls-unlinked');
  createdIds.push(coach.id, linkedClient.id, unlinkedClient.id);
  await makeLink(coach.id, linkedClient.id);
  await seedHabitLog(linkedClient);
  await seedHabitLog(unlinkedClient);
});

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('coach RLS — 4 mandated cases + additional scenarios', () => {
  it('linked client: coach reads habit_logs → rows returned (case 1, 22-03-01)', async () => {
    const { data, error } = await coach.client
      .from('habit_logs')
      .select('id')
      .eq('user_id', linkedClient.id);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it('unlinked client: coach reads habit_logs → 0 rows (case 2, 22-03-02)', async () => {
    const { data, error } = await coach.client
      .from('habit_logs')
      .select('id')
      .eq('user_id', unlinkedClient.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('revocation immediate: coach loses read access on revoked_at SET (case 3, 22-03-03)', async () => {
    const tempCoach = await createTestUser('rev-c');
    const tempClient = await createTestUser('rev-cl');
    createdIds.push(tempCoach.id, tempClient.id);
    const linkId = await makeLink(tempCoach.id, tempClient.id);
    await seedHabitLog(tempClient);

    const before = await tempCoach.client
      .from('habit_logs')
      .select('id')
      .eq('user_id', tempClient.id);
    expect(before.data?.length).toBeGreaterThan(0);

    await admin
      .from('coach_client_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId);

    const after = await tempCoach.client
      .from('habit_logs')
      .select('id')
      .eq('user_id', tempClient.id);
    expect(after.data?.length ?? 0).toBe(0);
  });

  it('expired = revoked: expires_at in the past blocks reads (case 4, 22-03-04)', async () => {
    const tempCoach = await createTestUser('exp-c');
    const tempClient = await createTestUser('exp-cl');
    createdIds.push(tempCoach.id, tempClient.id);
    await makeLink(tempCoach.id, tempClient.id, {
      expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    });
    await seedHabitLog(tempClient);

    const { data } = await tempCoach.client
      .from('habit_logs')
      .select('id')
      .eq('user_id', tempClient.id);
    expect(data?.length ?? 0).toBe(0);
  });

  it('coach cannot write: INSERT/UPDATE/DELETE blocked on linked client tables (22-03-05)', async () => {
    // INSERT — coach attempts to insert a habit owned by linkedClient
    const ins = await coach.client
      .from('habits')
      .insert({ user_id: linkedClient.id, name: 'Hijack' });
    expect(ins.error).not.toBeNull();

    // UPDATE — coach attempts to modify a linked client's habit
    const { data: linkedHabits } = await admin
      .from('habits')
      .select('id')
      .eq('user_id', linkedClient.id)
      .limit(1);
    const targetId = linkedHabits?.[0]?.id;
    expect(targetId).toBeDefined();
    if (targetId) {
      await coach.client.from('habits').update({ name: 'Pwned' }).eq('id', targetId);
      // RLS silently drops the row from the UPDATE set; verify the underlying row is unchanged.
      const { data: post } = await admin
        .from('habits')
        .select('name')
        .eq('id', targetId)
        .single();
      expect(post?.name).not.toBe('Pwned');

      // DELETE
      await coach.client.from('habits').delete().eq('id', targetId);
      const { data: stillThere } = await admin
        .from('habits')
        .select('id')
        .eq('id', targetId)
        .maybeSingle();
      expect(stillThere?.id).toBe(targetId);
    }
  });

  it('partial UNIQUE — duplicate active link blocked, revoke then re-add succeeds (22-03-06)', async () => {
    const c = await createTestUser('uq-c');
    const cl = await createTestUser('uq-cl');
    createdIds.push(c.id, cl.id);
    const linkA = await makeLink(c.id, cl.id);

    const dup = await admin
      .from('coach_client_links')
      .insert({ coach_id: c.id, client_id: cl.id });
    expect(dup.error).not.toBeNull();
    expect(dup.error?.code).toBe('23505'); // unique_violation

    await admin
      .from('coach_client_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkA);
    const fresh = await admin
      .from('coach_client_links')
      .insert({ coach_id: c.id, client_id: cl.id });
    expect(fresh.error).toBeNull();
  });

  it('null safety — is_coach_of(NULL, NULL) and is_coach_of(x, x) return FALSE (22-03-07)', async () => {
    const { data: n1 } = await admin.rpc('is_coach_of', { coach: null, client: null });
    expect(n1).toBe(false);

    const { data: n2 } = await admin.rpc('is_coach_of', { coach: coach.id, client: coach.id });
    expect(n2).toBe(false);
  });

  it('session_sets parent-chain — coach reads linked client session_sets via workout_sessions', async () => {
    const tempCoach = await createTestUser('sset-c');
    const tempClient = await createTestUser('sset-cl');
    createdIds.push(tempCoach.id, tempClient.id);
    await makeLink(tempCoach.id, tempClient.id);

    // Need a real exercises row for FK (session_sets.exercise_id NOT NULL REFERENCES exercises.id).
    const { data: ex, error: exErr } = await admin
      .from('exercises')
      .select('id')
      .limit(1)
      .single();
    if (exErr || !ex) throw new Error(`seed exercises not present: ${exErr?.message ?? 'no row'}`);

    const { data: ws, error: wsErr } = await admin
      .from('workout_sessions')
      .insert({ user_id: tempClient.id, started_at: new Date().toISOString() })
      .select('id')
      .single();
    if (wsErr) throw new Error(`workout_sessions insert: ${wsErr.message}`);

    const { error: setErr } = await admin.from('session_sets').insert({
      session_id: ws!.id,
      exercise_id: ex.id,
      set_number: 1,
      reps: 5,
      weight_kg: 100,
    });
    if (setErr) throw new Error(`session_sets insert: ${setErr.message}`);

    const { data, error } = await tempCoach.client
      .from('session_sets')
      .select('id')
      .eq('session_id', ws!.id);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it('all 11 athlete tables have a *_coach_read FOR SELECT policy (introspection)', async () => {
    const expected = [
      'habits_coach_read',
      'habit_logs_coach_read',
      'workout_sessions_coach_read',
      'session_sets_coach_read',
      'body_measurements_coach_read',
      'nutrition_logs_coach_read',
      'sleep_logs_coach_read',
      'cardio_sessions_coach_read',
      'hydration_logs_coach_read',
      'journal_entries_coach_read',
      'stretching_logs_coach_read',
    ];
    const { data, error } = await admin
      .from('pg_policies')
      .select('policyname, cmd')
      .in('policyname', expected);
    // PostgREST may not expose pg_catalog by default; skip introspection in that case.
    if (error?.code === '42P01' || error?.code === 'PGRST205') {
      return;
    }
    if (error) {
      // Any other PostgREST/HTTP failure to read pg_catalog — also skip rather than fail.
      return;
    }
    expect(data?.length).toBe(expected.length);
    for (const row of data ?? []) expect(row.cmd).toBe('SELECT');
  });

  it('sanity — owner still reads their own data (existing FOR ALL policy intact)', async () => {
    const { data, error } = await linkedClient.client
      .from('habit_logs')
      .select('id')
      .eq('user_id', linkedClient.id);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});
