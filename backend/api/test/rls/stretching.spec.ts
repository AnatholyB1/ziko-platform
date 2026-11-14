// v1.20 Phase 18 (STRE-02, STRE-05) -- catalogue d'exercices de stretching + routine par defaut unique.
// Migrations sous test :
//   supabase/portfolio-migrations/20261201180100_stretching_exercises.sql
//   supabase/portfolio-migrations/20261201180200_stretching_default_routine.sql
// Meme garde RUN_DB que measurement-goals.spec.ts : ne tourne que contre une base de test
// (SUPABASE_TEST_URL === SUPABASE_URL), jamais en CI "verify" ni contre la production.
import { afterAll, describe, expect, it } from 'vitest';
import { createTestUser, cleanupTestUsers } from './fixtures';

const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('stretching -- catalogue en lecture seule, exercices perso, defaut unique (STRE-02/05)', () => {
  const createdUserIds: string[] = [];
  afterAll(async () => {
    await cleanupTestUsers(createdUserIds);
  });

  it('un client lit le catalogue (user_id NULL) mais ne peut pas y ecrire (INSERT user_id NULL refuse)', async () => {
    const a = await createTestUser('stretch-cat');
    createdUserIds.push(a.id);

    const read = await a.client.from('ziko_stretching_exercises').select('id').is('user_id', null).limit(30);
    expect(read.error).toBeNull();
    expect((read.data ?? []).length).toBeGreaterThanOrEqual(24);

    const ins = await a.client.from('ziko_stretching_exercises').insert({
      user_id: null, name: 'Pirate', muscle_group: 'back', measure: 'duration', duration_seconds: 30,
    });
    expect(ins.error).not.toBeNull();
  });

  it('un client ne peut ni modifier ni supprimer une ligne du catalogue', async () => {
    const a = await createTestUser('stretch-cat-write');
    createdUserIds.push(a.id);
    const { data } = await a.client.from('ziko_stretching_exercises').select('id, name').is('user_id', null).limit(1);
    const row = data![0];

    await a.client.from('ziko_stretching_exercises').update({ name: 'Hacked' }).eq('id', row.id);
    await a.client.from('ziko_stretching_exercises').delete().eq('id', row.id);
    const after = await a.client.from('ziko_stretching_exercises').select('name').eq('id', row.id).single();
    expect(after.data?.name).toBe(row.name);
  });

  it('exercice perso : cree par son proprietaire (ST-2), invisible pour un autre athlete', async () => {
    const a = await createTestUser('stretch-own-a');
    const b = await createTestUser('stretch-own-b');
    createdUserIds.push(a.id, b.id);

    const ins = await a.client.from('ziko_stretching_exercises').insert({
      user_id: a.id, name: 'Pigeon sur le dos (perso)', muscle_group: 'hips', measure: 'duration', duration_seconds: 40, sides: 2,
    }).select('id').single();
    expect(ins.error).toBeNull();

    const own = await a.client.from('ziko_stretching_exercises').select('id').eq('id', ins.data!.id);
    expect(own.data).toHaveLength(1);
    const other = await b.client.from('ziko_stretching_exercises').select('id').eq('id', ins.data!.id);
    expect(other.data).toHaveLength(0);

    // ecrire au nom d'un autre est refuse
    const spoof = await b.client.from('ziko_stretching_exercises').insert({
      user_id: a.id, name: 'Usurpation', muscle_group: 'back', measure: 'reps', reps: 5,
    });
    expect(spoof.error).not.toBeNull();
  });

  it('une seule routine par defaut par athlete (index unique partiel, ST-3)', async () => {
    const a = await createTestUser('stretch-default');
    createdUserIds.push(a.id);
    const base = { user_id: a.id, type: 'custom', muscle_groups: [], duration_minutes: 1, exercises: [] };

    const r1 = await a.client.from('ziko_stretching_routines').insert({ id: 'rt_a', name: 'A', is_default: true, ...base });
    expect(r1.error).toBeNull();
    const r2 = await a.client.from('ziko_stretching_routines').insert({ id: 'rt_b', name: 'B', is_default: true, ...base });
    expect(r2.error).not.toBeNull();
    const r3 = await a.client.from('ziko_stretching_routines').insert({ id: 'rt_c', name: 'C', is_default: false, ...base });
    expect(r3.error).toBeNull();
  });
});
