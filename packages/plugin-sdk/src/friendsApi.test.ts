import { describe, it, expect, vi } from 'vitest';
import {
  sendFriendRequestRpc, searchUsersWithStatus, listFriendships, fetchPublicProfile, normalizePublicProfile,
  mapSendError, xpToNextLabel, levelProgress, profileGoalText,
} from './friendsApi';

const rpcClient = (impl: (fn: string, args: any) => any, extra: Record<string, any> = {}) =>
  ({ rpc: vi.fn(async (fn: string, args: any) => impl(fn, args)), ...extra }) as any;

describe('sendFriendRequestRpc', () => {
  it('appelle le RPC avec p_addressee (aucun id appelant en parametre)', async () => {
    const c = rpcClient(() => ({ data: { relation: 'sent', friendship_id: 'f1', created: true }, error: null }));
    const r = await sendFriendRequestRpc(c, 'you');
    expect(c.rpc).toHaveBeenCalledWith('ziko_send_friend_request', { p_addressee: 'you' });
    expect(r).toEqual({ ok: true, relation: 'sent', friendshipId: 'f1', created: true, autoAccepted: false });
  });
  it('demande inverse (course) : le serveur accepte -> relation friend', async () => {
    const c = rpcClient(() => ({ data: { relation: 'friend', friendship_id: 'f1', auto_accepted: true }, error: null }));
    expect(await sendFriendRequestRpc(c, 'you')).toMatchObject({ ok: true, relation: 'friend', autoAccepted: true });
  });
  it('deja envoyee : no-op ok', async () => {
    const c = rpcClient(() => ({ data: { relation: 'sent', friendship_id: 'f1', created: false }, error: null }));
    expect(await sendFriendRequestRpc(c, 'you')).toMatchObject({ ok: true, relation: 'sent', created: false });
  });
  it('session expiree avant l\'appel : pas de RPC', async () => {
    const c = rpcClient(() => ({ data: null, error: null }));
    const r = await sendFriendRequestRpc(c, 'you', { requireUser: async () => { throw new Error('expired'); } });
    expect(r).toMatchObject({ ok: false, reason: 'session' });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('refuse soi-meme sans appeler le serveur', async () => {
    const c = rpcClient(() => ({ data: null, error: null }));
    const r = await sendFriendRequestRpc(c, 'me', { requireUser: async () => ({ id: 'me' }) });
    expect(r).toMatchObject({ ok: false, reason: 'self' });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('erreur serveur => ok:false (jamais d\'echec avale : cause du store.ts historique)', async () => {
    const c = rpcClient(() => ({ data: null, error: { code: '42501', message: 'row-level security' } }));
    expect(await sendFriendRequestRpc(c, 'you')).toMatchObject({ ok: false, reason: 'session' });
  });
  it('erreur reseau (exception) => reason network', async () => {
    const c = { rpc: vi.fn(async () => { throw new Error('Network request failed'); }) } as any;
    expect(await sendFriendRequestRpc(c, 'you')).toMatchObject({ ok: false, reason: 'network' });
  });
  it('repli INSERT direct (status pending) si le RPC n\'est pas deploye', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const c = {
      rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })),
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'me' } } })) },
      from: vi.fn(() => ({ insert })),
    } as any;
    expect(await sendFriendRequestRpc(c, 'you')).toMatchObject({ ok: true, relation: 'sent' });
    expect(insert).toHaveBeenCalledWith({ requester_id: 'me', addressee_id: 'you', status: 'pending' });
  });
  it('repli : une erreur d\'insert n\'est pas avalee', async () => {
    const c = {
      rpc: vi.fn(async () => ({ data: null, error: { code: '42883' } })),
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'me' } } })) },
      from: vi.fn(() => ({ insert: async () => ({ error: { code: '500', message: 'boom' } }) })),
    } as any;
    expect(await sendFriendRequestRpc(c, 'you')).toMatchObject({ ok: false, reason: 'unknown' });
  });
});

describe('mapSendError', () => {
  it('codes serveur', () => {
    expect(mapSendError({ code: '28000', message: 'not_authenticated' })).toMatchObject({ reason: 'session' });
    expect(mapSendError({ code: '22023', message: 'cannot_befriend_self' })).toMatchObject({ reason: 'self' });
    expect(mapSendError({ code: 'P0002', message: 'user_not_found' })).toMatchObject({ reason: 'not_found' });
    expect(mapSendError({ code: '500' })).toMatchObject({ reason: 'unknown' });
  });
});

describe('searchUsersWithStatus', () => {
  it('< 2 caracteres : aucun appel', async () => {
    const c = rpcClient(() => ({ data: [], error: null }));
    expect(await searchUsersWithStatus(c, ' a ')).toEqual([]);
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('mappe la relation serveur et ne passe aucun id appelant', async () => {
    const c = rpcClient(() => ({
      data: [
        { id: 'a', name: 'Anna', relation: 'friend', friendship_id: 'f' },
        { id: 'b', name: 'Bob', relation: 'weird' },
      ],
      error: null,
    }));
    const r = await searchUsersWithStatus(c, 'an');
    expect(c.rpc).toHaveBeenCalledWith('ziko_search_users_with_status', { p_query: 'an', p_limit: 20 });
    expect(r.map((x) => x.relation)).toEqual(['friend', 'none']);
  });
  it('erreur serveur => lance (l\'UI montre une erreur, pas "aucun resultat")', async () => {
    const c = rpcClient(() => ({ data: null, error: { code: '500', message: 'x' } }));
    await expect(searchUsersWithStatus(c, 'ma')).rejects.toBeTruthy();
  });
  it('repli : ancienne RPC + relation derivee des amities de l\'appelant', async () => {
    const c = {
      rpc: vi.fn(async (fn: string) =>
        fn === 'ziko_search_users_with_status'
          ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
          : { data: [{ id: 'x', name: 'Xavier' }, { id: 'y', name: 'Yann' }], error: null }),
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'me' } } })) },
      from: vi.fn(() => ({
        select: () => ({ or: async () => ({ data: [{ requester_id: 'x', addressee_id: 'me', status: 'pending' }] }) }),
      })),
    } as any;
    const r = await searchUsersWithStatus(c, 'xa');
    expect(r.map((x) => [x.id, x.relation])).toEqual([['x', 'received'], ['y', 'none']]);
  });
});

describe('listFriendships', () => {
  it('normalise les lignes', async () => {
    const c = rpcClient(() => ({
      data: [{ friendship_id: 'f', other_id: 'o', name: 'Zoe', status: 'accepted', direction: 'sent', created_at: '2026-01-01' }],
      error: null,
    }));
    const r = await listFriendships(c);
    expect(r[0]).toMatchObject({ friendship_id: 'f', other_id: 'o', status: 'accepted', direction: 'sent' });
  });
  it('lance sur erreur', async () => {
    await expect(listFriendships(rpcClient(() => ({ data: null, error: { code: '500' } })))).rejects.toBeTruthy();
  });
});

const FULL = {
  id: 'u1', name: 'Marco Delmas', handle: 'marco', goal: 'muscle_gain', relation: 'friend', friendship_id: 'f',
  friends_count: 12, followers_count: 7, level: 14, xp: 4200, next_level: 15, xp_to_next: 580, streak: 5,
  badges: [{ slug: 'a', name: 'A', icon: 'trophy', tier: 1, earned_at: null }], badges_total: 6,
  recent_workouts: [], records: [], common_challenges: [],
};

describe('normalizePublicProfile (D14 : jamais de contenu partiel faux)', () => {
  it('profil complet', () => {
    const p = normalizePublicProfile(FULL)!;
    expect(p.name).toBe('Marco Delmas');
    expect(p.badges_total).toBe(6);
    expect(p.relation).toBe('friend');
  });
  it('relation self conservee', () => {
    expect(normalizePublicProfile({ ...FULL, relation: 'self' })!.relation).toBe('self');
  });
  it('null / sans id / sans nom => null', () => {
    expect(normalizePublicProfile(null)).toBeNull();
    expect(normalizePublicProfile({})).toBeNull();
    expect(normalizePublicProfile({ ...FULL, name: '' })).toBeNull();
    expect(normalizePublicProfile({ ...FULL, id: undefined })).toBeNull();
  });
  it('tableaux et nombres manquants tolerés (etats vides, pas de NaN)', () => {
    const p = normalizePublicProfile({ id: 'u', name: 'Zoe' })!;
    expect(p.badges).toEqual([]);
    expect(p.records).toEqual([]);
    expect(p.friends_count).toBe(0);
    expect(p.level).toBeNull();
  });
  it('ne laisse passer aucun champ de sante / poids', () => {
    const p = normalizePublicProfile({ ...FULL, weight_kg: 80, height_cm: 180, age: 30, email: 'a@b.c' }) as any;
    expect(p.weight_kg).toBeUndefined();
    expect(p.height_cm).toBeUndefined();
    expect(p.age).toBeUndefined();
    expect(p.email).toBeUndefined();
  });
});

describe('fetchPublicProfile', () => {
  it('appelle ziko_get_public_profile avec p_user', async () => {
    const c = rpcClient(() => ({ data: FULL, error: null }));
    expect((await fetchPublicProfile(c, 'u1'))?.id).toBe('u1');
    expect(c.rpc).toHaveBeenCalledWith('ziko_get_public_profile', { p_user: 'u1' });
  });
  it('profil inconnu => null ; erreur reseau => lance', async () => {
    expect(await fetchPublicProfile(rpcClient(() => ({ data: null, error: null })), 'x')).toBeNull();
    await expect(fetchPublicProfile(rpcClient(() => ({ data: null, error: { message: 'Network request failed' } })), 'x')).rejects.toBeTruthy();
  });
});

describe('affichage profil', () => {
  it('xpToNextLabel', () => {
    expect(xpToNextLabel({ xp_to_next: 580, next_level: 15 })).toBe('580 XP avant le niveau 15');
    expect(xpToNextLabel({ xp_to_next: null, next_level: null })).toBeNull();
  });
  it('levelProgress borne 0..1', () => {
    expect(levelProgress({ xp: 420, xp_to_next: 580 })).toBeCloseTo(0.42);
    expect(levelProgress({ xp: null, xp_to_next: 10 })).toBe(0);
  });
  it('objectif FR en minuscules, jamais de slug (PR-3)', () => {
    expect(profileGoalText('muscle_gain')).toBe('prise de muscle');
    expect(profileGoalText('weight_loss')).toBe('perte de poids');
    expect(profileGoalText('endurance')).toBe('endurance');
    expect(profileGoalText('some_new_goal')).not.toContain('_');
    expect(profileGoalText(null)).toBe('');
  });
});
