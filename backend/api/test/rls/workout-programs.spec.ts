import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('workout_programs extension columns', () => {
  it('coach can insert a template (is_template=TRUE)', async () => {
    const coach = await createTestUser('wp-coach');
    createdIds.push(coach.id);
    const { data, error } = await coach.client
      .from('workout_programs')
      .insert({
        user_id: coach.id,
        name: 'PPL Template',
        created_by_coach_id: coach.id,
        is_template: true,
        weeks_data: { weeks: [] },
      })
      .select('id, is_template, created_by_coach_id')
      .single();
    expect(error).toBeNull();
    expect(data?.is_template).toBe(true);
    expect(data?.created_by_coach_id).toBe(coach.id);
  });

  it('weeks_data accepts arbitrary JSON shape (no DB CHECK — D-11)', async () => {
    const coach = await createTestUser('wp-zod');
    createdIds.push(coach.id);
    const { error } = await coach.client.from('workout_programs').insert({
      user_id: coach.id,
      name: 'Shape test',
      is_template: true,
      weeks_data: { weird: 'shape', no: ['schema'], nested: { ok: true } },
    });
    expect(error).toBeNull();
  });

  it('template_source_id ON DELETE SET NULL — delete template, fork rows survive with NULL', async () => {
    const coach = await createTestUser('wp-tpl-coach');
    const client = await createTestUser('wp-tpl-client');
    createdIds.push(coach.id, client.id);

    // Template owned by coach
    const { data: tpl } = await admin
      .from('workout_programs')
      .insert({ user_id: coach.id, name: 'Tpl', is_template: true, created_by_coach_id: coach.id })
      .select('id')
      .single();
    // Fork owned by client
    const { data: fork } = await admin
      .from('workout_programs')
      .insert({
        user_id: client.id,
        name: 'Tpl (assigned)',
        is_template: false,
        created_by_coach_id: coach.id,
        assigned_to_user_id: client.id,
        template_source_id: tpl!.id,
      })
      .select('id')
      .single();

    // Delete the template
    await admin.from('workout_programs').delete().eq('id', tpl!.id);

    // Fork survives with template_source_id = NULL
    const { data: post } = await admin
      .from('workout_programs')
      .select('id, template_source_id')
      .eq('id', fork!.id)
      .single();
    expect(post?.id).toBe(fork!.id);
    expect(post?.template_source_id).toBeNull();
  });

  it('created_by_coach_id ON DELETE SET NULL — delete coach, fork survives with NULL', async () => {
    const coach = await createTestUser('wp-fk-coach');
    const client = await createTestUser('wp-fk-client');
    // coach intentionally NOT pushed to createdIds — we will delete inside the test.
    createdIds.push(client.id);

    const { data: fork } = await admin
      .from('workout_programs')
      .insert({
        user_id: client.id,
        name: 'Fork',
        is_template: false,
        created_by_coach_id: coach.id,
        assigned_to_user_id: client.id,
      })
      .select('id')
      .single();

    await admin.auth.admin.deleteUser(coach.id);

    const { data: post } = await admin
      .from('workout_programs')
      .select('id, created_by_coach_id, assigned_to_user_id, user_id')
      .eq('id', fork!.id)
      .single();
    expect(post?.id).toBe(fork!.id);
    expect(post?.created_by_coach_id).toBeNull();
    // assigned_to_user_id points to client (still alive), unchanged
    expect(post?.assigned_to_user_id).toBe(client.id);
    expect(post?.user_id).toBe(client.id);
  });

  it('own_programs FOR ALL policy unchanged — non-owner cannot read', async () => {
    const a = await createTestUser('wp-own-a');
    const b = await createTestUser('wp-own-b');
    createdIds.push(a.id, b.id);
    const { data: pgm } = await a.client
      .from('workout_programs')
      .insert({ user_id: a.id, name: 'A private' })
      .select('id')
      .single();

    const { data, error } = await b.client.from('workout_programs').select('id').eq('id', pgm!.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });
});
