// Phase 5 plan 05-03 (T-05-06) — the only public door onto FOND-01..06. Every FOND
// requirement is arbitrated inside the founder-status RPC below; this route's whole
// job is to relay its verdict without adding, reading, or recomputing anything.
//
// Deliberately no `revalidate`/`dynamic`/`fetchCache`/`runtime` export. A `revalidate`
// export asks Next to evaluate this handler at build time, which would construct the
// service-role client during `next build` — an environment that may hold no
// service-role credentials, turning a missing env var into a failed build instead of
// a degraded counter. Caching is instead an explicit Cache-Control header on the
// response, which is what genuinely caches a Route Handler at the edge.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const SUCCESS_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';
const FALLBACK_CACHE_CONTROL = 'no-store';

function safeDefault() {
  return NextResponse.json(
    { shouldDisplay: false, remaining: null, isFull: false },
    { status: 200, headers: { 'Cache-Control': FALLBACK_CACHE_CONTROL } },
  );
}

export async function GET() {
  // Both waitlist RPCs were revoked from anon/authenticated and granted to
  // service_role only (see the migration's trailing comment on this function) — the
  // anon-key helper is not a weaker choice here, it is a permission error.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_waitlist_founder_status');

  if (error || !data || data.length === 0) {
    return safeDefault();
  }

  const row = data[0];

  return NextResponse.json(
    {
      shouldDisplay: row.should_display,
      remaining: row.remaining,
      isFull: row.is_full,
    },
    { status: 200, headers: { 'Cache-Control': SUCCESS_CACHE_CONTROL } },
  );
}
