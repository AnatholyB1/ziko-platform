const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/**
 * Fire-and-forget credit earn call to POST /credits/earn.
 * MUST NOT throw — activity save must succeed regardless of earn outcome (SC-3, D-10).
 *
 * @param supabase - Supabase client instance (for reading auth session)
 * @param source - Activity source: 'workout' | 'habit' | 'meal' | 'measurement' | 'stretch' | 'cardio'
 * @param idempotencyKey - Unique key preventing double-credit (record UUID or deterministic string)
 */
export async function callCreditsEarn(
  supabase: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } },
  source: string,
  idempotencyKey: string,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    fetch(`${API_URL}/credits/earn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ source, idempotency_key: idempotencyKey }),
    }).catch(() => {}); // Fire-and-forget: do not await fetch
  } catch {
    // Swallow all errors — earn must never block activity save
  }
}

/**
 * Awaitable credit earn call — returns { credited } for toast triggering.
 * Used by screens that want to show the earn toast (Phase 21, D-06).
 * Falls back to { credited: false } on any error — never throws.
 */
export async function callCreditsEarnWithResult(
  supabase: { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } },
  source: string,
  idempotencyKey: string,
): Promise<{ credited: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { credited: false };

    const res = await fetch(`${API_URL}/credits/earn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ source, idempotency_key: idempotencyKey }),
    });

    if (!res.ok) return { credited: false };
    const data = await res.json();
    return { credited: data.credited === true };
  } catch {
    return { credited: false };
  }
}
