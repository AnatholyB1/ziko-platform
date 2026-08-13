'use server';
// Deliberately NO `import { headers } from 'next/headers'` — rate limiting is phase 5's,
// and importing that module here would make this file unimportable in a plain Vitest
// process, breaking the concurrency proof this phase exists to deliver (01-RESEARCH.md Pitfall 3).
import { createAdminClient } from '@/lib/supabase/admin';

export type WaitlistState = {
  status: 'idle' | 'success' | 'error';
  isFounder: boolean;
  founderRank: number | null;
  message: string;
};

export async function claimWaitlistSpot(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const audience = formData.get('audience') as string | null;
  const locale = (formData.get('locale') as string | null) ?? null;

  if (!email || !audience) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Formulaire invalide.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_waitlist_signup', {
    p_email: email,
    p_audience: audience,
    p_locale: locale,
  });

  if (error || !data?.[0]) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Une erreur est survenue.' };
  }

  const row = data[0] as {
    is_new: boolean;
    is_founder: boolean;
    founder_rank: number | null;
  };

  // D-03/D-04 — the ONLY place this filtering may happen. Reading any other field
  // before this check reintroduces the founder-status oracle. A duplicate (is_new
  // === false) NEVER discloses founder status, regardless of what the RPC actually knows.
  if (!row.is_new) {
    return { status: 'success', isFounder: false, founderRank: null, message: 'Inscription confirmée.' };
  }

  return {
    status: 'success',
    isFounder: row.is_founder,
    founderRank: row.is_founder ? row.founder_rank : null,
    message: 'Inscription confirmée.',
  };
}
