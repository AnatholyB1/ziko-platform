import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('../supabase', () => ({ supabase: { auth: { signUp: h.signUp } } }));
vi.mock('../emailVerification', () => ({
  sendVerificationCode: h.send,
  verifyEmailCode: h.verify,
}));

import { signUpWithEmail, verifySignupCode, resendSignupCode } from '../emailSignup';

beforeEach(() => vi.clearAllMocks());

describe('signUpWithEmail', () => {
  it('session + code sent -> verify-email with cooldown', async () => {
    h.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    h.send.mockResolvedValue({ status: 'sent', cooldown: 60 });
    expect(await signUpWithEmail('A', 'a@b.fr', 'pw1234')).toEqual({
      status: 'verify-email', email: 'a@b.fr', cooldown: 60,
    });
  });
  it('code send failing never blocks: signed-in', async () => {
    h.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    h.send.mockResolvedValue({ status: 'error', message: 'x' });
    expect(await signUpWithEmail('A', 'a@b.fr', 'pw1234')).toEqual({ status: 'signed-in' });
  });
  it('backend cooldown still shows the code screen', async () => {
    h.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    h.send.mockResolvedValue({ status: 'cooldown', retryAfter: 42 });
    expect(await signUpWithEmail('A', 'a@b.fr', 'pw1234')).toEqual({
      status: 'verify-email', email: 'a@b.fr', cooldown: 42,
    });
  });
  it('no session (autoconfirm off) -> explicit error, no code sent', async () => {
    h.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null });
    const r = await signUpWithEmail('A', 'a@b.fr', 'pw1234');
    expect(r.status).toBe('error');
    expect(h.send).not.toHaveBeenCalled();
  });
  it('error surfaces message', async () => {
    h.signUp.mockResolvedValue({ data: null, error: { message: 'User already registered' } });
    expect(await signUpWithEmail('A', 'a@b.fr', 'pw1234')).toEqual({
      status: 'error', message: 'User already registered',
    });
  });
  it('passes app marker and name', async () => {
    h.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await signUpWithEmail('Zed', 'z@z.fr', 'pw1234');
    expect(h.signUp.mock.calls[0][0].options.data).toEqual({ app: 'ziko', full_name: 'Zed' });
  });
});

describe('code helpers delegate to the backend client (no Supabase verifyOtp)', () => {
  it('verifySignupCode', async () => {
    h.verify.mockResolvedValue({ status: 'verified' });
    expect(await verifySignupCode('123456')).toEqual({ status: 'verified' });
    expect(h.verify).toHaveBeenCalledWith('123456');
  });
  it('resendSignupCode', async () => {
    h.send.mockResolvedValue({ status: 'sent', cooldown: 60 });
    expect((await resendSignupCode()).status).toBe('sent');
  });
});
