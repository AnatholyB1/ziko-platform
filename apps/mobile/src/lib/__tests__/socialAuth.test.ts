import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  g: { configure: vi.fn(), hasPlayServices: vi.fn(), signIn: vi.fn() },
  a: { isAvailableAsync: vi.fn(), signInAsync: vi.fn() },
  sb: { signInWithIdToken: vi.fn(), updateUser: vi.fn() },
}));

vi.mock('react-native', () => ({ Platform: h.platform }));
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: h.g,
  statusCodes: { SIGN_IN_CANCELLED: '12501', PLAY_SERVICES_NOT_AVAILABLE: 'PSNA' },
}));
vi.mock('expo-apple-authentication', () => ({
  isAvailableAsync: h.a.isAvailableAsync,
  signInAsync: h.a.signInAsync,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock('expo-crypto', () => ({
  getRandomBytes: () => new Uint8Array(32).fill(7),
  digestStringAsync: vi.fn(async (_a: string, s: string) => `hash(${s})`),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));
vi.mock('../supabase', () => ({ supabase: { auth: h.sb } }));

import {
  signInWithGoogle, signInWithApple, handleSocialResult, isAppleSignInSupported,
} from '../socialAuth';

const NOW = '2026-01-01T00:00:00Z';
const newUser = { created_at: NOW, last_sign_in_at: '2026-01-01T00:00:02Z' };
const oldUser = { created_at: '2025-01-01T00:00:00Z', last_sign_in_at: NOW };

beforeEach(() => {
  vi.clearAllMocks();
  h.platform.OS = 'ios';
  h.g.hasPlayServices.mockResolvedValue(true);
  h.a.isAvailableAsync.mockResolvedValue(true);
  h.sb.updateUser.mockResolvedValue({});
});

describe('Google', () => {
  it('success new user', async () => {
    h.g.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } });
    h.sb.signInWithIdToken.mockResolvedValue({ data: { user: newUser }, error: null });
    expect(await signInWithGoogle()).toEqual({ status: 'success', isNewUser: true });
    expect(h.sb.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'tok' });
  });
  it('success returning user', async () => {
    h.g.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } });
    h.sb.signInWithIdToken.mockResolvedValue({ data: { user: oldUser }, error: null });
    expect(await signInWithGoogle()).toEqual({ status: 'success', isNewUser: false });
  });
  it('cancelled response is silent', async () => {
    h.g.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    expect(await signInWithGoogle()).toEqual({ status: 'cancelled' });
    expect(h.sb.signInWithIdToken).not.toHaveBeenCalled();
  });
  it('thrown SIGN_IN_CANCELLED is silent', async () => {
    h.g.signIn.mockRejectedValue({ code: '12501' });
    expect(await signInWithGoogle()).toEqual({ status: 'cancelled' });
  });
  it('provider error -> French message', async () => {
    h.g.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } });
    h.sb.signInWithIdToken.mockResolvedValue({ data: {}, error: { message: 'invalid audience' } });
    const r = await signInWithGoogle();
    expect(r.status).toBe('error');
    expect((r as any).message).toMatch(/échoué/);
  });
  it('network error -> network message', async () => {
    h.g.signIn.mockRejectedValue(new Error('Network request failed'));
    const r = await signInWithGoogle();
    expect((r as any).message).toMatch(/internet/);
  });
});

describe('Apple', () => {
  const cred = { identityToken: 'itok', fullName: { givenName: 'Ada', familyName: 'L' } };
  it('success new user, nonce hashed to Apple and raw to Supabase, name saved', async () => {
    h.a.signInAsync.mockResolvedValue(cred);
    h.sb.signInWithIdToken.mockResolvedValue({ data: { user: newUser }, error: null });
    expect(await signInWithApple()).toEqual({ status: 'success', isNewUser: true });
    const raw = '07'.repeat(32);
    expect(h.a.signInAsync.mock.calls[0][0].nonce).toBe(`hash(${raw})`);
    expect(h.sb.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'itok', nonce: raw });
    expect(h.sb.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Ada L' } });
  });
  it('success returning user, no name -> no updateUser', async () => {
    h.a.signInAsync.mockResolvedValue({ identityToken: 'itok', fullName: null });
    h.sb.signInWithIdToken.mockResolvedValue({ data: { user: oldUser }, error: null });
    expect(await signInWithApple()).toEqual({ status: 'success', isNewUser: false });
    expect(h.sb.updateUser).not.toHaveBeenCalled();
  });
  it('cancel is silent', async () => {
    h.a.signInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    expect(await signInWithApple()).toEqual({ status: 'cancelled' });
  });
  it('provider error', async () => {
    h.a.signInAsync.mockResolvedValue(cred);
    h.sb.signInWithIdToken.mockResolvedValue({ data: {}, error: { message: 'nonce mismatch' } });
    expect((await signInWithApple()).status).toBe('error');
  });
  it('Android hides Apple and never calls the SDK', async () => {
    h.platform.OS = 'android';
    expect(isAppleSignInSupported()).toBe(false);
    expect((await signInWithApple()).status).toBe('error');
    expect(h.a.signInAsync).not.toHaveBeenCalled();
  });
});

describe('handleSocialResult', () => {
  const mk = () => ({ alert: vi.fn(), replace: vi.fn(), beforeRoute: vi.fn(async () => {}) });
  it('cancelled: nothing happens', async () => {
    const d = mk();
    await handleSocialResult({ status: 'cancelled' }, d);
    expect(d.alert).not.toHaveBeenCalled();
    expect(d.replace).not.toHaveBeenCalled();
  });
  it('error: alert, no route', async () => {
    const d = mk();
    await handleSocialResult({ status: 'error', message: 'x' }, d);
    expect(d.alert).toHaveBeenCalledWith('Connexion impossible', 'x');
    expect(d.replace).not.toHaveBeenCalled();
  });
  it('new -> onboarding, returning -> app', async () => {
    const d = mk();
    await handleSocialResult({ status: 'success', isNewUser: true }, d);
    expect(d.replace).toHaveBeenLastCalledWith('/(auth)/onboarding/step-1');
    await handleSocialResult({ status: 'success', isNewUser: false }, d);
    expect(d.replace).toHaveBeenLastCalledWith('/(app)');
  });
});
