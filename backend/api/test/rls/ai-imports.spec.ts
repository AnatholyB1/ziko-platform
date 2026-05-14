import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient, type TestUser } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

const VALID_IMPORT = {
  file_url: 'storage://bucket/test.pdf',
  original_filename: 'test.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024,
  mode: 'athlete' as const,
};

let athlete: TestUser;
let other: TestUser;
let coach: TestUser;

beforeAll(async () => {
  athlete = await createTestUser('imp-athlete');
  other = await createTestUser('imp-other');
  coach = await createTestUser('imp-coach');
  createdIds.push(athlete.id, other.id, coach.id);
  // Link coach to athlete (active link)
  await admin.from('coach_client_links').insert({ coach_id: coach.id, client_id: athlete.id });
});

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('ai_imports RLS owner-only (D-10)', () => {
  it('owner can insert their own row', async () => {
    const { data, error } = await athlete.client
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('CHECK rejects invalid mime_type', async () => {
    const { error } = await athlete.client
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT, mime_type: 'text/html' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('CHECK rejects size_bytes > 25 MB', async () => {
    const { error } = await athlete.client
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT, size_bytes: 26_214_401 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('CHECK rejects invalid status', async () => {
    const { data: row } = await admin
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT })
      .select('id')
      .single();
    const { error } = await admin
      .from('ai_imports')
      .update({ status: 'banana' })
      .eq('id', row!.id);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('owner sees only their own rows', async () => {
    await admin.from('ai_imports').insert({ user_id: other.id, ...VALID_IMPORT });
    const { data } = await athlete.client.from('ai_imports').select('user_id');
    expect(data?.every((r) => r.user_id === athlete.id)).toBe(true);
  });

  it('CRITICAL: linked coach CANNOT read athlete imports (D-10)', async () => {
    await admin.from('ai_imports').insert({ user_id: athlete.id, ...VALID_IMPORT });
    const { data, error } = await coach.client
      .from('ai_imports')
      .select('id')
      .eq('user_id', athlete.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('re_upload_source_id self-FK works for same-owner chains', async () => {
    const { data: a } = await admin
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT })
      .select('id')
      .single();
    const { data: b, error } = await admin
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT, re_upload_source_id: a!.id })
      .select('id, re_upload_source_id')
      .single();
    expect(error).toBeNull();
    expect(b?.re_upload_source_id).toBe(a!.id);
  });

  it('committed_program_id ON DELETE SET NULL', async () => {
    const { data: pgm } = await admin
      .from('workout_programs')
      .insert({ user_id: athlete.id, name: 'imp-pgm' })
      .select('id')
      .single();
    const { data: imp } = await admin
      .from('ai_imports')
      .insert({ user_id: athlete.id, ...VALID_IMPORT, committed_program_id: pgm!.id, status: 'committed' })
      .select('id')
      .single();

    await admin.from('workout_programs').delete().eq('id', pgm!.id);

    const { data: post } = await admin
      .from('ai_imports')
      .select('committed_program_id')
      .eq('id', imp!.id)
      .single();
    expect(post?.committed_program_id).toBeNull();
  });

  it('FK CASCADE on auth.users wipes ai_imports', async () => {
    const u = await createTestUser('imp-fk');
    await admin.from('ai_imports').insert({ user_id: u.id, ...VALID_IMPORT });

    await admin.auth.admin.deleteUser(u.id);

    const { data } = await admin.from('ai_imports').select('id').eq('user_id', u.id);
    expect(data?.length ?? 0).toBe(0);
    // u intentionally NOT in createdIds — already deleted.
  });
});
