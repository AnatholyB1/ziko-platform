// P2 refresh-on-foreground: realistic test with the REAL GoTrueClient (auth-js), mocked fetch,
// fake clock. Proves what supabase-js + sessionManager do when the app returns to foreground
// with a token near/after expiry, and the "refresh refused" path.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoTrueClient } from '@supabase/auth-js';
import { createSessionManager } from '../sessionManager';

const T0 = 1_800_000_000_000;
const sess = (expiresInSec: number, rt = 'rt0') => ({
  access_token: 'at-' + rt,
  refresh_token: rt,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(T0 / 1000) + expiresInSec,
  user: { id: 'u1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' },
});

function setup(refreshResponder: () => Response) {
  const store: Record<string, string> = {};
  const fetchMock = vi.fn(async (url: any) => {
    if (String(url).includes('grant_type=refresh_token')) return refreshResponder();
    return new Response('{}', { status: 404 });
  });
  const auth = new GoTrueClient({
    url: 'http://auth.test',
    storageKey: 'k',
    storage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    fetch: fetchMock as any,
  });
  return { auth, store, fetchMock };
}

const okRefresh = () =>
  new Response(JSON.stringify(sess(3600, 'rt1')), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const refusedRefresh = () =>
  new Response(
    JSON.stringify({
      code: 'refresh_token_not_found',
      error_code: 'refresh_token_not_found',
      message: 'Invalid Refresh Token: Refresh Token Not Found',
    }),
    { status: 400, headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' } },
  );

describe('foreground refresh with real GoTrueClient', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('token valid for 1h: no network refresh on foreground', async () => {
    const { auth, store, fetchMock } = setup(okRefresh);
    store['k'] = JSON.stringify(sess(3600));
    const m = createSessionManager(auth as any);
    const r = await m.handleForeground();
    expect(r.status).toBe('ok');
    expect(fetchMock).not.toHaveBeenCalled();
    await auth.stopAutoRefresh();
  });

  it('token expiring in 45 s (inside supabase 90 s margin and our 60 s skew): refreshed', async () => {
    const { auth, store, fetchMock } = setup(okRefresh);
    store['k'] = JSON.stringify(sess(45));
    const m = createSessionManager(auth as any);
    const r = await m.handleForeground();
    expect(r.status).toBe('ok');
    expect(r.session?.refresh_token).toBe('rt1');
    expect(fetchMock).toHaveBeenCalled();
    await auth.stopAutoRefresh();
  });

  it('device clock advanced 2 days: refresh is attempted and succeeds silently (no logout, no alert)', async () => {
    const { auth, store, fetchMock } = setup(okRefresh);
    store['k'] = JSON.stringify(sess(3600));
    vi.setSystemTime(T0 + 2 * 86400_000);
    const m = createSessionManager(auth as any);
    const r = await m.handleForeground();
    expect(fetchMock).toHaveBeenCalled();
    expect(r.status).toBe('ok');
    await auth.stopAutoRefresh();
  });

  it('refresh refused (token revoked / session deleted): status expired', async () => {
    const { auth, store } = setup(refusedRefresh);
    store['k'] = JSON.stringify(sess(30));
    const m = createSessionManager(auth as any);
    const r = await m.handleForeground();
    expect(r.status).toBe('expired');
    await auth.stopAutoRefresh();
  });
});
