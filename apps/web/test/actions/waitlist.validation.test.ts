// Phase 5 plan 05-02 — T-05-04 proves the guard chain (honeypot, bot check, rate
// limit, syntax, disposable domain) refuses/drops submissions before the RPC ever
// runs; T-05-05 extends the same file with the consent write and UTM forwarding.
// Entirely in a plain Vitest/Node process with no database. Mirrors the hoisted-mock
// convention `waitlist.concurrency.test.ts` already establishes for `server-only`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MailChecker from 'mailchecker';
import { CONSENT_VERSION } from '@/content/legal/founder-offer';

// The service-role admin client module imports 'server-only', whose default export
// throws outside a React Server Component. Vitest hoists this mock above the static
// imports below, so claimWaitlistSpot can be imported directly in a plain Node process.
vi.mock('server-only', () => ({}));

const { checkBotIdMock, rpcMock, waitlistLimitMock, updateMock, eqMock, isMock } = vi.hoisted(() => {
  const isMock = vi.fn(async (_column: string, _value: null) => ({ error: null as { message: string } | null }));
  const eqMock = vi.fn((_column: string, _value: string) => ({ is: isMock }));
  const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: eqMock }));
  return {
    checkBotIdMock: vi.fn(),
    rpcMock: vi.fn(),
    waitlistLimitMock: vi.fn(),
    updateMock,
    eqMock,
    isMock,
  };
});

// `botid/server` is imported statically at module scope in the action (deliberately —
// see the action's own header comment), so this suite mocks it the same way the
// concurrency suite mocks `server-only`.
vi.mock('botid/server', () => ({
  checkBotId: checkBotIdMock,
}));

vi.mock('@/lib/ratelimit', () => ({
  waitlistRatelimit: { limit: waitlistLimitMock },
}));

// A single `rpc` spy handles both `claim_waitlist_signup` and
// `normalize_waitlist_email` by name (see the default implementation in beforeEach
// below); `from('waitlist_signups').update(...).eq(...).is(...)` is a small chained
// mock proving the consent write's exact filter shape.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: () => ({ update: updateMock }),
  }),
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
const DUPLICATE_ROW = { is_new: false, is_founder: true, founder_rank: 12 };

const initialState = {
  status: 'idle' as const,
  isFounder: false,
  founderRank: null,
  message: '',
  code: null,
};

function buildFormData(
  fields: Partial<{
    email: string;
    audience: string;
    locale: string;
    website: string;
    consent: string;
    utmSource: string;
    utmCampaign: string;
  }> = {},
): FormData {
  const fd = new FormData();
  fd.set('email', fields.email ?? 'visitor@example.com');
  fd.set('audience', fields.audience ?? 'athlete');
  fd.set('locale', fields.locale ?? 'fr');
  if (fields.website !== undefined) fd.set('website', fields.website);
  // Consent defaults to present — production form always sends it once checked; the
  // dedicated "missing consent" test below deletes it explicitly.
  fd.set('consent', fields.consent ?? 'on');
  if (fields.utmSource !== undefined) fd.set('utm_source', fields.utmSource);
  if (fields.utmCampaign !== undefined) fd.set('utm_campaign', fields.utmCampaign);
  return fd;
}

// Name-aware default: `claim_waitlist_signup` returns a genuinely-new non-founder row;
// `normalize_waitlist_email` echoes the lowercased submitted address, mirroring the
// real RPC's normalization closely enough to prove the consent write reads its answer
// rather than re-deriving it.
function defaultRpcImplementation(name: string, params?: Record<string, unknown>) {
  if (name === 'claim_waitlist_signup') {
    return Promise.resolve({ data: [NEW_NON_FOUNDER_ROW], error: null });
  }
  if (name === 'normalize_waitlist_email') {
    const email = String((params as { p_email?: string } | undefined)?.p_email ?? '').toLowerCase();
    return Promise.resolve({ data: email, error: null });
  }
  return Promise.resolve({ data: null, error: { message: `unexpected rpc: ${name}` } });
}

beforeEach(() => {
  checkBotIdMock.mockReset().mockResolvedValue(NOT_A_BOT);
  waitlistLimitMock.mockReset().mockResolvedValue(RATE_LIMIT_OK);
  rpcMock.mockReset().mockImplementation(defaultRpcImplementation);
  updateMock.mockClear();
  eqMock.mockClear();
  isMock.mockClear().mockResolvedValue({ error: null });
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

  it('a submission with no consent field returns status:error with the invalid-form code and never calls the RPC spy', async () => {
    const fd = buildFormData();
    fd.delete('consent');
    const result = await claimWaitlistSpot(initialState, fd);
    expect(result.status).toBe('error');
    expect(result.code).toBe('invalid_form');
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
  it('reaches the claim RPC exactly once and returns code: null', async () => {
    const result = await claimWaitlistSpot(initialState, buildFormData());
    expect(rpcMock).toHaveBeenCalledWith('claim_waitlist_signup', expect.anything());
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

    rpcMock.mockImplementation((name: string) =>
      name === 'claim_waitlist_signup'
        ? Promise.resolve({ data: null, error: { message: 'boom' } })
        : defaultRpcImplementation(name),
    );
    const serverErrorResult = await claimWaitlistSpot(initialState, buildFormData());
    expect(serverErrorResult.code).toBe('server_error');
  });
});

describe('claimWaitlistSpot — consent write (LEGAL-06/07, T-05-R2, T-05-T2)', () => {
  it('a successful submission issues exactly one update carrying CONSENT_VERSION and a valid ISO consent_given_at', async () => {
    await claimWaitlistSpot(initialState, buildFormData());

    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0] as { consent_given_at: string; consent_version: string };
    expect(payload.consent_version).toBe(CONSENT_VERSION);
    expect(new Date(payload.consent_given_at).toISOString()).toBe(payload.consent_given_at);
  });

  it('the update payload carries no founder-state or address keys', async () => {
    await claimWaitlistSpot(initialState, buildFormData());

    const payload = updateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('is_founder');
    expect(payload).not.toHaveProperty('founder_rank');
    expect(payload).not.toHaveProperty('email');
  });

  it('the update is matched on the normalizer RPC answer, and the normalizer RPC was called with the submitted address', async () => {
    await claimWaitlistSpot(initialState, buildFormData({ email: 'Genuine.User+promo@Example.com' }));

    expect(rpcMock).toHaveBeenCalledWith('normalize_waitlist_email', { p_email: 'Genuine.User+promo@Example.com' });
    expect(eqMock).toHaveBeenCalledWith('email_normalized', 'genuine.user+promo@example.com');
    expect(isMock).toHaveBeenCalledWith('anonymized_at', null);
  });

  it('the consent write runs on the duplicate branch too, issuing the same database calls in the same order', async () => {
    rpcMock.mockImplementation((name: string, params?: Record<string, unknown>) =>
      name === 'claim_waitlist_signup'
        ? Promise.resolve({ data: [DUPLICATE_ROW], error: null })
        : defaultRpcImplementation(name, params),
    );

    const result = await claimWaitlistSpot(initialState, buildFormData({ email: 'already-registered@example.com' }));

    // D-03/D-04 non-disclosure still holds — a duplicate never reports founder status.
    expect(result.isFounder).toBe(false);
    expect(result.founderRank).toBeNull();

    // Same call sequence as the new-signup case: claim, then normalize, then update.
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'claim_waitlist_signup', expect.anything());
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'normalize_waitlist_email', expect.anything());
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});

describe('claimWaitlistSpot — UTM forwarding (ENTRY-06)', () => {
  it('forwards utm_source and utm_campaign present in the form to the claim RPC', async () => {
    await claimWaitlistSpot(initialState, buildFormData({ utmSource: 'newsletter', utmCampaign: 'launch-week' }));

    expect(rpcMock).toHaveBeenCalledWith(
      'claim_waitlist_signup',
      expect.objectContaining({ p_utm_source: 'newsletter', p_utm_campaign: 'launch-week' }),
    );
  });

  it('forwards absent UTM values as null rather than empty strings', async () => {
    await claimWaitlistSpot(initialState, buildFormData());

    expect(rpcMock).toHaveBeenCalledWith(
      'claim_waitlist_signup',
      expect.objectContaining({ p_utm_source: null, p_utm_campaign: null }),
    );
  });

  it('truncates an over-long UTM value rather than passing it through whole', async () => {
    const overLong = 'x'.repeat(200);
    await claimWaitlistSpot(initialState, buildFormData({ utmSource: overLong }));

    const call = rpcMock.mock.calls.find(([name]) => name === 'claim_waitlist_signup');
    const params = call?.[1] as { p_utm_source: string };
    expect(params.p_utm_source.length).toBe(64);
    expect(params.p_utm_source).toBe(overLong.slice(0, 64));
  });
});
