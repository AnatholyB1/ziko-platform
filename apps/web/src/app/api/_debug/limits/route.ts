// PHASE 23 PRO PROBE — DELETE IN PHASE 24 (ARCH-08 evidence captured in 23-VERIFICATION.md; route has no production purpose).
// D-15: 30s sleep + maxDuration=60 — if response is 504 at 10s, project is on Hobby; 200 after 30s confirms Pro.
// Gated by process.env.DEBUG_LIMITS === 'on' — set on preview deploys ONLY, never production.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (process.env.DEBUG_LIMITS !== 'on') {
    return new Response('Not Found', { status: 404 });
  }
  await new Promise((r) => setTimeout(r, 30_000));
  return Response.json({ ok: true, tier: 'pro-confirmed', durationSec: 30 });
}
