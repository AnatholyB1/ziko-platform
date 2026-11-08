import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ getSession: vi.fn(), fetch: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: h.getSession } } }));
vi.mock('@ziko/plugin-sdk', () => ({
  isEmailVerified: (p: { email_verified_at?: string | null } | null | undefined) => Boolean(p?.email_verified_at),
}));

import { sendVerificationCode, verifyEmailCode, markVerifiedSocial, isEmailVerified } from '../emailVerification';

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k: string) => headers[k] ?? null },
  json: async () => body,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } });
  vi.stubGlobal('fetch', h.fetch);
});

describe('sendVerificationCode', () => {
  it('sends with the bearer and no client-supplied address', async () => {
    h.fetch.mockResolvedValue(res(200, { status: 'sent', cooldown: 60 }));
    expect(await sendVerificationCode()).toEqual({ status: 'sent', cooldown: 60 });
    const [url, init] = h.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/email\/send-code$/);
    expect(init.headers.Authorization).toBe('Bearer jwt');
    expect(init.body).toBeUndefined();
  });
  it('429 -> cooldown with Retry-After', async () => {
    h.fetch.mockResolvedValue(res(429, {}, { 'Retry-After': '33' }));
    expect(await sendVerificationCode()).toEqual({ status: 'cooldown', retryAfter: 33 });
  });
  it('no session / network -> error', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect((await sendVerificationCode()).status).toBe('error');
    h.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } } });
    h.fetch.mockRejectedValue(new Error('net'));
    expect((await sendVerificationCode()).status).toBe('error');
  });
});

describe('verifyEmailCode', () => {
  it('ok', async () => {
    h.fetch.mockResolvedValue(res(200, { status: 'ok' }));
    expect(await verifyEmailCode('123 456')).toEqual({ status: 'verified' });
    expect(JSON.parse(h.fetch.mock.calls[0][1].body)).toEqual({ code: '123456' });
  });
  it('malformed -> no network call', async () => {
    expect((await verifyEmailCode('12ab')).status).toBe('error');
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it.each([['bad', 400], ['expired', 410], ['too_many', 429]])('%s mapped', async (reason, code) => {
    h.fetch.mockResolvedValue(res(code, { status: reason }));
    const r = await verifyEmailCode('123456');
    expect(r).toMatchObject({ status: 'error', reason });
  });
});

describe('markVerifiedSocial / isEmailVerified', () => {
  it('returns the server verdict', async () => {
    h.fetch.mockResolvedValue(res(200));
    expect(await markVerifiedSocial()).toBe(true);
    h.fetch.mockResolvedValue(res(403));
    expect(await markVerifiedSocial()).toBe(false);
  });
  it('isEmailVerified', () => {
    expect(isEmailVerified(null)).toBe(false);
    expect(isEmailVerified({ email_verified_at: null })).toBe(false);
    expect(isEmailVerified({ email_verified_at: '2026-01-01T00:00:00Z' })).toBe(true);
  });
});
