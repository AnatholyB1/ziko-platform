// Phase 44 (v1.18, weekly-adaptive-decision-engine) plan 44-05 —
// coaching-engine module: the two triggers that funnel into the single
// shared write path (ENGINE-06's runWeeklyReview, plan 44-04).
//
//   GET  /review-check       — D-01 primary: lazy on-app-open trigger,
//                               fire-and-forget via waitUntil(), never
//                               blocks the response on the review.
//   POST /cron/weekly-review — D-01 secondary: Sunday safety-net cron,
//                               CRON_SECRET-guarded, reaches athletes who
//                               never open the app.
//
// Not dependent on Vercel Fluid Compute — its enablement on this project is
// unverified (44-RESEARCH.md assumption A4). maxDuration = 60 matches the
// three existing inline precedents in this backend (coach/voice/service.ts,
// coach/imports/service.ts, coach/videos/service.ts) and needs no
// `functions` block in vercel.json.
export const maxDuration = 60;

import { Hono } from 'hono';
import { waitUntil } from '@vercel/functions';
import { authMiddleware } from '../middleware/auth.js';
import { runWeeklyReview } from './apply.js';
import { clientForUser } from './db.js';

// ── Batch tuning, derived from the 60s function budget ─────────────────────
// Each athlete costs one generateObject call at roughly 1-3s, so 40
// sequential athletes could exceed the ceiling; chunking at 8-way
// concurrency keeps the worst case (40 athletes / 8 concurrent = 5 chunks
// * ~3s) comfortably under 60s while still bounding total in-flight model
// calls. Both numbers are named constants here so they are the one place to
// tune as athlete volume grows.
const CRON_BATCH_SIZE = 40; // eligibility scan cap — applied below as .limit(40)
const CRON_CONCURRENCY = 8;

interface DueAthleteRow {
  user_id: string;
}

const router = new Hono();

// POST /cron/weekly-review MUST be defined BEFORE router.use('*', authMiddleware)
// — Vercel cron does not send a user JWT, and a cron guarded after
// authMiddleware (or left unguarded) would let anyone fabricate weekly
// decisions and, downstream in Phase 45, rewards (T-44-21). The CRON_SECRET
// bearer check below is copied verbatim in shape from the live
// coach/ai/service.ts monitor-cron guard.
router.post('/cron/weekly-review', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = clientForUser();

  // Eligibility scan: due athletes not currently paused, oldest-due first,
  // capped at CRON_BATCH_SIZE. Athletes beyond the cap are deliberately left
  // for the next trigger — next_review_due_at stays in the past, so they
  // are picked up by their own next app open (the primary lazy trigger) or
  // the following Sunday's cron. Catch-up latency, not data loss.
  const nowIso = new Date(Date()).toISOString();
  const { data } = await db
    .from('athlete_state')
    .select('user_id')
    .not('next_review_due_at', 'is', null)
    .lte('next_review_due_at', nowIso)
    .neq('status', 'paused')
    .order('next_review_due_at', { ascending: true })
    .limit(CRON_BATCH_SIZE);

  const dueAthletes = (data ?? []) as DueAthleteRow[];

  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  // Chunked Promise.allSettled — never a sequential per-athlete for loop
  // with an LLM call in its body. monitor-cron's sequential loop is safe
  // only because it makes zero model calls; this loop makes one
  // generateObject call per athlete, so 40 sequential athletes would blow
  // the 60s ceiling (T-44-23).
  for (let i = 0; i < dueAthletes.length; i += CRON_CONCURRENCY) {
    const chunk = dueAthletes.slice(i, i + CRON_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((row) => runWeeklyReview(row.user_id, 'weekly_review_cron')),
    );

    for (const result of results) {
      processed += 1;
      // A single athlete's failure never aborts the batch — counted as
      // `failed` and the loop continues (T-44-25).
      if (result.status === 'rejected') {
        failed += 1;
        console.error('[CoachingEngine] weekly-review cron athlete failure:', result.reason);
        continue;
      }

      const value = result.value;
      if (!value.ran) {
        skipped += 1;
      } else if (value.success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }
  }

  // Counts only — never athlete ids, never decision content (T-44-24).
  return c.json({ processed, succeeded, skipped, failed });
});

// All routes below require athlete auth.
router.use('*', authMiddleware);

// GET /review-check — D-01 primary lazy trigger. Bare auth is sufficient
// (44-RESEARCH.md Open Question 3); no request body or query parameter
// required. The due-check itself stays inside runWeeklyReview, which
// returns { ran: false, reason: 'not_due' } cheaply before any model call
// (T-44-22) — this route is a thin dispatcher with no duplicated due logic.
router.get('/review-check', async (c) => {
  const { userId } = c.get('auth');
  const authHeader = c.req.header('Authorization');
  const userToken = authHeader ? authHeader.slice(7) : undefined;

  // Fire-and-forget: the review runs in the background and must never
  // delay or fail this response. An unhandled rejection inside waitUntil()
  // must never surface as a 500 on this fire-and-forget endpoint (T-44-26)
  // — the .catch here converts a review failure into a logged line, and the
  // athlete stays due (retried on the next trigger) rather than a false
  // 500 reaching the client.
  waitUntil(
    (async () => {
      await runWeeklyReview(userId, 'app_open_fallback', userToken);
    })().catch((err: unknown) => {
      console.error('[CoachingEngine] review-check background failure:', err);
    }),
  );

  return c.json({ ok: true });
});

export { router as coachingEngineRouter };
