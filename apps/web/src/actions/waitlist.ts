'use server';
// Deliberately NO static top-level import of Next's request-scoped headers module —
// rate limiting needs the caller's address, but a static import of that module would
// make this file unimportable in a plain Vitest process, breaking the concurrency proof
// this phase exists to protect (01-RESEARCH.md Pitfall 3). getClientAddress() below
// reaches it through a dynamic import, wrapped in try/catch, so the file stays importable
// with no request context and simply treats the address as unavailable in that case.
//
// Any suite importing this module in a plain Node process must mock `botid/server`
// (imported statically below, so `checkBotId()` is mockable and honest about the
// dependency) and `@/lib/ratelimit`'s `waitlistRatelimit` export, alongside the existing
// `server-only` mock the concurrency suite already installs.
import { z } from 'zod';
import MailChecker from 'mailchecker';
import { checkBotId } from 'botid/server';
import { waitlistRatelimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONSENT_VERSION } from '@/content/legal/founder-offer';

const UTM_MAX_LENGTH = 64;

// Truncated, null-normalized so an attacker-controlled query-string value is never
// stored whole and never stored as an empty string (T-05-T3).
function normalizeUtmValue(raw: string | null): string | null {
  const trimmed = (raw ?? '').trim().slice(0, UTM_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

export type WaitlistErrorCode = 'invalid_form' | 'invalid_email' | 'rate_limited' | 'server_error';

export type WaitlistState = {
  status: 'idle' | 'success' | 'error';
  isFounder: boolean;
  founderRank: number | null;
  message: string;
  code: WaitlistErrorCode | null;
};

const NEUTRAL_SUCCESS: WaitlistState = {
  status: 'success',
  isFounder: false,
  founderRank: null,
  message: 'Inscription confirmée.',
  code: null,
};

const emailSchema = z.email();

// Getting the caller's address requires a Next.js request-scoped module that cannot be
// imported at module scope here (see header comment). Outside a real request context
// (e.g. a plain Vitest process, or `botid`'s own local-dev bypass) the dynamic import or
// the `headers()` call itself throws — caught here and treated as "no address available"
// rather than a failure of the guard chain.
async function getClientAddress(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    const firstForwarded = forwardedFor?.split(',')[0]?.trim();
    if (firstForwarded) return firstForwarded;
    const realIp = headerList.get('x-real-ip');
    return realIp?.trim() || null;
  } catch {
    return null;
  }
}

export async function claimWaitlistSpot(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const audience = formData.get('audience') as string | null;
  const locale = (formData.get('locale') as string | null) ?? null;
  const honeypot = (formData.get('website') as string | null)?.trim() ?? '';
  const consent = formData.get('consent');
  const utmSource = normalizeUtmValue(formData.get('utm_source') as string | null);
  const utmCampaign = normalizeUtmValue(formData.get('utm_campaign') as string | null);

  // LEGAL-06 — consent is the stated legal basis for the whole processing; a row
  // written without it is a row that must not exist. Checked here, before any other
  // work, alongside the pre-existing empty-email/empty-audience check.
  if (!email || !audience || !consent) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Formulaire invalide.', code: 'invalid_form' };
  }

  // Honeypot — a trap that announces itself is a trap the next bot avoids. Neutral
  // success, no database write.
  if (honeypot !== '') {
    return { ...NEUTRAL_SUCCESS };
  }

  // Bot check — statically imported above so it is honest about the dependency and
  // mockable by both test suites; a lazily-imported check that throws would silently
  // disable itself in production with no signal.
  const botResult = await checkBotId();
  if (botResult.isBot) {
    return { ...NEUTRAL_SUCCESS };
  }

  // Rate limit — the two buckets catch different attacks: one source spraying many
  // addresses (limited by IP), and many sources hammering one address (limited by the
  // submitted address's lowercased form, always checked regardless of IP availability).
  const clientAddress = await getClientAddress();
  try {
    const rateLimitChecks = [waitlistRatelimit.limit(email.toLowerCase())];
    if (clientAddress) {
      rateLimitChecks.push(waitlistRatelimit.limit(clientAddress));
    }
    const rateLimitResults = await Promise.all(rateLimitChecks);
    if (rateLimitResults.some((result) => !result.success)) {
      return {
        status: 'error',
        isFounder: false,
        founderRank: null,
        message: 'Trop de tentatives. Merci de réessayer dans quelques minutes.',
        code: 'rate_limited',
      };
    }
  } catch (rateLimitError) {
    // Upstash unreachable (DNS/network) must never take down signup — rate limiting is a
    // protective layer, not a core dependency. Fail open and keep going.
    console.error('[waitlist] rate limit check failed, allowing request', rateLimitError);
  }

  // Syntax.
  if (!emailSchema.safeParse(email).success) {
    return {
      status: 'error',
      isFounder: false,
      founderRank: null,
      message: 'Cette adresse e-mail semble invalide ou temporaire.',
      code: 'invalid_email',
    };
  }

  // Disposable domain — deliberately the same code as a syntax failure. Telling a
  // visitor precisely which of the two tripped gives a spammer a free oracle over the
  // domain list and gives a legitimate visitor no useful extra information.
  if (!MailChecker.isValid(email)) {
    return {
      status: 'error',
      isFounder: false,
      founderRank: null,
      message: 'Cette adresse e-mail semble invalide ou temporaire.',
      code: 'invalid_email',
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_waitlist_signup', {
    p_email: email,
    p_audience: audience,
    p_locale: locale,
    p_utm_source: utmSource,
    p_utm_campaign: utmCampaign,
  });

  if (error || !data?.[0]) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Une erreur est survenue.', code: 'server_error' };
  }

  const row = data[0] as {
    is_new: boolean;
    is_founder: boolean;
    founder_rank: number | null;
  };

  // Consent write — runs unconditionally, for both a new signup and a duplicate, and
  // ahead of the disclosure filter below, so both paths perform the exact same sequence
  // of database calls (T-05-I4). Matched on the database's own normalized identity
  // (never a client-side lowercase) because a duplicate submitted with a Gmail
  // +suffix/dots variant maps to a row whose stored `email` is the original
  // submitter's spelling (05-RESEARCH.md Pattern 2, Pitfall 2). A failure here is
  // logged, never surfaced to the visitor — the signup itself already succeeded.
  try {
    const { data: normalizedEmail, error: normalizeError } = await admin.rpc('normalize_waitlist_email', {
      p_email: email,
    });
    if (normalizeError || typeof normalizedEmail !== 'string') {
      console.error('[waitlist] consent write skipped — email normalization RPC failed', normalizeError);
    } else {
      const { error: consentError } = await admin
        .from('waitlist_signups')
        .update({ consent_given_at: new Date().toISOString(), consent_version: CONSENT_VERSION })
        .eq('email_normalized', normalizedEmail)
        .is('anonymized_at', null);
      if (consentError) {
        console.error('[waitlist] consent write failed', consentError);
      }
    }
  } catch (consentWriteError) {
    console.error('[waitlist] consent write threw', consentWriteError);
  }

  // D-03/D-04 — the ONLY place this filtering may happen. Reading any other field
  // before this check reintroduces the founder-status oracle. A duplicate (is_new
  // === false) NEVER discloses founder status, regardless of what the RPC actually knows.
  if (!row.is_new) {
    return { status: 'success', isFounder: false, founderRank: null, message: 'Inscription confirmée.', code: null };
  }

  return {
    status: 'success',
    isFounder: row.is_founder,
    founderRank: row.is_founder ? row.founder_rank : null,
    message: 'Inscription confirmée.',
    code: null,
  };
}
