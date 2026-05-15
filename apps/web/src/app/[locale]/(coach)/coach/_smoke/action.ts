// PHASE 23 SMOKE — DELETE IN PHASE 24
// ARCH-05 layer 3: Server Action re-checks getUser() — defense-in-depth against TOCTOU
'use server';

import { createServerSupabase } from '@/lib/supabase/server';

export async function smokeReCheck() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, error: error?.message ?? 'no user' };
  }
  return { ok: true as const, userId: user.id, ts: new Date().toISOString() };
}
