// Phase 25 plan 06 Task 3 / T-25-04 — safeNext allowlist + regex correctness.
// Tests the exported safeNext from src/actions/login.ts. Mocks Next.js server
// modules so the 'use server' file can be imported in a node test environment.
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Map<string, string>()),
}));
vi.mock('../src/lib/ratelimit', () => ({
  ratelimit: { limit: vi.fn(async () => ({ success: true })) },
}));
vi.mock('../src/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { signInWithPassword: vi.fn() },
    from: vi.fn(),
  })),
}));

const { safeNext } = await import('../src/actions/login');

const DEFAULT = '/coach/dashboard';

describe('safeNext (Phase 25 D-15 + T-25-04) — allowlist (exact-string)', () => {
  it.each([
    ['/coach/onboarding'],
    ['/coach/dashboard'],
    ['/coach/settings'],
    ['/redeem'],
  ])('accepts %s', (next) => {
    expect(safeNext(next)).toBe(next);
  });
});

describe('safeNext deep-link regex /r/[A-Z2-9]{6}', () => {
  it('accepts /r/ABC234', () => expect(safeNext('/r/ABC234')).toBe('/r/ABC234'));
  it('accepts /r/Z9Z9Z9', () => expect(safeNext('/r/Z9Z9Z9')).toBe('/r/Z9Z9Z9'));
});

describe('safeNext rejects (falls back to dashboard)', () => {
  it('rejects open-redirect https://evil.com/r/ABC234', () =>
    expect(safeNext('https://evil.com/r/ABC234')).toBe(DEFAULT));
  it('rejects http://attacker', () =>
    expect(safeNext('http://attacker')).toBe(DEFAULT));
  it('rejects lowercase /r/abc234', () =>
    expect(safeNext('/r/abc234')).toBe(DEFAULT));
  it('rejects 7-char /r/ABCDEFG', () =>
    expect(safeNext('/r/ABCDEFG')).toBe(DEFAULT));
  it('rejects 5-char /r/ABCDE', () =>
    expect(safeNext('/r/ABCDE')).toBe(DEFAULT));
  it('rejects path traversal /r/../admin', () =>
    expect(safeNext('/r/../admin')).toBe(DEFAULT));
  it('rejects /r/ABC23O (O is in DB alphabet but /r/ABC23O is 7 chars short of /r/ — actually 7 chars valid)', () => {
    // /r/ABC23O — that's 6 chars from /r/. The DB alphabet IS A-Z, including O.
    // So this case IS accepted. We instead reject ABC230 (0 not in alphabet).
    expect(safeNext('/r/ABC23O')).toBe('/r/ABC23O');
  });
  it('rejects /r/ABC230 (0 not in alphabet)', () =>
    expect(safeNext('/r/ABC230')).toBe(DEFAULT));
  it('rejects /r/ABC231 (1 not in alphabet)', () =>
    expect(safeNext('/r/ABC231')).toBe(DEFAULT));
  it('rejects null', () => expect(safeNext(null)).toBe(DEFAULT));
  it('rejects empty string', () => expect(safeNext('')).toBe(DEFAULT));
  it('rejects /admin', () => expect(safeNext('/admin')).toBe(DEFAULT));
  it('rejects /coach/secrets', () =>
    expect(safeNext('/coach/secrets')).toBe(DEFAULT));
});
