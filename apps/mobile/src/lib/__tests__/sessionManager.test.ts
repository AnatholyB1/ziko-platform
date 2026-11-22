import { describe, it, expect, vi } from 'vitest';
import {
  createSessionManager,
  patchGetUser,
  isPermanentAuthError,
  SessionExpiredError,
  type AuthClientLike,
} from '../sessionManager';
import { sendFriendRequestFromSearch } from '../friendRequest';

const NOW = 1_800_000_000_000; // ms
const sec = NOW / 1000;
const mk = (expiresIn: number, id = 'u1') =>
  ({ access_token: 't', refresh_token: 'r', expires_at: sec + expiresIn, user: { id } }) as any;

function client(over: Partial<AuthClientLike> = {}) {
  return {
    getSession: vi.fn(async () => ({ data: { session: mk(3600) } })),
    refreshSession: vi.fn(async () => ({ data: { session: mk(3600, 'u1') } })),
    startAutoRefresh: vi.fn(async () => {}),
    stopAutoRefresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => ({})),
    getUser: vi.fn(async () => ({ data: { user: null }, error: new Error('network') })),
    ...over,
  } as AuthClientLike & Record<string, any>;
}
const mgr = (c: AuthClientLike) => createSessionManager(c, { now: () => NOW });

describe('ensureFreshSession', () => {
  it('returns ok without refreshing when far from expiry', async () => {
    const c = client();
    expect((await mgr(c).ensureFreshSession()).status).toBe('ok');
    expect(c.refreshSession).not.toHaveBeenCalled();
  });
  it('refreshes when near expiry', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: mk(10) } })) });
    const r = await mgr(c).ensureFreshSession();
    expect(r.status).toBe('ok');
    expect(c.refreshSession).toHaveBeenCalledTimes(1);
  });
  it('refreshes when already expired', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: mk(-500) } })) });
    expect((await mgr(c).ensureFreshSession()).status).toBe('ok');
  });
  it('returns none when no session', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: null } })) });
    expect((await mgr(c).ensureFreshSession()).status).toBe('none');
  });
  it('flags expired on invalid_grant / 400', async () => {
    const c = client({
      getSession: vi.fn(async () => ({ data: { session: mk(-5) } })),
      refreshSession: vi.fn(async () => ({
        data: { session: null },
        error: { code: 'refresh_token_not_found', status: 400, message: 'Invalid Refresh Token' },
      })),
    });
    expect((await mgr(c).ensureFreshSession()).status).toBe('expired');
  });
  it('transient network failure keeps a still-valid session (offline)', async () => {
    const s = mk(30);
    const c = client({
      getSession: vi.fn(async () => ({ data: { session: s } })),
      refreshSession: vi.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    });
    const r = await mgr(c).ensureFreshSession();
    expect(r.status).toBe('offline');
    expect(r.session).toBe(s);
  });
  it('transient failure with already-expired token yields offline without session (not expired)', async () => {
    const c = client({
      getSession: vi.fn(async () => ({ data: { session: mk(-5) } })),
      refreshSession: vi.fn(async () => ({ data: { session: null }, error: { status: 0, message: 'fetch failed' } })),
    });
    const r = await mgr(c).ensureFreshSession();
    expect(r.status).toBe('offline');
    expect(r.session).toBeNull();
  });
  it('shares one refresh between concurrent callers', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: mk(5) } })) });
    const m = mgr(c);
    await Promise.all([m.ensureFreshSession(), m.ensureFreshSession(), m.requireUser()]);
    expect(c.refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('requireUser', () => {
  it('returns the user of a valid session', async () => {
    expect((await mgr(client()).requireUser()).id).toBe('u1');
  });
  it('throws SessionExpiredError when expired or absent', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: null } })) });
    await expect(mgr(c).requireUser()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});

describe('foreground / background', () => {
  it('foreground starts auto refresh then refreshes an expired token', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: mk(-100) } })) });
    const r = await mgr(c).handleForeground();
    expect(c.startAutoRefresh).toHaveBeenCalled();
    expect(c.refreshSession).toHaveBeenCalled();
    expect(r.status).toBe('ok');
  });
  it('background stops auto refresh', async () => {
    const c = client();
    await mgr(c).handleBackground();
    expect(c.stopAutoRefresh).toHaveBeenCalled();
  });
  it('clearExpiredSession signs out locally only', async () => {
    const c = client();
    await mgr(c).clearExpiredSession();
    expect(c.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('patchGetUser', () => {
  it('returns the local fresh user instead of a failing network call', async () => {
    const c = client();
    const original = c.getUser;
    patchGetUser(c, mgr(c));
    const res = await c.getUser!();
    expect(res.data.user.id).toBe('u1');
    expect(res.error).toBeNull();
    expect(original).not.toHaveBeenCalled();
  });
  it('refreshes an expired token before answering (the stale-session bug)', async () => {
    const c = client({ getSession: vi.fn(async () => ({ data: { session: mk(-100) } })) });
    patchGetUser(c, mgr(c));
    expect((await c.getUser!()).data.user.id).toBe('u1');
    expect(c.refreshSession).toHaveBeenCalled();
  });
  it('delegates to the original when a jwt is passed', async () => {
    const orig = vi.fn(async () => ({ data: { user: { id: 'x' } }, error: null }));
    const c = client({ getUser: orig });
    patchGetUser(c, mgr(c));
    await c.getUser!('some.jwt');
    expect(orig).toHaveBeenCalledWith('some.jwt');
  });
  it('reports an error (no user) when the session is unrecoverable', async () => {
    const c = client({
      getSession: vi.fn(async () => ({ data: { session: mk(-5) } })),
      refreshSession: vi.fn(async () => ({ data: { session: null }, error: { code: 'invalid_grant', status: 400 } })),
    });
    patchGetUser(c, mgr(c));
    const res = await c.getUser!();
    expect(res.data.user).toBeNull();
    expect(res.error).toBeInstanceOf(SessionExpiredError);
  });
});

describe('isPermanentAuthError', () => {
  it('classifies', () => {
    expect(isPermanentAuthError({ status: 401 })).toBe(true);
    expect(isPermanentAuthError({ message: 'Invalid Refresh Token: Already Used' })).toBe(true);
    expect(isPermanentAuthError({ status: 500 })).toBe(false);
    expect(isPermanentAuthError(new TypeError('Network request failed'))).toBe(false);
    expect(isPermanentAuthError(null)).toBe(false);
  });
});

describe('sendFriendRequestFromSearch', () => {
  const ok = { requireUser: async () => ({ id: 'me' }) };
  it('inserts with the fresh user id', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    expect(await sendFriendRequestFromSearch('you', { ...ok, insert })).toEqual({ ok: true, alreadySent: false });
    expect(insert).toHaveBeenCalledWith({ requester_id: 'me', addressee_id: 'you', status: 'pending' });
  });
  it('treats unique violation as already sent', async () => {
    const r = await sendFriendRequestFromSearch('you', { ...ok, insert: async () => ({ error: { code: '23505' } }) });
    expect(r).toEqual({ ok: true, alreadySent: true });
  });
  it('maps RLS rejection to a session message', async () => {
    const r = await sendFriendRequestFromSearch('you', {
      ...ok,
      insert: async () => ({ error: { code: '42501', message: 'new row violates row-level security policy' } }),
    });
    expect(r).toMatchObject({ ok: false, reason: 'session' });
  });
  it('GRANT manquant (permission denied for table, 42501) n\'est PAS presente comme une session expiree (revue A #25)', async () => {
    const r = await sendFriendRequestFromSearch('you', {
      ...ok,
      insert: async () => ({ error: { code: '42501', message: 'permission denied for table ziko_friendships' } }),
    });
    expect(r).toMatchObject({ ok: false, reason: 'unknown' });
  });
  it('maps expired session', async () => {
    const r = await sendFriendRequestFromSearch('you', {
      requireUser: async () => {
        throw new SessionExpiredError();
      },
      insert: vi.fn(),
    });
    expect(r).toMatchObject({ ok: false, reason: 'session' });
  });
  it('unknown error gives generic message', async () => {
    const r = await sendFriendRequestFromSearch('you', { ...ok, insert: async () => ({ error: { code: '500' } }) });
    expect(r).toMatchObject({ ok: false, reason: 'unknown' });
  });
});
