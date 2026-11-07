import { describe, it, expect, vi, beforeEach } from 'vitest';

const sb = vi.hoisted(() => ({ signUp: vi.fn(), verifyOtp: vi.fn(), resend: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { auth: sb } }));

import { signUpWithEmail, verifySignupCode, resendSignupCode } from '../emailSignup';

beforeEach(() => vi.clearAllMocks());

describe('signUpWithEmail', () => {
  it('session returned (autoconfirm) -> signed-in', async () => {
    sb.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    expect(await signUpWithEmail('A', 'a@b.fr', 'pw1234')).toEqual({ status: 'signed-in' });
  });
  it('no session (confirmation on) -> needs-verification', async () => {
    sb.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    expect(await signUpWithEmail('A', 'a@b.fr', 'pw1234')).toEqual({
      status: 'needs-verification', email: 'a@b.fr',
    });
  });
  it('error surfaces message', async () => {
    sb.signUp.mockResolvedValue({ data: null, error: { message: 'User already registered' } });
    const r = await signUpWithEmail('A', 'a@b.fr', 'pw1234');
    expect(r).toEqual({ status: 'error', message: 'User already registered' });
  });
  it('passes app marker and name', async () => {
    sb.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await signUpWithEmail('Zed', 'z@z.fr', 'pw1234');
    expect(sb.signUp.mock.calls[0][0].options.data).toEqual({ app: 'ziko', full_name: 'Zed' });
  });
});

describe('verifySignupCode', () => {
  it('valid code -> verified', async () => {
    sb.verifyOtp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    expect(await verifySignupCode('a@b.fr', '123 456')).toEqual({ status: 'verified' });
    expect(sb.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.fr', token: '123456', type: 'signup' });
  });
  it('malformed code rejected without a network call', async () => {
    const r = await verifySignupCode('a@b.fr', 'abc');
    expect(r.status).toBe('error');
    expect(sb.verifyOtp).not.toHaveBeenCalled();
  });
  it('wrong code -> French error', async () => {
    sb.verifyOtp.mockResolvedValue({ data: {}, error: { message: 'Token has expired' } });
    const r = await verifySignupCode('a@b.fr', '000000');
    expect(r.status).toBe('error');
    expect((r as any).message).toMatch(/invalide ou expiré/);
  });
});

describe('resendSignupCode', () => {
  it('ok / error', async () => {
    sb.resend.mockResolvedValue({ error: null });
    expect((await resendSignupCode('a@b.fr')).status).toBe('verified');
    sb.resend.mockResolvedValue({ error: { message: 'rate limit' } });
    expect((await resendSignupCode('a@b.fr')).status).toBe('error');
  });
});
