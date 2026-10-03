import { supabase } from './supabase';

// ONBOARD-06: lazy retroactive-recompute trigger for pre-v1.18 athletes —
// mirrors the v1.4 lazy-daily-reset precedent (no cron, no one-time backfill
// script). Fired from authStore.refreshProfile() when a signed-in athlete has
// user_profiles.onboarding_done=true but no athlete_state row yet.
//
// Module-scoped in-flight guard: refreshProfile() runs on both the initial
// supabase.auth.getSession() resolution and the onAuthStateChange callback,
// so this can be invoked twice within milliseconds of app open. This guard
// prevents a duplicate POST from either race.
let recomputeInFlight = false;

/**
 * Fire-and-forget POST to /ai/onboarding/retroactive. Never throws to its
 * caller — network failures and non-2xx responses are swallowed after at
 * most one console.warn. Must not be awaited by callers that need to avoid
 * delaying app load (isLoading: false).
 */
export async function triggerRetroactiveRecompute(): Promise<void> {
  if (recomputeInFlight) return;
  recomputeInFlight = true;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/ai/onboarding/retroactive`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );

    if (!response.ok) {
      console.warn('triggerRetroactiveRecompute: non-2xx response', response.status);
    }
  } catch (error) {
    console.warn('triggerRetroactiveRecompute: request failed', error);
  } finally {
    recomputeInFlight = false;
  }
}
