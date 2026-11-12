// P21 (SOC-01..07, G-03, G-04) : integrite des amities + RPC d'amitie + profil public.
// Exige la base de test avec les migrations 202612012101/02/03 appliquees (voir DEPLOY-CHECKLIST-v1.20).
// Le profil du compte de test est cree par le trigger d'auth (user_metadata.app = 'ziko').
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient, getAnonClient, type TestUser } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

let a: TestUser;
let b: TestUser;
let c: TestUser;

beforeAll(async () => {
  a = await createTestUser('fr-a');
  b = await createTestUser('fr-b');
  c = await createTestUser('fr-c');
  createdIds.push(a.id, b.id, c.id);
  // noms recherchables
  for (const [u, name] of [[a, 'Fria Alpha'], [b, 'Frib Bravo'], [c, 'Fric Charlie']] as const) {
    await admin.from('ziko_user_profiles').update({ name }).eq('id', u.id);
  }
});

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

async function wipe() {
  await admin.from('ziko_friendships').delete().in('requester_id', createdIds);
}

describe('friendships RLS (G-04 : plus d\'auto-acceptation)', () => {
  it('le demandeur ne peut pas inserer une ligne deja acceptee', async () => {
    await wipe();
    const { error } = await a.client
      .from('ziko_friendships')
      .insert({ requester_id: a.id, addressee_id: b.id, status: 'accepted' });
    expect(error).not.toBeNull();
  });

  it('le demandeur ne peut pas s\'auto-accepter par UPDATE', async () => {
    await wipe();
    const { error: insErr } = await a.client
      .from('ziko_friendships')
      .insert({ requester_id: a.id, addressee_id: b.id, status: 'pending' });
    expect(insErr).toBeNull();
    const { data } = await a.client
      .from('ziko_friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', a.id)
      .eq('addressee_id', b.id)
      .select('id');
    expect(data ?? []).toHaveLength(0); // la RLS filtre : aucune ligne touchee
    const { data: row } = await admin.from('ziko_friendships').select('status').eq('requester_id', a.id).eq('addressee_id', b.id).single();
    expect(row?.status).toBe('pending');
  });

  it('un tiers ne peut pas accepter', async () => {
    const { data } = await c.client
      .from('ziko_friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', a.id)
      .eq('addressee_id', b.id)
      .select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('le destinataire peut accepter', async () => {
    const { data, error } = await b.client
      .from('ziko_friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', a.id)
      .eq('addressee_id', b.id)
      .select('id');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it('le destinataire ne peut pas changer les parties (trigger d\'immutabilite)', async () => {
    await wipe();
    await a.client.from('ziko_friendships').insert({ requester_id: a.id, addressee_id: b.id, status: 'pending' });
    const { error } = await b.client
      .from('ziko_friendships')
      .update({ requester_id: c.id, status: 'accepted' })
      .eq('requester_id', a.id)
      .eq('addressee_id', b.id);
    expect(error).not.toBeNull();
  });

  it('les deux parties peuvent supprimer (annuler / refuser / retirer)', async () => {
    const { data } = await a.client.from('ziko_friendships').delete().eq('requester_id', a.id).eq('addressee_id', b.id).select('id');
    expect(data ?? []).toHaveLength(1);
  });
});

describe('index unique de paire non ordonnee (G-03)', () => {
  it('la demande croisee B->A est refusee quand A->B existe (23505)', async () => {
    await wipe();
    await a.client.from('ziko_friendships').insert({ requester_id: a.id, addressee_id: b.id, status: 'pending' });
    const { error } = await b.client.from('ziko_friendships').insert({ requester_id: b.id, addressee_id: a.id, status: 'pending' });
    expect(error?.code).toBe('23505');
  });
});

describe('ziko_send_friend_request', () => {
  it('refuse l\'appel anonyme', async () => {
    const anon = getAnonClient();
    const { error } = await anon.rpc('ziko_send_friend_request', { p_addressee: b.id });
    expect(error).not.toBeNull();
  });

  it('refuse de s\'ajouter soi-meme', async () => {
    const { error } = await a.client.rpc('ziko_send_friend_request', { p_addressee: a.id });
    expect(error?.code).toBe('22023');
  });

  it('cree une demande, no-op si deja envoyee', async () => {
    await wipe();
    const first = await a.client.rpc('ziko_send_friend_request', { p_addressee: b.id });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ relation: 'sent', created: true });
    const second = await a.client.rpc('ziko_send_friend_request', { p_addressee: b.id });
    expect(second.data).toMatchObject({ relation: 'sent', created: false });
    const { data } = await admin.from('ziko_friendships').select('id').or(`requester_id.eq.${a.id},addressee_id.eq.${a.id}`);
    expect(data).toHaveLength(1);
  });

  it('accepte quand la demande inverse existe (course) : une seule ligne, acceptee', async () => {
    const r = await b.client.rpc('ziko_send_friend_request', { p_addressee: a.id });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ relation: 'friend', auto_accepted: true });
    const { data } = await admin.from('ziko_friendships').select('status').or(`requester_id.eq.${a.id},addressee_id.eq.${a.id}`);
    expect(data).toEqual([{ status: 'accepted' }]);
  });

  it('envois concurrents croises : une seule ligne', async () => {
    await wipe();
    const [r1, r2] = await Promise.all([
      a.client.rpc('ziko_send_friend_request', { p_addressee: c.id }),
      c.client.rpc('ziko_send_friend_request', { p_addressee: a.id }),
    ]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    const { data } = await admin.from('ziko_friendships').select('status').or(`requester_id.eq.${a.id},addressee_id.eq.${a.id}`);
    expect(data).toHaveLength(1);
  });
});

describe('ziko_search_users_with_status', () => {
  it('moins de 2 caracteres : aucun resultat', async () => {
    const { data, error } = await a.client.rpc('ziko_search_users_with_status', { p_query: 'F' });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('renvoie l\'etat de relation calcule avec auth.uid() (none | sent | received | friend)', async () => {
    await wipe();
    // a -> b (sent cote a, received cote b) ; a <-> c amis
    await a.client.rpc('ziko_send_friend_request', { p_addressee: b.id });
    await c.client.rpc('ziko_send_friend_request', { p_addressee: a.id });
    await a.client.from('ziko_friendships').update({ status: 'accepted' }).eq('requester_id', c.id).eq('addressee_id', a.id);

    const fromA = await a.client.rpc('ziko_search_users_with_status', { p_query: 'fri' });
    const rel = Object.fromEntries((fromA.data ?? []).map((r: any) => [r.id, r.relation]));
    expect(rel[b.id]).toBe('sent');
    expect(rel[c.id]).toBe('friend');
    expect(rel[a.id]).toBeUndefined(); // jamais soi-meme

    const fromB = await b.client.rpc('ziko_search_users_with_status', { p_query: 'fri' });
    const relB = Object.fromEntries((fromB.data ?? []).map((r: any) => [r.id, r.relation]));
    expect(relB[a.id]).toBe('received');
    expect(relB[c.id]).toBe('none');
  });

  it('les jokers LIKE saisis sont traites litteralement', async () => {
    const { data } = await a.client.rpc('ziko_search_users_with_status', { p_query: '%%' });
    expect(data).toEqual([]);
  });

  it('refuse l\'appel anonyme', async () => {
    const { error } = await getAnonClient().rpc('ziko_search_users_with_status', { p_query: 'fri' });
    expect(error).not.toBeNull();
  });
});

describe('ziko_list_friendships', () => {
  it('liste les amities de l\'appelant avec le nom de l\'autre partie (profil non lisible en direct)', async () => {
    const { data, error } = await a.client.rpc('ziko_list_friendships');
    expect(error).toBeNull();
    const byOther = Object.fromEntries((data ?? []).map((r: any) => [r.other_id, r]));
    expect(byOther[b.id]).toMatchObject({ name: 'Frib Bravo', status: 'pending', direction: 'sent' });
    expect(byOther[c.id]).toMatchObject({ name: 'Fric Charlie', status: 'accepted' });
  });

  it('ne divulgue pas les amities des autres', async () => {
    const { data } = await b.client.rpc('ziko_list_friendships');
    const others = (data ?? []).map((r: any) => r.other_id);
    expect(others).not.toContain(c.id);
  });
});

describe('ziko_get_public_profile (Q-P21a : borne au contrat)', () => {
  it('le profil d\'un autre n\'est pas lisible par select direct mais l\'est via le RPC', async () => {
    const direct = await a.client.from('ziko_user_profiles').select('id, name').eq('id', b.id);
    expect(direct.data ?? []).toHaveLength(0);
    const { data, error } = await a.client.rpc('ziko_get_public_profile', { p_user: b.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: b.id, name: 'Frib Bravo', relation: 'sent' });
  });

  it('ne renvoie jamais de donnee de sante ou de poids', async () => {
    await admin.from('ziko_user_profiles').update({ weight_kg: 81.5, height_cm: 182, age: 33 }).eq('id', b.id);
    const { data } = await a.client.rpc('ziko_get_public_profile', { p_user: b.id });
    const keys = Object.keys(data ?? {});
    for (const forbidden of ['weight_kg', 'height_cm', 'age', 'email', 'avatar_url', 'tier', 'subscription_tier', 'language', 'region', 'referral_code']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(data)).not.toContain('81.5');
  });

  it('ensemble de cles stable (contrat)', async () => {
    const { data } = await a.client.rpc('ziko_get_public_profile', { p_user: c.id });
    expect(Object.keys(data ?? {}).sort()).toEqual([
      'badges', 'badges_total', 'common_challenges', 'followers_count', 'friends_count', 'friendship_id', 'goal',
      'handle', 'id', 'level', 'name', 'next_level', 'recent_workouts', 'records', 'relation', 'streak', 'xp', 'xp_to_next',
    ]);
  });

  it('profil inconnu : null ; appel anonyme refuse', async () => {
    const unknown = await a.client.rpc('ziko_get_public_profile', { p_user: '00000000-0000-0000-0000-000000000000' });
    expect(unknown.error).toBeNull();
    expect(unknown.data).toBeNull();
    const anon = await getAnonClient().rpc('ziko_get_public_profile', { p_user: b.id });
    expect(anon.error).not.toBeNull();
  });
});
