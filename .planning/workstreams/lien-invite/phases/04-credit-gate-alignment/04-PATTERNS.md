# Phase 4: Credit-Gate Alignment - Pattern Map

**Mapped:** 2026-08-16
**Files analyzed:** 6 (2 new migration/route files, 4 edited existing files)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/migrations/<dated>_premium_credit_grant.sql` | migration | CRUD (DDL + RPC) | `supabase/migrations/026_ai_credits.sql` (RPC shape) + `supabase/migrations/20260812_waitlist_founder_offer.sql` (app_config + REVOKE/GRANT idiom) | exact (composite of two analogs, both same file-type) |
| `backend/api/src/config/credits.ts` | config | CRUD (constant export) | itself — additive edit, existing conventions apply directly | exact (edited in place) |
| `backend/api/src/services/creditService.ts` | service | CRUD (RPC wrapper) | `deductCredits` in the same file, lines 120-146 | exact |
| `backend/api/src/middleware/creditGate.ts` | middleware | request-response | itself — surgical edit of `creditCheck`, lines 49-114 | exact (edited in place) |
| `backend/api/src/routes/credits-cron.ts` | route (cron) | event-driven (Vercel Cron trigger) | `backend/api/src/routes/notifications-cron.ts` | exact |
| `backend/api/src/app.ts` | route (mount) | request-response | itself — dual-mount pattern already present for `/notifications` and `/forms` | exact |
| `backend/api/vercel.json` | config | batch (cron schedule) | itself — 7 existing cron entries, add an 8th | exact |

No-analog files: none. Every file in scope has a directly-verified, same-codebase precedent.

## Pattern Assignments

### `supabase/migrations/<dated>_premium_credit_grant.sql` (migration)

**Analogs:** `supabase/migrations/026_ai_credits.sql` (RPC/ledger shape) and
`supabase/migrations/20260812_waitlist_founder_offer.sql` (app_config table + REVOKE/GRANT idiom)

**Column addition pattern** — no direct analog needed, plain `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
(house style, additive, safe to re-run):
```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_lifetime_premium BOOLEAN NOT NULL DEFAULT false;
```

**Feature-flag seed row pattern** — copy `app_config` insert idiom verbatim, source:
`supabase/migrations/20260812_waitlist_founder_offer.sql:159-170`:
```sql
-- app_config already exists (created in that migration) — do NOT re-create it, only INSERT the row
INSERT INTO public.app_config (key, value)
VALUES ('premium_credit_cap_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
```
Note: `value` column is `JSONB NOT NULL` — insert the bare literal `false` (unquoted JSONB boolean),
not the string `'false'`, so the client-side read deserializes to JS `false`/`true` (see Pitfall 4 in
RESEARCH.md).

**RPC shape to mirror** — source: `supabase/migrations/026_ai_credits.sql:89-134` (`deduct_ai_credits`),
same `SECURITY DEFINER` + `FOR UPDATE`-free top-up (no row lock needed for an additive `+=`, unlike
the deduct path's balance-floor check) + ledger-insert-with-`ON CONFLICT DO NOTHING` shape:
```sql
CREATE OR REPLACE FUNCTION public.grant_premium_credits(
  p_user_id UUID,
  p_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key TEXT := 'premium_grant_' || to_char(now(), 'YYYY-MM');
BEGIN
  UPDATE public.user_ai_credits
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.ai_credit_transactions
    (user_id, type, amount, source, idempotency_key)
  VALUES
    (p_user_id, 'premium_grant', p_amount, 'premium_grant', v_key)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('granted', true);
END;
$$;
```

**CHECK-constraint and idempotency-index context** (already shipped, zero migration needed for
these — cite, don't recreate) — verbatim, `026_ai_credits.sql:36,47-49`:
```sql
type TEXT NOT NULL CHECK (type IN ('deduct', 'earn', 'welcome', 'daily_base', 'monthly_base', 'admin_adjust', 'premium_grant')),
...
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency
  ON public.ai_credit_transactions (user_id, source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```
`'premium_grant'` is already a legal `type` value with zero prior usages; the unique index is on the
composite `(user_id, source, idempotency_key)` — the new RPC's `source` must be the fixed literal
`'premium_grant'` on every call or the month-scoped idempotency guarantee silently breaks (Pitfall 3).

**REVOKE/GRANT idiom — three-role form, not two-role** — source:
`20260812_waitlist_founder_offer.sql:92-93` (verbatim; this is the *current*, correct idiom — do
**not** copy `026_ai_credits.sql`'s older two-role form, which predates the discovery of the
`ALTER DEFAULT PRIVILEGES` gap noted live in `STATE.md`):
```sql
REVOKE EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) TO service_role;
```

---

### `backend/api/src/config/credits.ts` (config, edited in place)

**Analog:** itself — file read in full, current content below (lines 1-51). Follow the exact
single-source-of-truth constant convention already used for `CREDIT_COSTS`/`DAILY_QUOTAS`/
`DAILY_EARN_CAP`.

**Existing convention** (`backend/api/src/config/credits.ts:44-50`):
```typescript
// Number of credits awarded per earn event (EARN-07)
export const EARN_AMOUNT = 1;

// Maximum earn credits per day:
// chat bonus (2) + scan bonus (2) = 4
// Once a user has earned this many credits today, further earn calls are no-ops.
export const DAILY_EARN_CAP = DAILY_QUOTAS.chat.bonus + DAILY_QUOTAS.scan.bonus;
```

**New constant to add**, matching this exact comment-then-export shape (D-02):
```typescript
// Monthly AI-credit allowance for premium users, funded by grant_premium_credits() via
// the monthly cron (CRED-03, D-02). ~10x a fully-engaged free user's chat volume.
export const PREMIUM_MONTHLY_GRANT = 300;
```

---

### `backend/api/src/services/creditService.ts` (service, additive export)

**Analog:** `deductCredits` in the same file, lines 120-146 (RPC-wrapper shape to mirror exactly —
`supabase.rpc(...)` call + typed-narrowing of the JSONB return):
```typescript
// Source: backend/api/src/services/creditService.ts:120-146, read this session — mirror this shape
export async function deductCredits(
  userId: string,
  action: CreditAction,
  idempotencyKey: string,
  costOverride?: number,
): Promise<{ success: boolean; balance: number; required?: number }> {
  const p_cost = (costOverride !== undefined && costOverride > 0) ? costOverride : CREDIT_COSTS[action];

  const { data, error } = await supabase.rpc('deduct_ai_credits', {
    p_user_id: userId,
    p_cost,
    p_action_type: action,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data) {
    return { success: false, balance: 0, required: p_cost };
  }

  const result = data as { success: boolean; balance_after?: number; balance?: number; required?: number };
  return {
    success: result.success,
    balance: result.balance_after ?? result.balance ?? 0,
    required: result.required,
  };
}
```

**New wrapper to add**, same shape, mirroring `grant_premium_credits`'s simpler `{ granted: boolean }`
return instead of the deduct RPC's richer shape:
```typescript
export async function grantMonthlyPremiumCredits(
  userId: string,
  amount: number = PREMIUM_MONTHLY_GRANT,
): Promise<{ granted: boolean }> {
  const { data, error } = await supabase.rpc('grant_premium_credits', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error || !data) {
    return { granted: false };
  }

  return { granted: (data as { granted: boolean }).granted === true };
}
```
Import `PREMIUM_MONTHLY_GRANT` from `../config/credits.js` alongside the existing
`CREDIT_COSTS, DAILY_QUOTAS, MONTHLY_QUOTAS, EARN_AMOUNT, DAILY_EARN_CAP` import block
(`creditService.ts:2-9`) to match the existing single import-block convention.

---

### `backend/api/src/middleware/creditGate.ts` (middleware, surgical edit)

**Analog:** itself — full file read this session, current bypass verified unchanged at lines 49-114.

**Exact block to delete/replace** (`creditGate.ts:49-71`, verbatim, this session's read):
```typescript
export function creditCheck(action: CreditAction) {
  return async (c: Context, next: Next) => {
    const userId = c.get('auth').userId;

    // ── PREM-02: Premium bypass ──────────────────────────────
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('user_id', userId)
      .single();

    if (profile?.tier === 'premium') {
      c.set('creditPassThrough', true);
      return next();
    }

    // ── D-01/D-02: Free quota pass-through ──────────────────
    const quota = await creditService.getQuotaStatus(userId, action);
```

**D-03 + D-05 reconciled (Pattern 3 from RESEARCH.md):** replace the unconditional `tier==='premium'`
branch with a **flag** branch, not a **tier** branch — same shape (`if (cond) { pass-through }`) but
the condition source changes from `profile?.tier === 'premium'` to the `app_config` flag read, modeled
directly on the existing `profile` `.single()` read immediately above it:
```typescript
// Modeled on the deleted tier read above — same client, same .single() pattern
const { data: config } = await supabase
  .from('app_config')
  .select('value')
  .eq('key', 'premium_credit_cap_enabled')
  .single();

const capEnabled = config?.value === true; // JSONB boolean — compare against JS `true`, never the string 'true'

if (!capEnabled) {
  c.set('creditPassThrough', true);
  return next();
}
```
This keeps the observable behavior identical to today's bypass while `premium_credit_cap_enabled` is
`false` (the shipped default), and collapses to true balance-checking once Phase 6 flips it — matching
D-03 ("delete the tier-branch bypass") without violating D-05 ("off by default, deploy-decoupled").

**Stale-comment sweep** — every one of these, verified present this session at these exact locations,
must be updated in the same commit as the code change (Pitfall 5):
- `creditGate.ts:17-18` — `creditPassThrough=true → free quota slot (D-01/D-02) or premium user (PREM-02) — no deduction`
- `creditGate.ts:44` — docblock `1. PREM-02: premium users bypass entirely (tier='premium')`
- `creditGate.ts:121` — `Only track quota for non-premium (premium bypass should not consume quota slots)`
- `creditGate.ts:133-138` region (`creditDeduct`'s own comment block referencing "not premium")

`grep -n "PREM-02\|premium bypass" backend/api/src/middleware/creditGate.ts` must return zero hits
after the edit (per RESEARCH.md's stated verification command).

---

### `backend/api/src/routes/credits-cron.ts` (route, new file)

**Analog:** `backend/api/src/routes/notifications-cron.ts` (full file read this session, 328 lines) —
copy this file's entire structural shape: own `Hono()` instance, no `authMiddleware`, local
`verifyCronSecret()` helper, one `GET /cron/<job>` handler per job, `export { xCronRouter }`.

**Admin client + no-auth-middleware header** (`notifications-cron.ts:1-14`, verbatim):
```typescript
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { notificationService } from '../services/notificationService.js';

// Admin client — bypasses RLS for cron-specific admin queries
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const notificationsCronRouter = new Hono();

// No authMiddleware — cron routes authenticate via CRON_SECRET Bearer header
```

**`verifyCronSecret` helper to copy verbatim** (`notifications-cron.ts:22-28`):
```typescript
function verifyCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}
```

**Handler shape to mirror** (`notifications-cron.ts:111-115` opening + `229-233` closing, the
`streak-at-risk` job — closest analog because it also iterates a user set and calls a service function
per user, matching the new grant job's "for each premium user, call
`grantMonthlyPremiumCredits`" shape):
```typescript
notificationsCronRouter.get('/cron/streak-at-risk', async (c) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // ... query + per-user loop ...
    return c.json({ sent: sentCount, skipped: skippedCount });
  } catch (err: any) {
    console.error('[CRON-01]', err);
    return c.json({ error: err.message }, 500);
  }
});
```

**New route to build**, same shape — `GET /cron/premium-grant`:
```typescript
creditsCronRouter.get('/cron/premium-grant', async (c) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { data: premiumUsers, error } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('tier', 'premium');

    if (error) {
      console.error('[CRON] premium-grant query failed:', error);
      return c.json({ error: error.message }, 500);
    }

    let granted = 0;
    let skipped = 0;

    for (const row of premiumUsers ?? []) {
      const result = await creditService.grantMonthlyPremiumCredits(row.user_id);
      if (result.granted) granted++;
      else skipped++;
    }

    return c.json({ granted, skipped });
  } catch (err: any) {
    console.error('[CRON] premium-grant', err);
    return c.json({ error: err.message }, 500);
  }
});

export { creditsCronRouter };
```
Import `creditService` the same way `notifications-cron.ts` imports `notificationService`
(`import * as creditService from '../services/creditService.js';` — matches `creditGate.ts:3`'s
existing import style for the same module).

---

### `backend/api/src/app.ts` (route mount, additive edit)

**Analog:** itself — the exact dual-mount pattern already exists twice, for `/notifications` and
`/forms`. Verified this session, `app.ts:14-15,71-72` and `28,86-87`:
```typescript
import { notificationsRouter } from './routes/notifications.js';
import { notificationsCronRouter } from './routes/notifications-cron.js';
...
app.route('/notifications', notificationsRouter);
app.route('/notifications', notificationsCronRouter);  // same prefix, separate Hono instance, separate middleware scope
```
and
```typescript
import { formsRouter, formsCronRouter } from './routes/forms.js';
...
app.route('/forms', formsRouter);
app.route('/forms', formsCronRouter);
```

**Edit to make** — add the import near `creditsRouter` (`app.ts:12`) and the mount immediately after
`app.route('/credits', creditsRouter);` (`app.ts:68`):
```typescript
import { creditsRouter } from './routes/credits.js';
import { creditsCronRouter } from './routes/credits-cron.js';
...
app.route('/credits', creditsRouter);
app.route('/credits', creditsCronRouter);
```

---

### `backend/api/vercel.json` (config, additive edit)

**Analog:** itself — 7 existing cron entries, same array, add an 8th. Verified current full file this
session (`vercel.json:6-35`).

**Existing entry shape to copy** (`vercel.json:23-26`):
```json
{
  "path": "/notifications/cron/streak-at-risk",
  "schedule": "0 21 * * *"
}
```

**New 8th entry to append**, before the closing `]` of the `crons` array:
```json
{
  "path": "/credits/cron/premium-grant",
  "schedule": "0 0 1 * *"
}
```

## Shared Patterns

### Service-role Supabase client instantiation
**Source:** `backend/api/src/middleware/creditGate.ts:8-13` and `backend/api/src/services/creditService.ts:13-18`
(identical in both files) and `backend/api/src/routes/notifications-cron.ts:6-10` (same pattern, named
`supabaseAdmin`)
**Apply to:** `credits-cron.ts` (new file) — reuse the exact `SUPABASE_URL` /
`SUPABASE_SERVICE_KEY ?? SUPABASE_PUBLISHABLE_KEY` fallback and `{ autoRefreshToken: false,
persistSession: false }` options; do not invent a new client-construction variant.
```typescript
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```

### Cron authentication
**Source:** `backend/api/src/routes/notifications-cron.ts:22-28` (`verifyCronSecret`)
**Apply to:** `credits-cron.ts` — copy verbatim, no modification. Six other cron routes in this
codebase already use this exact helper shape (RESEARCH.md "Don't Hand-Roll" table).

### RPC wrapper narrowing shape
**Source:** `backend/api/src/services/creditService.ts:120-146` (`deductCredits`)
**Apply to:** `creditService.ts`'s new `grantMonthlyPremiumCredits` export — `supabase.rpc(name, args)`
→ `if (error || !data) return <failure shape>` → cast `data as <ReturnShape>` → return normalized
object. Every existing RPC-calling function in this file (`earnCredits`, `deductCredits`) follows this
shape; the new function should not deviate.

### `SECURITY DEFINER` + three-role `REVOKE`/`GRANT` idiom
**Source:** `supabase/migrations/20260812_waitlist_founder_offer.sql:92-93` (and repeated 4 more times
in the same file for every RPC it defines)
**Apply to:** the new migration's `grant_premium_credits()` function — use the three-role revoke form
(`FROM PUBLIC, anon, authenticated`), **not** the older two-role form still present (uncorrected, by
design — do not edit that file) in `026_ai_credits.sql`'s `deduct_ai_credits`/`earn_ai_credits`. This
closes the exact `ALTER DEFAULT PRIVILEGES` gap `STATE.md` already flags as live on three other
functions.

### Idempotency via partial unique index, not app-code check-then-insert
**Source:** `supabase/migrations/026_ai_credits.sql:47-49` (`idx_credit_tx_idempotency` on
`(user_id, source, idempotency_key)`)
**Apply to:** `grant_premium_credits()`'s `INSERT ... ON CONFLICT (user_id, source, idempotency_key)
DO NOTHING` — the `source` column must be the fixed literal `'premium_grant'` on every call (Pitfall 3);
never add a manual "already granted this month?" `SELECT` first (RESEARCH.md "Don't Hand-Roll" table).

## No Analog Found

None — every file in this phase's scope has a direct, same-codebase, recently-verified precedent.
This is a small wiring phase layered entirely on infrastructure that already exists (per RESEARCH.md's
own framing).

## Metadata

**Analog search scope:** `backend/api/src/middleware/`, `backend/api/src/services/`,
`backend/api/src/routes/`, `backend/api/src/config/`, `backend/api/src/app.ts`,
`backend/api/vercel.json`, `supabase/migrations/026_ai_credits.sql`,
`supabase/migrations/20260812_waitlist_founder_offer.sql`,
`apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx` (CRED-06 no-regression check only, not a
pattern source — confirmed untouched, reads `tier` independently of the credit path at
`branding/page.tsx:12-30`)
**Files scanned/read in full this session:** `creditGate.ts`, `creditService.ts`, `credits.ts`,
`notifications-cron.ts`, `026_ai_credits.sql` (relevant sections), `20260812_waitlist_founder_offer.sql`
(relevant sections), `app.ts` (grep), `vercel.json`, `branding/page.tsx` (grep)
**Pattern extraction date:** 2026-08-16
