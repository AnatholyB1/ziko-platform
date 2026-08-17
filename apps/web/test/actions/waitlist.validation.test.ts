// Phase 5 plan 05-02, T-05-04 — proves the guard chain (honeypot, bot check, rate
// limit, syntax, disposable domain) refuses/drops submissions before the RPC ever runs,
// entirely in a plain Vitest/Node process with no database. Mirrors the hoisted-mock
// convention `waitlist.concurrency.test.ts` already establishes for `server-only`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MailChecker from 'mailchecker';

// The service-role admin client module imports 'server-only', whose default export
// throws outside a React Server Component. Vitest hoists this mock above the static
// imports below, so claimWaitlistSpot can be imported directly in a plain Node process.
vi.mock('server-only', () => ({}));

const { checkBotIdMock, rpcMock, waitlistLimitMock } = vi.hoisted(() => ({
  checkBotIdMock: vi.fn(),
  rpcMock: vi.fn(),
  waitlistLimitMock: vi.fn(),
}));

// `botid/server` is imported statically at module scope in the action (deliberately —
// see the action's own header comment), so this suite mocks it the same way the
// concurrency suite mocks `server-only`.
vi.mock('botid/server', () => ({
  checkBotId: checkBotIdMock,
}));

vi.mock('@/lib/ratelimit', () => ({
  waitlistRatelimit: { limit: waitlistLimitMock },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

const { claimWaitlistSpot } = await import('../../src/actions/waitlist');

const NOT_A_BOT = { isHuman: true, isBot: false, isVerifiedBot: false, bypassed: false };
const IS_A_BOT = { isHuman: false, isBot: true, isVerifiedBot: false, bypassed: false };
const RATE_LIMIT_OK = { success: true, limit: 5, remaining: 4, reset: 0, pending: Promise.resolve() };
const RATE_LIMIT_EXHAUSTED = { success: false, limit: 5, remaining: 0, reset: 0, pending: Promise.resolve() };

// The RPC's shape for a genuinely-new, non-founder signup — founder_rank is well past
// 200, is_new is true. Matches the shape `admin.rpc('claim_waitlist_signup', ...)`
// actually returns per the migration's RETURNS TABLE clause.
const NEW_NON_FOUNDER_ROW = { is_new: true, is_founder: false, founder_rank: 4200 };

const initialState = {
  status: 'idle' as const,
  isFounder: false,
  founderRank: null,
  message: '',
  code: null,
};

function buildFormData(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('email', fields.email ?? 'visitor@example.com');
  fd.set('audience', fields.audience ?? 'athlete');
  fd.set('locale', fields.locale ?? 'fr');
  if (fields.website !== undefined) fd.set('website', fields.website);
  return fd;
}

beforeEach(() => {
  checkBotIdMock.mockReset().mockResolvedValue(NOT_A_BOT);
  waitlistLimitMock.mockReset().mockResolvedValue(RATE_LIMIT_OK);
  rpcMock.mockReset().mockResolvedValue({ data: [NEW_NON_FOUNDER_ROW], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('claimWaitlistSpot — malformed form (WAIT-04)', () => {
  it('a submission with no email returns status:error and never calls the RPC spy', async () => {
    const fd = buildFormData();
    fd.delete('email');
    const result = await claimWaitlistSpot(initialState, fd);
    expect(result.status).toBe('error');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('a submission with no audience returns status:error and never calls the RPC spy', async () => {
    const fd = buildFormData();
    fd.delete('audience');
    const result = await claimWaitlistSpot(initialState, fd);
    expect(result.status).toBe('error');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('claimWaitlistSpot — malformed email syntax (WAIT-04)', () => {
  it.each(['not-an-email', 'foo@', '@bar.com', 'foo bar@example.com'])(
    '%s returns status:error with the invalid-email code and never calls the RPC spy',
    async (badEmail) => {
      const result = await claimWaitlistSpot(initialState, buildFormData({ email: badEmail }));
      expect(result.status).toBe('error');
      expect(result.code).toBe('invalid_email');
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );
});

describe('claimWaitlistSpot — disposable domain (WAIT-04)', () => {
  it('mailchecker accepts the domain the concurrency suite uses for its fixtures', () => {
    // If this ever fails, waitlist.concurrency.test.ts starts failing for a reason
    // that has nothing to do with what it tests.
    expect(MailChecker.isValid('anyone@example.com')).toBe(true);
  });

  it('an address on a domain mailchecker rejects returns status:error with the invalid-email code and never calls the RPC spy', async () => {
    const disposableDomain = Array.from(MailChecker.blacklist())[0] as string;
    const email = `visitor@${disposableDomain}`;
    expect(MailChecker.isValid(email)).toBe(false);

    const result = await claimWaitlistSpot(initialState, buildFormData({ email }));
    expect(result.status).toBe('error');
    expect(result.code).toBe('invalid_email');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('claimWaitlistSpot — a plainly valid submission (baseline)', () => {
  it('reaches the RPC spy exactly once and returns code: null', async () => {
    const result = await claimWaitlistSpot(initialState, buildFormData());
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.code).toBeNull();
  });
});

describe('claimWaitlistSpot — honeypot and bot detection never disclose themselves (T-05-D2/T-05-S2)', () => {
  it('a non-empty honeypot field returns the neutral success state and never calls the RPC spy', async () => {
    const result = await claimWaitlistSpot(initialState, buildFormData({ website: 'https://spam.example' }));
    expect(result.status).toBe('success');
    expect(result.isFounder).toBe(false);
    expect(result.founderRank).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('a bot verdict from checkBotId returns the same neutral success state and never calls the RPC spy', async () => {
    checkBotIdMock.mockResolvedValue(IS_A_BOT);
    const result = await claimWaitlistSpot(initialState, buildFormData());
    expect(result.status).toBe('success');
    expect(result.isFounder).toBe(false);
    expect(result.founderRank).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('the honeypot response, the bot response, and a genuine non-founder response are deep-equal', async () => {
    const honeypotResult = await claimWaitlistSpot(initialState, buildFormData({ website: 'trap' }));

    checkBotIdMock.mockResolvedValue(IS_A_BOT);
    const botResult = await claimWaitlistSpot(initialState, buildFormData({ email: 'other@example.com' }));

    checkBotIdMock.mockResolvedValue(NOT_A_BOT);
    const genuineResult = await claimWaitlistSpot(initialState, buildFormData({ email: 'genuine@example.com' }));

    expect(honeypotResult).toEqual(botResult);
    expect(botResult).toEqual(genuineResult);
  });
});

describe('claimWaitlistSpot — rate limiting (T-05-D2/T-05-D3)', () => {
  it('a submission over budget returns status:error with the rate-limited code and never calls the RPC spy', async () => {
    waitlistLimitMock.mockResolvedValue(RATE_LIMIT_EXHAUSTED);
    const result = await claimWaitlistSpot(initialState, buildFormData());
    expect(result.status).toBe('error');
    expect(result.code).toBe('rate_limited');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('claimWaitlistSpot — code union coverage', () => {
  it('a successful submission returns code: null', async () => {
    const result = await claimWaitlistSpot(initialState, buildFormData());
    expect(result.code).toBeNull();
  });

  it('every declared error path returns a non-null code from the declared union', async () => {
    const invalidForm = buildFormData();
    invalidForm.delete('email');
    const invalidFormResult = await claimWaitlistSpot(initialState, invalidForm);
    expect(invalidFormResult.code).toBe('invalid_form');

    const invalidEmailResult = await claimWaitlistSpot(initialState, buildFormData({ email: 'not-an-email' }));
    expect(invalidEmailResult.code).toBe('invalid_email');

    waitlistLimitMock.mockResolvedValue(RATE_LIMIT_EXHAUSTED);
    const rateLimitedResult = await claimWaitlistSpot(initialState, buildFormData());
    expect(rateLimitedResult.code).toBe('rate_limited');
    waitlistLimitMock.mockResolvedValue(RATE_LIMIT_OK);

    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const serverErrorResult = await claimWaitlistSpot(initialState, buildFormData());
    expect(serverErrorResult.code).toBe('server_error');
  });
});
