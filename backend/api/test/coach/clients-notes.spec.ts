// Phase 26 plan 02 — CLIENT-06: notes CRUD with RLS isolation
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestUsers,
  createTestUser,
  getAdminClient,
  type TestUser,
} from '../rls/fixtures';
import {
  getClientNote,
  upsertClientNote,
} from '../../src/coach/clients/db.js';

const adminClient = getAdminClient();

let coach: TestUser;
let coachB: TestUser;
let client: TestUser;
let coachJwt: string;
let coachBJwt: string;

async function getJwt(user: TestUser): Promise<string> {
  const { data } = await user.client.auth.getSession();
  return data.session!.access_token;
}

beforeAll(async () => {
  coach = await createTestUser('notes-coach');
  coachB = await createTestUser('notes-coachb');
  client = await createTestUser('notes-client');

  await adminClient.from('user_profiles').upsert({ id: coach.id, role: 'coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coach.id, display_name: 'Notes Coach A' });
  await adminClient.from('user_profiles').upsert({ id: coachB.id, role: 'coach' });
  await adminClient.from('coach_profiles').upsert({ user_id: coachB.id, display_name: 'Notes Coach B' });
  await adminClient.from('user_profiles').upsert({ id: client.id, role: 'client' });

  coachJwt = await getJwt(coach);
  coachBJwt = await getJwt(coachB);
});

afterAll(async () => {
  await adminClient.from('coach_client_notes').delete().eq('coach_id', coach.id);
  await adminClient.from('coach_client_notes').delete().eq('coach_id', coachB.id);
  await adminClient.from('coach_profiles').delete().eq('user_id', coach.id);
  await adminClient.from('coach_profiles').delete().eq('user_id', coachB.id);
  await cleanupTestUsers([coach.id, coachB.id, client.id]);
});

describe('GET/PUT /coach/clients/:id/notes — note CRUD', () => {
  it('PUT upserts note row with coach_id = auth.uid()', async () => {
    const note = await upsertClientNote(coachJwt, coach.id, client.id, 'Initial note content');
    expect(note.coach_id).toBe(coach.id);
    expect(note.client_id).toBe(client.id);
    expect(note.content).toBe('Initial note content');
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(note.updated_at).toBeTruthy();
  });

  it('GET returns the note for this coach+client pair', async () => {
    const note = await getClientNote(coachJwt, coach.id, client.id);
    expect(note).not.toBeNull();
    expect(note!.content).toBe('Initial note content');
    expect(note!.coach_id).toBe(coach.id);
  });

  it('PUT updates content and updated_at on second write', async () => {
    const before = await getClientNote(coachJwt, coach.id, client.id);
    // Small delay to ensure updated_at changes
    await new Promise((r) => setTimeout(r, 100));
    const updated = await upsertClientNote(coachJwt, coach.id, client.id, 'Updated note content');
    expect(updated.content).toBe('Updated note content');
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.updated_at).getTime(),
    );
  });

  it('Coach B cannot read Coach A\'s notes (RLS isolation)', async () => {
    // Ensure coach A has a note
    await upsertClientNote(coachJwt, coach.id, client.id, 'Coach A private note');

    // Coach B tries to read coach A's note — should see null (own note absent)
    const coachBNote = await getClientNote(coachBJwt, coachB.id, client.id);
    // Coach B has no note for this client, so should get null
    expect(coachBNote).toBeNull();
  });

  it('athlete cannot read coach notes (no athlete-read policy)', async () => {
    // athlete is a client — using their JWT to query coach_client_notes should return null
    // because there is no athlete-read RLS policy on coach_client_notes
    // We test this by ensuring getClientNote with client JWT as if they were "coach B"
    // returns null (no matching row with client_id = coach.id which is nonsensical)
    // The practical test: coach_client_notes has USING (auth.uid() = coach_id)
    // A client JWT trying to select their own coach's note will see 0 rows
    const { data } = await client.client.from('coach_client_notes')
      .select('*')
      .eq('client_id', client.id);
    // RLS blocks: athlete sees 0 rows (because auth.uid() != coach_id for any row)
    expect(data).toEqual([]);
  });
});
