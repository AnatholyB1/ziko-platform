// P25 (MCOA-02/03) : garde du lien coach et du plugin obligatoire. BASE DE TEST REELLE requise
// (exclu automatiquement sans SUPABASE_URL/KEY ; jamais la production). Prerequis : migrations
// 20261201250100 et 20261201250300 appliquees sur la base de test. NON EXECUTE par l'agent P25.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient, type TestUser } from './fixtures';

const admin = getAdminClient();
let coach: TestUser;
let athlete: TestUser;
let stranger: TestUser;
let linkId: string;

beforeAll(async () => {
  coach = await createTestUser('p25-coach');
  athlete = await createTestUser('p25-athlete');
  stranger = await createTestUser('p25-stranger');
  const { data, error } = await admin
    .from('ziko_coach_client_links')
    .insert({ coach_id: coach.id, client_id: athlete.id })
    .select('id')
    .single();
  if (error) throw new Error(`setup link: ${error.message}`);
  linkId = data!.id;
});

afterAll(async () => {
  await admin.from('ziko_coach_client_links').delete().in('client_id', [athlete.id, stranger.id]);
  await admin.from('ziko_user_plugins').delete().eq('user_id', athlete.id);
  await cleanupTestUsers([coach.id, athlete.id, stranger.id]);
});

describe('ziko_coach_client_links : garde (20261201250100)', () => {
  it('un tiers ne voit ni ne modifie le lien', async () => {
    const read = await stranger.client.from('ziko_coach_client_links').select('id').eq('id', linkId);
    expect(read.data ?? []).toHaveLength(0);
    const upd = await stranger.client.from('ziko_coach_client_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId).select('id');
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("l'athlete ne peut pas changer coach_id (liaison sans code)", async () => {
    const { error } = await athlete.client.from('ziko_coach_client_links').update({ coach_id: stranger.id }).eq('id', linkId);
    expect(error).not.toBeNull();
  });

  it('le coach ne peut pas changer client_id (acces a un athlete arbitraire)', async () => {
    const { error } = await coach.client.from('ziko_coach_client_links').update({ client_id: stranger.id }).eq('id', linkId);
    expect(error).not.toBeNull();
  });

  it("l'athlete retire son lien : revoked_by = 'client', ligne conservee", async () => {
    const { error } = await athlete.client.from('ziko_coach_client_links').update({ revoked_at: new Date().toISOString(), revoked_by: 'coach' }).eq('id', linkId);
    expect(error).toBeNull();
    const { data } = await admin.from('ziko_coach_client_links').select('revoked_at, revoked_by').eq('id', linkId).single();
    expect(data!.revoked_at).not.toBeNull();
    expect(data!.revoked_by).toBe('client'); // la valeur forgee 'coach' est ignoree
  });

  it("l'athlete ne peut pas annuler son retrait (revoked_at -> NULL)", async () => {
    await athlete.client.from('ziko_coach_client_links').update({ revoked_at: null }).eq('id', linkId);
    const { data } = await admin.from('ziko_coach_client_links').select('revoked_at').eq('id', linkId).single();
    expect(data!.revoked_at).not.toBeNull();
  });

  it("l'athlete lit son historique (lien retire) ; le coach n'a plus is_coach_of", async () => {
    const { data } = await athlete.client.from('ziko_coach_client_links').select('id, revoked_at').eq('client_id', athlete.id).not('revoked_at', 'is', null);
    expect((data ?? []).map((r) => r.id)).toContain(linkId);
    const rpc = await admin.rpc('ziko_is_coach_of', { coach: coach.id, client: athlete.id });
    expect(rpc.data).toBe(false);
  });
});

describe('ziko_user_plugins : plugin obligatoire (20261201250300)', () => {
  it("l'athlete ne peut pas supprimer ni desactiver `coach`, mais peut desinstaller un plugin normal", async () => {
    await admin.from('ziko_user_plugins').upsert({ user_id: athlete.id, plugin_id: 'coach', is_enabled: true }, { onConflict: 'user_id,plugin_id' });
    const del = await athlete.client.from('ziko_user_plugins').delete().eq('user_id', athlete.id).eq('plugin_id', 'coach');
    expect(del.error).not.toBeNull();
    const dis = await athlete.client.from('ziko_user_plugins').update({ is_enabled: false }).eq('user_id', athlete.id).eq('plugin_id', 'coach');
    expect(dis.error).not.toBeNull();
    const { data } = await admin.from('ziko_user_plugins').select('is_enabled').eq('user_id', athlete.id).eq('plugin_id', 'coach').single();
    expect(data!.is_enabled).toBe(true);

    await admin.from('ziko_user_plugins').upsert({ user_id: athlete.id, plugin_id: 'habits', is_enabled: true }, { onConflict: 'user_id,plugin_id' });
    const ok = await athlete.client.from('ziko_user_plugins').delete().eq('user_id', athlete.id).eq('plugin_id', 'habits');
    expect(ok.error).toBeNull();
  });
});
