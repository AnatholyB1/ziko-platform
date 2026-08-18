import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import * as creditService from '../services/creditService.js';

// Admin client — bypasses RLS for cron-specific admin queries
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const creditsCronRouter = new Hono();

// No auth middleware is applied — cron routes authenticate via CRON_SECRET
// Bearer header. A Vercel cron request carries no user JWT, so mounting
// this on the same router as routes/credits.ts (which requires a user
// session on every path) would 401 every scheduled run silently. See
// app.ts for the second '/credits' mount that keeps this router's scope
// separate.

/**
 * Verify that the request carries a valid CRON_SECRET.
 * Returns true when:
 *   - CRON_SECRET env var is not set (dev/local mode), OR
 *   - authHeader === `Bearer ${process.env.CRON_SECRET}`
 */
function verifyCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}

// ── CRED-03: monthly premium credit grant ─────────────────────────────────────

/**
 * GET /credits/cron/premium-grant
 * Triggered by Vercel Cron on the 1st of every month at 00:00 UTC.
 *
 * Walks every tier='premium' user and calls grantMonthlyPremiumCredits() for
 * each. Runs regardless of the CRED-05 activation flag's state — this route
 * is funding, not enforcement (D-02/D-03): if the grant only ran once
 * enforcement was live, the flag's flip would meet premium users holding
 * whatever balance they happened to have, and the first thing every one of
 * them would see is a 402. Running the grant while the flag is still off
 * pre-funds them; the month-scoped idempotency key makes the extra months
 * cost one ledger row each.
 *
 * One user's failure does not abort the run — a monthly job that stops at
 * the first bad row leaves the rest of the tier unfunded for a month with
 * nobody finding out until support tickets arrive. Counts are returned so a
 * single Vercel cron log line is enough to tell a healthy run from a
 * degraded one.
 */
creditsCronRouter.get('/cron/premium-grant', async (c) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { data: premiumUsers, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('tier', 'premium');

  if (error) {
    console.error('[CRON-premium-grant] Failed to query premium users:', error);
    return c.json({ error: error.message }, 500);
  }

  const users = (premiumUsers ?? []) as { id: string }[];

  let granted = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await creditService.grantMonthlyPremiumCredits(user.id);
      if (result.granted) {
        granted++;
      } else {
        // A falsy result normally means "already granted this month," not a
        // failure — grantMonthlyPremiumCredits's own docblock records this.
        skipped++;
      }
    } catch (err) {
      console.error('[CRON-premium-grant] grant failed for', user.id, err);
      failed++;
    }
  }

  return c.json({ granted, skipped, failed, total: users.length });
});

export { creditsCronRouter };
