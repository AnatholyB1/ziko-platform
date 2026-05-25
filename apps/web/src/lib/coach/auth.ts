'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * getCachedCoachUser — React cache()-wrapped auth + role check.
 *
 * React cache() deduplicates calls within a single request — the second caller
 * (e.g. a page component) gets the already-resolved promise at zero cost.
 * Each new request gets a fresh execution; no cross-request data leakage.
 *
 * Security note: DO NOT replace cache() with Next.js unstable_cache() here.
 * unstable_cache persists across requests and would allow a logged-out user
 * to receive a cached "logged in" result (T-36-01).
 */
export const getCachedCoachUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await getLocale();

  if (!user) {
    // ARCH-05 layer 2: server-side auth guard. No open-redirect — fixed target.
    redirect(`/${locale}/login`);
  }

  // D-03: non-coach user gets redirected to onboarding
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['coach', 'both'].includes(profile.role)) {
    redirect(`/${locale}/coach/onboarding`);
  }

  return { user, role: profile.role as string };
});

/**
 * getCachedAlertCount — React cache()-wrapped unread alert count.
 *
 * Calls getCachedCoachUser() internally — since getCachedCoachUser is also
 * React-cached, this second call resolves instantly from the cached promise
 * (T-36-02: role guard cannot be bypassed by calling this function first).
 */
export const getCachedAlertCount = cache(async () => {
  const { user } = await getCachedCoachUser();

  const supabase = await createServerSupabase();
  try {
    const { count } = await supabase
      .from('coach_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('is_read', false);
    return count ?? 0;
  } catch {
    return 0;
  }
});
