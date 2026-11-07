import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Real middlewares need Supabase/Upstash env at import time; the router receives its own via deps.
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn() }));
vi.mock('../middleware/rateLimiter.js', () => ({ createUserRateLimiter: vi.fn() }));

import {
  createAuthEmailRouter,
  hashCode,
  safeEqualHex,
  generateCode,
  socialIdentityProvesEmail,
  COOLDOWN_SECONDS,
  type AuthEmailDeps,
  type AttemptRow,
} from './auth-email.js';

const USER = 'u-1';
const MAIL = 'me@example.com';

function makeDeps(over: Partial<AuthEmailDeps> = {}) {
  type Mail = { from: string; to: string; subject: string; html: string };
  const sendMail = vi.fn(async (_m: Mail): Promise<{ error?: unknown }> => ({}));
  const store: { hash?: string; salt?: string } = {};
  const rpc = {
    codeAge: vi.fn(async (): Promise<number | null> => null),
    createCode: vi.fn(async (_j: string, hash: string, salt: string) => {
      store.hash = hash;
      store.salt = salt;
    }),
    verifyAttempt: vi.fn(
      async (): Promise<AttemptRow> => ({ status: 'pending', code_hash: store.hash ?? null, salt: store.salt ?? null }),
    ),
    confirm: vi.fn(async () => {}),
    markVerifiedSocial: vi.fn(async () => {}),
  };
  const deps: AuthEmailDeps = {
    rpc,
    getUser: vi.fn(async () => ({ email: MAIL, identities: [] })),
    sendMail,
    hasMailKey: () => true,
    from: () => 'Ziko <no-reply@mail.ziko-app.com>',
    rateLimit: async (_c, next) => next(),
    authenticate: async (c, next) => {
      if (!c.req.header('Authorization')?.startsWith('Bearer ')) return c.json({ error: 'no' }, 401);
      c.set('auth', { userId: USER, email: MAIL });
      await next();
    },
    ...over,
  };
  const app = new Hono().route('/auth', createAuthEmailRouter(deps));
  return { app, deps, rpc, sendMail, store };
}

const H = { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' };
const post = (app: Hono, path: string, body?: unknown, headers: Record<string, string> = H) =>
  app.request(path, { method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });

describe('helpers', () => {
  it('generateCode is 6 digits', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it('hashCode depends on salt, user and code', () => {
    const a = hashCode('123456', 's', 'u');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode('123456', 's2', 'u')).not.toBe(a);
    expect(hashCode('123456', 's', 'u2')).not.toBe(a);
    expect(hashCode('123457', 's', 'u')).not.toBe(a);
  });
  it('safeEqualHex handles equal, different and mismatched lengths without throwing', () => {
    const a = hashCode('1', 's', 'u');
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, hashCode('2', 's', 'u'))).toBe(false);
    expect(safeEqualHex(a, 'abcd')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });
  it('socialIdentityProvesEmail', () => {
    const g = { provider: 'google', email: 'ME@example.com', emailVerified: true };
    expect(socialIdentityProvesEmail({ email: MAIL, identities: [g] })).toBe(true);
    expect(socialIdentityProvesEmail({ email: MAIL, identities: [{ ...g, email: 'other@x.com' }] })).toBe(false);
    expect(socialIdentityProvesEmail({ email: MAIL, identities: [{ ...g, emailVerified: false }] })).toBe(false);
    expect(socialIdentityProvesEmail({ email: MAIL, identities: [{ provider: 'email', email: MAIL }] })).toBe(false);
    expect(socialIdentityProvesEmail({ email: '', identities: [g] })).toBe(false);
  });
});

describe('POST /auth/email/send-code', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without bearer', async () => {
    const { app, sendMail } = makeDeps();
    const r = await post(app, '/auth/email/send-code', undefined, { 'Content-Type': 'application/json' });
    expect(r.status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('stores only a hash and mails the code to the account email (ignores body address)', async () => {
    const { app, sendMail, store, rpc } = makeDeps();
    const r = await post(app, '/auth/email/send-code', { email: 'victim@else.com' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'sent', cooldown: COOLDOWN_SECONDS });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toBe(MAIL);
    expect(arg.from).toBe('Ziko <no-reply@mail.ziko-app.com>');
    const code = /(\d{6})/.exec(arg.html.replace(/<[^>]+>/g, ' '))?.[1];
    expect(code).toBeDefined();
    expect(store.hash).toBe(hashCode(code!, store.salt!, USER));
    // the code itself is never sent to the DB
    expect(JSON.stringify(rpc.createCode.mock.calls)).not.toContain(`"${code}"`);
  });

  it('429 during cooldown, no mail', async () => {
    const { app, sendMail, rpc } = makeDeps();
    rpc.codeAge.mockResolvedValue(20);
    const r = await post(app, '/auth/email/send-code');
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe(String(COOLDOWN_SECONDS - 20));
    expect(sendMail).not.toHaveBeenCalled();
    expect(rpc.createCode).not.toHaveBeenCalled();
  });

  it('allows a resend after the cooldown', async () => {
    const { app, rpc } = makeDeps();
    rpc.codeAge.mockResolvedValue(COOLDOWN_SECONDS + 1);
    expect((await post(app, '/auth/email/send-code')).status).toBe(200);
  });

  it('hourly cap middleware can reject', async () => {
    const { app, sendMail } = makeDeps({ rateLimit: async (c) => c.json({ error: 'Rate limit exceeded' }, 429) });
    expect((await post(app, '/auth/email/send-code')).status).toBe(429);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('503 when the mail key is missing, 502 when Resend fails', async () => {
    expect((await post(makeDeps({ hasMailKey: () => false }).app, '/auth/email/send-code')).status).toBe(503);
    const failing = makeDeps();
    failing.sendMail.mockResolvedValue({ error: { message: 'boom' } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await post(failing.app, '/auth/email/send-code')).status).toBe(502);
    spy.mockRestore();
  });
});

describe('POST /auth/email/verify-code', () => {
  async function sent() {
    const t = makeDeps();
    await post(t.app, '/auth/email/send-code');
    const code = /(\d{6})/.exec(t.sendMail.mock.calls[0][0].html.replace(/<[^>]+>/g, ' '))![1];
    return { ...t, code };
  }

  it('right code -> ok and confirm called', async () => {
    const { app, rpc, code } = await sent();
    const r = await post(app, '/auth/email/verify-code', { code });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
    expect(rpc.confirm).toHaveBeenCalledTimes(1);
  });

  it('wrong code -> 400 bad, confirm not called', async () => {
    const { app, rpc, code } = await sent();
    const wrong = code === '000000' ? '000001' : '000000';
    const r = await post(app, '/auth/email/verify-code', { code: wrong });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ status: 'bad' });
    expect(rpc.confirm).not.toHaveBeenCalled();
  });

  it('malformed code -> 400 without touching the DB', async () => {
    const { app, rpc } = await sent();
    for (const code of ['12345', '1234567', 'abcdef', 123456, undefined]) {
      expect((await post(app, '/auth/email/verify-code', { code })).status).toBe(400);
    }
    expect(rpc.verifyAttempt).not.toHaveBeenCalled();
  });

  it('expired / too_many / none are mapped', async () => {
    const { app, rpc } = makeDeps();
    rpc.verifyAttempt.mockResolvedValueOnce({ status: 'expired', code_hash: null, salt: null });
    expect((await post(app, '/auth/email/verify-code', { code: '123456' })).status).toBe(410);
    rpc.verifyAttempt.mockResolvedValueOnce({ status: 'too_many', code_hash: null, salt: null });
    expect((await post(app, '/auth/email/verify-code', { code: '123456' })).status).toBe(429);
    rpc.verifyAttempt.mockResolvedValueOnce({ status: 'none', code_hash: null, salt: null });
    expect((await post(app, '/auth/email/verify-code', { code: '123456' })).status).toBe(400);
    expect(rpc.confirm).not.toHaveBeenCalled();
  });
});

describe('POST /auth/email/mark-verified-social', () => {
  it('403 when no google/apple identity proves the email', async () => {
    const { app, rpc } = makeDeps();
    expect((await post(app, '/auth/email/mark-verified-social')).status).toBe(403);
    expect(rpc.markVerifiedSocial).not.toHaveBeenCalled();
  });
  it('403 when the JWT is unknown to GoTrue', async () => {
    const { app } = makeDeps({ getUser: vi.fn(async () => null) });
    expect((await post(app, '/auth/email/mark-verified-social')).status).toBe(403);
  });
  it('200 and RPC called when a google identity proves the email', async () => {
    const { app, rpc } = makeDeps({
      getUser: vi.fn(async () => ({
        email: MAIL,
        identities: [{ provider: 'email', email: MAIL }, { provider: 'google', email: MAIL, emailVerified: true }],
      })),
    });
    expect((await post(app, '/auth/email/mark-verified-social')).status).toBe(200);
    expect(rpc.markVerifiedSocial).toHaveBeenCalledTimes(1);
  });
  it('does not trust a client-supplied claim', async () => {
    const { app, rpc } = makeDeps();
    const r = await post(app, '/auth/email/mark-verified-social', { provider: 'google', email: MAIL });
    expect(r.status).toBe(403);
    expect(rpc.markVerifiedSocial).not.toHaveBeenCalled();
  });
});
