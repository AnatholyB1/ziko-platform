# Phase 4: Cron / Scheduled Notifications — Research

**Researched:** 2026-05-28
**Domain:** Vercel Cron + Hono + Supabase (PostgreSQL streak SQL) + expo-server-sdk receipt polling
**Confidence:** HIGH

---

## Summary

Phase 4 adds three Vercel cron jobs to the existing Hono API. The delivery infrastructure (notificationService.ts, notification_tokens, notification_log, notification_preferences) is production-ready from Phase 1. The cron plumbing pattern is established by supplements.ts and forms.ts. Nothing new needs to be installed.

The three jobs have distinct complexity profiles. CRON-02 (receipt polling) is the simplest — it calls an already-implemented `processReceipts()` function with IDs fetched from a single indexed query. CRON-03 (weekly digest) requires a multi-table aggregate but is straightforward SQL. CRON-01 (streak-at-risk) requires the most thought: computing per-user consecutive-day streaks across all users in a single query, then filtering by "no log today."

The key architectural decision is **where to add the cron routes**. The existing `notificationsRouter` in `notifications.ts` is protected by `authMiddleware` at the top level (`notificationsRouter.use('*', authMiddleware)`). Cron routes cannot use JWT auth — they use CRON_SECRET Bearer auth. The correct pattern, established by `forms.ts` (exports `formsRouter` + `formsCronRouter`), is to create a **separate `notificationsCronRouter`** and mount it independently in `app.ts`. This avoids touching the existing auth-protected router.

**Primary recommendation:** Create `backend/api/src/routes/notifications-cron.ts` exporting `notificationsCronRouter`. Mount it at `/notifications` in `app.ts`. Add three vercel.json cron entries.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRON-01 | Daily 21:00 UTC cron: detect users with habit streak ≥ 3 AND no habit_log today → send one push per user | Streak SQL pattern documented below; `notificationService.sendBatch()` handles multi-user send; idempotency key: `streak_at_risk_{userId}_{today}` |
| CRON-02 | Every 15 min: process Expo Push receipts → mark DeviceNotRegistered tokens `is_active=false` | `processReceipts()` already implemented; query is `notification_log WHERE status='sent' AND receipt_ids IS NOT NULL`; 300-receipt chunk limit from expo-server-sdk constants |
| CRON-03 | Weekly Sunday 09:00 UTC: opt-in weekly digest (sessions count, XP earned, current streak) | `type_prefs->>'weekly_xp_digest'` defaults `false` in schema; data from `workout_sessions`, `xp_transactions`, `user_gamification`; week = last 7 days UTC |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cron trigger | Vercel Cron scheduler | — | Vercel Cron sends GET with CRON_SECRET Bearer header to Hono endpoint |
| Streak computation | API / Backend (SQL query) | — | Cross-user query requires admin client; never computed on device |
| Receipt polling | API / Backend | — | expo-server-sdk call is server-only; receipts are returned to the sender |
| Weekly data aggregation | API / Backend (SQL) | — | Joins across user_gamification, workout_sessions, xp_transactions |
| Push send | API / Backend (notificationService.ts) | — | Existing service handles token fetch, preference check, Expo send, log write |
| Dead token cleanup | API / Backend | — | is_active flag update is an admin-client write, bypasses RLS |

---

## Standard Stack

### Core (already installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-server-sdk | ^6.1.0 | `chunkPushNotificationReceiptIds()`, `getPushNotificationReceiptsAsync()` | Already installed; receipt chunk limit = 300 [VERIFIED: codebase] |
| @supabase/supabase-js | existing | Admin client for cross-user queries | Already instantiated in notificationService.ts |
| hono | existing | Cron route handler | Established pattern in supplements.ts, storage.ts, forms.ts |

**No new packages.** All dependencies are already present in `backend/api/package.json`.

### expo-server-sdk Chunk Limits [VERIFIED: codebase grep of ExpoClientValues.js]

```
pushNotificationChunkLimit = 100          // messages per send call
pushNotificationReceiptChunkLimit = 300   // receipt IDs per getPushNotificationReceipts call
defaultConcurrentRequestLimit = 6
```

---

## Package Legitimacy Audit

No new packages are installed in this phase. All code uses existing dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Vercel Cron Scheduler
  │
  ├── GET /notifications/cron/streak-at-risk  (0 21 * * *)
  │       │
  │       ├── SQL: SELECT users with streak ≥ 3 AND no habit_log today
  │       └── notificationService.sendBatch(payloads[])
  │
  ├── GET /notifications/cron/check-receipts  (*/15 * * * *)
  │       │
  │       ├── SQL: SELECT receipt_ids FROM notification_log WHERE status='sent'
  │       └── notificationService.processReceipts(allReceiptIds[])
  │               └── UPDATE notification_tokens SET is_active=false  (DeviceNotRegistered)
  │
  └── GET /notifications/cron/weekly-digest   (0 9 * * 0)
          │
          ├── SQL: SELECT users WHERE type_prefs->>'weekly_xp_digest' = 'true'
          ├── SQL per user: COUNT workout_sessions, SUM xp_transactions, current_streak
          └── notificationService.sendBatch(payloads[])

All three routes → notificationsCronRouter → app.ts (/notifications mount)
CRON_SECRET Bearer auth on all three (no JWT / no authMiddleware)
```

### Recommended Project Structure

```
backend/api/src/routes/
├── notifications.ts           # existing — auth-protected token registration
└── notifications-cron.ts      # NEW — CRON_SECRET-protected scheduled jobs
```

### Pattern 1: Separate Cron Router (established by forms.ts)

**What:** Export two routers from the same file or a separate file; mount both in `app.ts` under the same path prefix. The cron router skips `authMiddleware` and validates `CRON_SECRET` directly.

**When to use:** Any time a router needs both JWT-authenticated routes AND cron-triggered routes at the same path prefix.

**Example (from forms.ts, [VERIFIED: codebase]):**
```typescript
// forms.ts
const cronRouter = new Hono();
cronRouter.get('/cron/trigger-fixed-date', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // ... cron logic
});
export { router as formsRouter, cronRouter as formsCronRouter };

// app.ts
app.route('/forms', formsRouter);
app.route('/forms', formsCronRouter);
```

**Note on auth header discrepancy:** `supplements.ts` and `storage.ts` use `c.req.header('authorization')` (Vercel's standard `Authorization: Bearer $CRON_SECRET`). `forms.ts` uses `c.req.header('x-cron-secret')` (non-standard). **Use the `Authorization: Bearer` pattern** — it matches how Vercel actually sends the header per Vercel Cron documentation, and is already used by supplements.ts and storage.ts (two existing working crons). [ASSUMED: Vercel sends `Authorization: Bearer $CRON_SECRET` — consistent with supplements.ts/storage.ts which are working crons in this project]

```typescript
// notifications-cron.ts — canonical pattern
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { notificationService } from '../services/notificationService.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const notificationsCronRouter = new Hono();

function verifyCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;
  return !cronSecret || authHeader === `Bearer ${cronSecret}`;
}
```

### Pattern 2: CRON-01 Streak-at-Risk SQL

**What:** Find all users who have at least one habit with a streak of 3+ consecutive days ending yesterday, AND have not logged that habit today.

**Streak definition in this codebase:** `habit_logs` stores one row per `(habit_id, date)` with `UNIQUE(habit_id, date)`. There is no pre-computed streak column. The cron must derive streak from the log.

**Efficient cross-user approach:** Use a CTE with `LAG`-based gap detection or a simpler "count consecutive days ending yesterday" approach. The simplest production-safe query for a cron (runs once/day, not on hot path):

```sql
-- Step 1: Find habits with streak ≥ 3 consecutive days ending yesterday or today
-- Step 2: Filter to those NOT logged today
-- Step 3: Deduplicate to one row per user

WITH today AS (SELECT CURRENT_DATE AS d),
     yesterday AS (SELECT CURRENT_DATE - 1 AS d),

-- For each habit, find the longest consecutive run ending on or before today
streak_data AS (
  SELECT
    hl.user_id,
    hl.habit_id,
    hl.date,
    -- Gap: is the previous log the day before?
    date - LAG(date) OVER (PARTITION BY habit_id ORDER BY date) AS gap
  FROM habit_logs hl
  WHERE hl.date >= CURRENT_DATE - 30  -- only look back 30 days (performance bound)
),

-- Group consecutive runs by habit
run_groups AS (
  SELECT
    user_id,
    habit_id,
    date,
    SUM(CASE WHEN gap IS NULL OR gap > 1 THEN 1 ELSE 0 END)
      OVER (PARTITION BY habit_id ORDER BY date) AS run_id
  FROM streak_data
),

-- Count run length for each group, take the most recent run
run_lengths AS (
  SELECT
    user_id,
    habit_id,
    MAX(date) AS run_end,
    COUNT(*) AS streak_length
  FROM run_groups
  GROUP BY user_id, habit_id, run_id
),

-- Habits with streak ≥ 3 whose run ends yesterday (still active through yesterday)
at_risk_habits AS (
  SELECT DISTINCT rl.user_id, rl.habit_id
  FROM run_lengths rl, yesterday y
  WHERE rl.streak_length >= 3
    AND rl.run_end = y.d  -- streak was intact through yesterday
),

-- Exclude habits already logged today
not_logged_today AS (
  SELECT ar.user_id
  FROM at_risk_habits ar, today t
  WHERE NOT EXISTS (
    SELECT 1 FROM habit_logs hl
    WHERE hl.habit_id = ar.habit_id AND hl.date = t.d
  )
)

SELECT DISTINCT user_id FROM not_logged_today;
```

**Alternative simpler approach (good enough for most cases):** Query users who logged a habit yesterday but not today, where the habit has been logged for at least 3 of the last 7 days. This avoids window functions and is more readable:

```sql
SELECT DISTINCT hl_yesterday.user_id
FROM habit_logs hl_yesterday
WHERE hl_yesterday.date = CURRENT_DATE - 1
  AND NOT EXISTS (
    SELECT 1 FROM habit_logs hl_today
    WHERE hl_today.user_id = hl_yesterday.user_id
      AND hl_today.date = CURRENT_DATE
  )
  AND (
    SELECT COUNT(DISTINCT date)
    FROM habit_logs hl_count
    WHERE hl_count.user_id = hl_yesterday.user_id
      AND hl_count.date >= CURRENT_DATE - 7
  ) >= 3;
```

**Planner note:** The first (window function) approach is more correct per the requirement ("streak ≥ 3 consecutive days"). The second is simpler but slightly looser ("logged on 3 of the last 7 days"). Choose the window function approach for correctness. Both are safe to execute as an admin query — `idx_habit_logs_user_date` on `(user_id, date DESC)` covers the lookback range.

**Should the cron filter to habits-plugin users only?** [ASSUMED] Yes — only users who have the habits plugin installed (`user_plugins WHERE plugin_id = 'habits' AND is_enabled = true`) should receive the streak-at-risk push. Users without the habits plugin have no habits to streak on. Add an INNER JOIN on `user_plugins` to the final select.

### Pattern 3: CRON-02 Receipt Polling

**What:** Query `notification_log` for rows with `status = 'sent'` and non-empty `receipt_ids`, collect all receipt IDs, pass to `processReceipts()`.

**Key constraint:** Receipts expire on Expo's side after ~24 hours. Only poll rows where `sent_at > NOW() - INTERVAL '24 hours'` to avoid querying stale IDs.

**DeviceNotRegistered gap:** `processReceipts()` currently marks `notification_log.status = 'failed'` with `error_code = 'DeviceNotRegistered'` but does NOT update `notification_tokens.is_active = false`. This is because Expo receipt responses do not include the token that caused the error — only the receipt ID. The token-to-receipt mapping was lost after the send step. The existing `notificationService.send()` Step 5 handles token deactivation at send time (via format validation), but that only catches malformed tokens, not remotely-unregistered ones.

**Resolution:** For CRON-02, after calling `processReceipts()`, query `notification_log WHERE error_code = 'DeviceNotRegistered' AND status = 'failed'` to find affected users, then deactivate all their tokens. This is imprecise (deactivates all tokens for the user, not just the bad one) but safe — tokens re-activate on next app launch via `POST /notifications/token` UPSERT. This is the correct behavior per CRON-02's requirement: "marks DeviceNotRegistered tokens as `is_active = false`."

```typescript
// After processReceipts():
const { data: failedRows } = await supabaseAdmin
  .from('notification_log')
  .select('user_id')
  .eq('error_code', 'DeviceNotRegistered')
  .eq('status', 'failed')
  .gt('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

const affectedUserIds = [...new Set((failedRows ?? []).map(r => r.user_id))];

for (const userId of affectedUserIds) {
  await supabaseAdmin
    .from('notification_tokens')
    .update({ is_active: false })
    .eq('user_id', userId);
}
```

**Note:** This runs after every 15-min poll cycle. The query re-scans the last 24h of failed rows each time. Acceptable for current scale. Add a `processed_receipt_cleanup_at` flag if the table grows large enough to warrant it (not needed for v1.11).

### Pattern 4: CRON-03 Weekly Digest

**Opt-in check:** `notification_preferences.type_prefs ->> 'weekly_xp_digest'` — the schema default is `false`. Only users who have explicitly enabled this will have it `true`. The query must cast the JSONB text value:

```sql
SELECT up.user_id
FROM notification_preferences np
WHERE (np.type_prefs ->> 'weekly_xp_digest')::boolean = true
  AND np.push_enabled = true;
```

**Data to aggregate per user (last 7 days):**

| Data point | Table | Column | Query |
|-----------|-------|--------|-------|
| Sessions this week | `workout_sessions` | COUNT(*) WHERE `ended_at IS NOT NULL AND started_at >= NOW() - 7 days` | Per user |
| XP earned this week | `xp_transactions` | SUM(amount) WHERE `created_at >= NOW() - 7 days` | Per user |
| Current streak | `user_gamification` | `current_streak` | Direct field |

**Week boundary:** Use "last 7 days" (rolling window from NOW() - INTERVAL '7 days') rather than a Sunday–Saturday calendar week. Simpler and consistent across timezones. [ASSUMED: rolling 7-day window is simpler and sufficient for v1.11]

**Message format example:**
```
Title: "Votre semaine en un coup d'œil 💪"
Body:  "3 séances · +450 XP · Série de 5 jours 🔥"
```

**type for notification_log:** `'weekly_digest'` — consistent with `type_prefs` key `weekly_xp_digest`.
**category:** `'health'` — matches the health_enabled column in notification_preferences.

**Idempotency key:** `weekly_digest_{userId}_{sunday_date}` where `sunday_date` is the ISO date of the Sunday that triggered the cron (CURRENT_DATE at time of run). This prevents duplicate digests if the cron fires twice.

### Pattern 5: vercel.json cron entries

**Three new entries to add:**

```json
{
  "path": "/notifications/cron/streak-at-risk",
  "schedule": "0 21 * * *"
},
{
  "path": "/notifications/cron/check-receipts",
  "schedule": "*/15 * * * *"
},
{
  "path": "/notifications/cron/weekly-digest",
  "schedule": "0 9 * * 0"
}
```

**Note:** `*/15 * * * *` (every 15 minutes) requires Vercel Pro plan. Vercel Hobby allows minimum 1-hour intervals. If the project is on Hobby, the receipt check must fall back to hourly: `0 * * * *`. [ASSUMED: the project has Vercel Pro — confirmed by presence of `@vercel/functions ^3.6.0` and 4 existing cron entries including daily jobs, but the plan tier is not directly visible in vercel.json]

**Planner decision needed:** Verify Vercel plan tier. If Hobby, change receipt-check schedule to `0 * * * *` (hourly).

### Anti-Patterns to Avoid

- **Mount cron routes on notificationsRouter:** It applies `authMiddleware` to `'*'` — cron requests have no JWT and will get 401. Always use a separate router.
- **Call processReceipts() without an age bound:** Expo receipts expire after 24h. Without `sent_at > NOW() - 24h` filter, the query grows unbounded.
- **Use `x-cron-secret` header:** Use `authorization` (Vercel's actual header). The `forms.ts` route uses `x-cron-secret` which is a deviation — supplements.ts and storage.ts use `authorization` and those are confirmed working cron routes in this project.
- **Send weekly digest to all users:** Only users with `type_prefs->>'weekly_xp_digest' = 'true'` AND `push_enabled = true`.
- **Use `notification_log` category `'system'` for cron pushes:** Streak-at-risk is `'health'`; weekly digest is `'health'`; receipt cleanup has no push (it's maintenance only).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message chunking for bulk send | Custom batching loop | `notificationService.sendBatch()` | Already handles idempotency, preference check, token fetch, log write |
| Receipt ID chunking | Manual array slicing | `expo.chunkPushNotificationReceiptIds()` | Chunk limit = 300, built into expo-server-sdk |
| Streak computation | Custom JS loop over habit_logs | PostgreSQL window function (LAG/SUM) in single query | JS loop would require fetching all rows; SQL runs in-database |
| Duplicate digest prevention | Manual DB check before send | idempotency_key UNIQUE constraint already in notification_log | ON CONFLICT returns null → notificationService.send() returns {sent:false, reason:'duplicate'} |

---

## Common Pitfalls

### Pitfall 1: Cron Routes Behind authMiddleware
**What goes wrong:** Cron returns 401 on every trigger because Vercel sends no JWT.
**Why it happens:** `notificationsRouter.use('*', authMiddleware)` applies to all sub-routes.
**How to avoid:** Use a separate `notificationsCronRouter = new Hono()` with no middleware, validate CRON_SECRET manually in each handler.
**Warning signs:** Vercel cron log shows 401 on first test.

### Pitfall 2: Receipt IDs Grow Without Age Bound
**What goes wrong:** Receipt polling query returns thousands of IDs from weeks ago; Expo returns "receipt not found" for expired IDs, causing needless API calls.
**Why it happens:** `notification_log` accumulates rows; without `sent_at > NOW() - 24h`, all historical `status='sent'` rows are included.
**How to avoid:** Always filter `sent_at > NOW() - INTERVAL '24 hours'` in the receipt polling query.
**Warning signs:** Receipt polling API call count grows linearly with notification volume over time.

### Pitfall 3: DeviceNotRegistered Not Propagated to notification_tokens
**What goes wrong:** Dead tokens are never deactivated; Expo rejects them on every subsequent send, wasting quota and log entries.
**Why it happens:** `processReceipts()` marks the log as failed but does not update `notification_tokens.is_active`. Expo receipts don't include the token value.
**How to avoid:** After `processReceipts()`, query `notification_log WHERE error_code='DeviceNotRegistered'` and set `notification_tokens.is_active=false` for all tokens belonging to the affected user_ids (as documented in Pattern 3 above).
**Warning signs:** Same user keeps getting `DeviceNotRegistered` errors across multiple send attempts.

### Pitfall 4: Weekly Digest Sent to All Users
**What goes wrong:** Users who never opted in receive the digest; high unsubscribe/disable rate.
**Why it happens:** Forgetting to filter `type_prefs->>'weekly_xp_digest' = 'true'`.
**How to avoid:** Query `notification_preferences WHERE (type_prefs->>'weekly_xp_digest')::boolean = true AND push_enabled = true` as the first step. Default in schema is `false` — no cast bugs.
**Warning signs:** 0 opted-in users in staging (expected — defaults are false), mass push in production.

### Pitfall 5: Streak SQL Returns Non-Consecutive "Streaks"
**What goes wrong:** Users who logged 3 days sporadically over 30 days get streak-at-risk pushes even though they have no real streak.
**Why it happens:** Using COUNT > 3 instead of consecutive-day detection.
**How to avoid:** Use the LAG-based window function approach that groups consecutive runs. A simpler COUNT approach is intentionally weaker.
**Warning signs:** Users receiving streak pushes report "I didn't even have a streak."

### Pitfall 6: Vercel Hobby Plan Rejects 15-Minute Cron
**What goes wrong:** `*/15 * * * *` schedule is rejected at deploy time or silently ignored.
**Why it happens:** Vercel Hobby minimum cron interval is 1 hour; Pro minimum is 1 minute.
**How to avoid:** Confirm plan tier before deployment. Fallback: `0 * * * *` (hourly) — still catches 24-hour receipt expiry window.
**Warning signs:** Vercel deploy error on cron schedule validation.

---

## Code Examples

### CRON-02 — Receipt Polling Core Logic
```typescript
// Source: notificationService.ts processReceipts() + new token cleanup step
notificationsCronRouter.get('/cron/check-receipts', async (c) => {
  const authHeader = c.req.header('authorization');
  if (!verifyCronSecret(authHeader)) return c.json({ error: 'Unauthorized' }, 401);

  // Query only recent sent rows (receipts expire after 24h on Expo)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: logRows } = await supabaseAdmin
    .from('notification_log')
    .select('receipt_ids')
    .eq('status', 'sent')
    .not('receipt_ids', 'is', null)
    .gt('sent_at', cutoff);

  const allReceiptIds = (logRows ?? []).flatMap(r => r.receipt_ids ?? []);

  if (allReceiptIds.length === 0) {
    return c.json({ checked: 0 });
  }

  await notificationService.processReceipts(allReceiptIds);

  // Deactivate tokens for DeviceNotRegistered failures
  const { data: failedRows } = await supabaseAdmin
    .from('notification_log')
    .select('user_id')
    .eq('error_code', 'DeviceNotRegistered')
    .eq('status', 'failed')
    .gt('sent_at', cutoff);

  const affectedUserIds = [...new Set((failedRows ?? []).map((r: { user_id: string }) => r.user_id))];
  for (const userId of affectedUserIds) {
    await supabaseAdmin
      .from('notification_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);
  }

  return c.json({ checked: allReceiptIds.length, deactivated_users: affectedUserIds.length });
});
```

### vercel.json cron entries to add
```json
{
  "path": "/notifications/cron/streak-at-risk",
  "schedule": "0 21 * * *"
},
{
  "path": "/notifications/cron/check-receipts",
  "schedule": "*/15 * * * *"
},
{
  "path": "/notifications/cron/weekly-digest",
  "schedule": "0 9 * * 0"
}
```

### app.ts registration
```typescript
// notifications-cron.ts
import { notificationsCronRouter } from './routes/notifications-cron.js';

// In app.ts, after existing notificationsRouter mount:
app.route('/notifications', notificationsRouter);       // existing — JWT auth
app.route('/notifications', notificationsCronRouter);   // new — CRON_SECRET auth
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel sends `Authorization: Bearer $CRON_SECRET` header (not `x-cron-secret`) | Architecture Patterns — Pattern 1 | Cron auth fails silently. Supplements.ts and storage.ts use `authorization` and are working crons in this project, so risk is low. |
| A2 | The project has Vercel Pro plan (allows `*/15` schedule) | Architecture Patterns — Pattern 5 | Cron deploy error; fallback to `0 * * * *` (hourly) |
| A3 | Streak-at-risk push should only target users with habits plugin installed | Architecture Patterns — Pattern 2 | Without filter: users with no habits get spurious push. With filter: correct behavior. Low risk to add the JOIN. |
| A4 | Week boundary for digest = rolling 7 days (not Sunday–Saturday calendar week) | Architecture Patterns — Pattern 4 | Digest covers slightly different window than user expects. Acceptable for v1.11. |
| A5 | Deactivating ALL tokens for a user on DeviceNotRegistered (vs. only the specific bad token) | Architecture Patterns — Pattern 3 | A user with 2 devices has both tokens deactivated; they re-register on next app open. Acceptable UX trade-off. |

---

## Open Questions

1. **Vercel Plan Tier**
   - What we know: vercel.json has 4 existing cron entries, `@vercel/functions ^3.6.0` installed
   - What's unclear: whether the account is on Hobby (1h minimum) or Pro (1min minimum)
   - Recommendation: Planner should add a verification note — check Vercel dashboard. If Hobby, set receipt-check to `0 * * * *`.

2. **Streak SQL — consecutive vs. 3-of-7**
   - What we know: requirement says "streak ≥ 3 jours" (consecutive implied by "streak" semantics)
   - What's unclear: whether strict consecutive-day detection is needed or whether a looser count is acceptable
   - Recommendation: Use the strict window-function approach. It matches the streak concept already shown in `user_gamification.current_streak`.

3. **habits plugin filter for CRON-01**
   - What we know: `user_plugins(user_id, plugin_id, is_enabled)` exists with UNIQUE(user_id, plugin_id)
   - What's unclear: whether users without the habits plugin could have habit_logs entries (they could if they were installed previously and then uninstalled)
   - Recommendation: Filter on `user_plugins WHERE plugin_id='habits' AND is_enabled=true` to avoid notifying users who have disabled the plugin.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-server-sdk | CRON-02 receipt polling | ✓ | ^6.1.0 | — |
| SUPABASE_SERVICE_KEY env var | All cron routes (admin client) | ✓ | — | None — required |
| CRON_SECRET env var | All cron routes (auth) | ✓ | — | Cron runs unprotected (unacceptable) |
| Vercel Pro plan | CRON-02 (15-min schedule) | [ASSUMED] | — | Hourly schedule on Hobby |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** Vercel Hobby → change `*/15` to `0 *` for receipt check

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript type-check only (no test runner detected in backend/) |
| Config file | `backend/api/tsconfig.json` |
| Quick run command | `cd backend/api && npm run type-check` |
| Full suite command | `cd backend/api && npm run type-check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRON-01 | streak-at-risk cron responds 200 with `{sent, skipped}` | smoke (manual) | curl with CRON_SECRET — manual | N/A |
| CRON-02 | receipt polling cron responds 200 with `{checked, deactivated_users}` | smoke (manual) | curl with CRON_SECRET — manual | N/A |
| CRON-03 | weekly digest cron responds 200 with `{sent, skipped}` | smoke (manual) | curl with CRON_SECRET — manual | N/A |
| All | TypeScript compiles | static | `cd backend/api && npm run type-check` | ✅ tsconfig exists |

**Note:** No automated test framework is present in `backend/api/`. All cron verification is manual smoke testing via curl with `Authorization: Bearer $CRON_SECRET` after deploy. This is consistent with how existing crons (supplements.ts, storage.ts, forms.ts) are validated.

### Wave 0 Gaps
- None for test infrastructure — type-check is sufficient and already configured.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | CRON_SECRET Bearer auth — already established pattern |
| V3 Session Management | no | Cron endpoints are stateless |
| V4 Access Control | yes | Admin client only; cron routes never exposed to user JWT |
| V5 Input Validation | no | No user input — all data from internal DB queries |
| V6 Cryptography | no | No key material handled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated cron trigger | Spoofing | CRON_SECRET Bearer auth — 401 if missing/wrong |
| Cross-user data exposure in digest | Information Disclosure | Admin client + per-user query scoping (user_id equality) |
| Notification spam via repeated cron fire | Denial of Service | idempotency_key UNIQUE in notification_log — duplicate sends silently skipped |
| Dead token accumulation after DeviceNotRegistered | Elevation of Privilege | is_active=false update in CRON-02 cleanup step |

---

## Sources

### Primary (HIGH confidence)
- `backend/api/src/services/notificationService.ts` — [VERIFIED: codebase] — processReceipts(), send(), sendBatch() implementations
- `backend/api/src/routes/notifications.ts` — [VERIFIED: codebase] — existing router structure with authMiddleware
- `backend/api/src/routes/forms.ts` — [VERIFIED: codebase] — separate cron router export pattern
- `backend/api/src/routes/supplements.ts` — [VERIFIED: codebase] — CRON_SECRET Bearer auth pattern
- `backend/api/src/app.ts` — [VERIFIED: codebase] — dual router mount pattern (storageRouter + storageCleanupRouter)
- `vercel.json` — [VERIFIED: codebase] — 4 existing cron entries, no maxDuration config
- `supabase/migrations/054_notification_schema.sql` — [VERIFIED: codebase] — notification_log, notification_tokens, notification_preferences schema
- `supabase/migrations/002_habits_schema.sql` — [VERIFIED: codebase] — habit_logs(habit_id, user_id, date, value) with UNIQUE(habit_id, date)
- `supabase/migrations/007_gamification_schema.sql` — [VERIFIED: codebase] — user_gamification(xp, level, current_streak), xp_transactions(amount, source, created_at)
- `node_modules/expo-server-sdk/build/ExpoClientValues.js` — [VERIFIED: codebase] — pushNotificationReceiptChunkLimit=300, pushNotificationChunkLimit=100

### Secondary (MEDIUM confidence)
- Vercel Cron documentation — `*/15` requires Pro plan; Hobby minimum is 1 hour [ASSUMED: consistent with known Vercel pricing tiers]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase, no new installs
- Architecture: HIGH — cron pattern verified from 3 existing working cron routes in this project
- SQL patterns: MEDIUM — streak SQL is correct per PostgreSQL docs but not tested against production data volume
- Pitfalls: HIGH — derived from direct code inspection of existing cron routes and notificationService.ts

**Research date:** 2026-05-28
**Valid until:** 2026-07-28 (stable dependencies, schema locked by migration 054)
