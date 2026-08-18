# Phase 4: Credit-Gate Alignment - Research

**Researched:** 2026-08-16
**Domain:** Backend policy change — Hono middleware + Postgres RPC + Vercel cron, on an existing
tier-agnostic AI credit ledger (Ziko Platform, `backend/api`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CRED-01 — the blocking production audit**
- **D-01: RESOLVED, not deferred.** `SELECT count(*) FROM public.user_profiles WHERE tier = 'premium'`
  was run directly against the `ziko` Supabase project (`slkobhavpwsubnsmuhya`) on 2026-08-15, per the
  user's explicit confirmation that this project is production. **Result: 0.** A-01 ("no real user
  affected") is confirmed true, not merely assumed. No grandfathering decision is needed; the bypass
  can be deleted outright rather than tier-branched. This resolution should be cited directly in the
  phase's plan/verification — CRED-01 does not need its own runtime check re-run at execution time.
  — **Note for the planner:** if meaningful time passes between this discussion and execution, a
  cheap re-verification (`SELECT count(*) ...` again) is worth a single planning-time task before
  deleting the bypass, since new premium users could theoretically appear between now and execution.
  As of this research pass (2026-08-16), only one day has elapsed since the count — low risk, but the
  planner should still schedule this as the first task in the phase so the safety property holds at
  execution time, not just at discussion time.

**Credit allowance**
- **D-02:** The monthly premium AI-credit allowance is **300 credits/month**, added as a new named
  constant in `backend/api/src/config/credits.ts` (matching the existing `CREDIT_COSTS`/
  `DAILY_QUOTAS`/`MONTHLY_QUOTAS` single-source-of-truth convention). Reversible — a config value.

**Bypass removal strategy**
- **D-03:** Follow `research/ARCHITECTURE.md` §4's recommended redesign exactly: **delete** the
  `tier === 'premium'` bypass branch in `creditGate.ts` (verified below at lines 53-63, unchanged
  since research), rather than adding a parallel tier-branching path. Premium users fall through to
  the existing `getQuotaStatus`/`deductCredits` logic unmodified — funded by a larger balance via the
  monthly grant. `credits.ts` and `creditService.ts` need no tier-awareness changes.

**Founder → premium conversion (scope boundary)**
- **D-04:** The mechanism that sets a real founder's `user_profiles.tier = 'premium'` /
  `is_lifetime_premium = true` once they claim their spot is **out of scope for this milestone**.
  Phase 4 builds the grant mechanism and the provenance flag so they're ready whenever that future
  flow ships, but does not build the flow itself.

### Claude's Discretion
- Exact migration filename/numbering for `grant_premium_credits()` and `is_lifetime_premium` (dated
  form, per house convention — see Verified State below for the exact next-available name).
- `app_config` key name for CRED-05's feature flag (e.g. `premium_credit_cap_enabled`), default value
  `false`, read via the same direct service-role `SELECT` pattern `creditGate.ts` already uses for
  `user_profiles.tier` — no new RPC needed (backend already runs as `service_role`).
- Cron schedule/route naming for the monthly grant job (research suggests `0 0 1 * *`, an 8th
  `vercel.json` entry alongside the existing 7).
- Idempotency key format for the grant ledger row (research suggests
  `'premium_grant_' || to_char(now(), 'YYYY-MM')` reusing the existing partial unique index).

### Deferred Ideas (OUT OF SCOPE)
- The founder-to-`tier='premium'` redemption flow (D-04) — future milestone.
- Flipping the feature flag in production — Phase 6's job.
- The mechanism converting a waitlist win into a real `tier='premium'` row.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-01 | Production audit confirms no real `tier='premium'` user is affected before any code change | D-01 resolution (count=0, 2026-08-15) cited verbatim below; planner adds one cheap re-verify task as a safety margin, not a re-litigation |
| CRED-02 | Premium user's AI requests checked against a real, finite balance — unconditional bypass removed | Exact deletion target verified at `creditGate.ts:53-63` below, plus every surrounding comment that must be updated in the same commit |
| CRED-03 | Premium user gets a generous-but-finite monthly allowance | D-02 locks 300/month; new `PREMIUM_MONTHLY_GRANT` constant in `credits.ts`; funded via new `grant_premium_credits()` RPC + monthly cron, not a gate-time branch |
| CRED-04 | Founder keeps lifetime premium independent of a later subscription flip | New `user_profiles.is_lifetime_premium BOOLEAN NOT NULL DEFAULT false` provenance column — pure schema addition, zero call-site changes required this phase |
| CRED-05 | Behavior gated behind a feature flag, decoupled from deploy | Reuses Phase 1's `app_config` table (verified schema below); new key, service-role direct-SELECT read pattern, no RPC needed |
| CRED-06 | No regression for existing `tier` readers | `branding/page.tsx` verified unaffected (reads `user_profiles.tier` independently of the credit path); one additional unrelated `tier` reader found and ruled out (see Pitfalls) |
</phase_requirements>

## Summary

This phase is a small, well-scoped backend change layered on infrastructure that mostly already
exists. The exact bypass to delete was verified this session at `creditGate.ts:53-63` — unchanged
since the 2026-08-12 research, same line numbers, same shape. The `app_config` table CRED-05 needs
already shipped in Phase 1 (`20260812_waitlist_founder_offer.sql`) with the exact shape
`(key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ)`, deny-all RLS, no generic
read RPC — confirming the discretion note that a direct service-role `SELECT` is the correct pattern,
not a new RPC. `is_lifetime_premium` and `grant_premium_credits()` do **not** yet exist anywhere in
the codebase (grep-verified this session) — Phase 1 explicitly deferred both to Phase 4, per
`ROADMAP.md`'s own drift-correction note. The `ai_credit_transactions.type` CHECK constraint has
carried `'premium_grant'` since migration 026 with zero usages — the schema was built for this.

The one piece of net-new engineering risk this research pass surfaced beyond the existing
ARCHITECTURE.md — not present in the 2026-08-12 research — is where the new monthly-grant cron route
lives inside `backend/api/src/routes/`. `routes/credits.ts` applies `router.use('*', authMiddleware)`
to the whole router instance; mounting a cron route there would incorrectly require a user JWT on a
Vercel-cron-triggered request. The fix is the same pattern already used twice in this codebase
(`notifications-cron.ts` as its own file, `forms.ts` exporting a second `formsCronRouter` from the
same file) — a **separate Hono router instance**, with no `authMiddleware`, guarded only by
`CRON_SECRET`, mounted at the same `/credits` prefix via a second `app.route('/credits', ...)` call.
Hono scopes `router.use()` to the instance it's called on, so this is safe and is the exact idiom
`app.ts` already uses for `/notifications` and `/forms`.

**Primary recommendation:** delete `creditGate.ts:53-63` outright (no tier-branching), add
`PREMIUM_MONTHLY_GRANT = 300` to `credits.ts`, ship one new dated migration adding
`is_lifetime_premium`, `grant_premium_credits()`, and the `premium_credit_cap_enabled` flag row, add
a `grantMonthlyPremiumCredits()` wrapper to `creditService.ts`, and add a **new, separate** cron
router file (not reusing `credits.ts`'s authenticated router) for the monthly grant job.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Feature-flag read (`premium_credit_cap_enabled`) | API / Backend | Database / Storage | `app_config` is the storage; `creditGate.ts` is the only reader — a backend-internal service-role read, never exposed to a client |
| Credit-gate bypass removal | API / Backend | — | Pure middleware logic change in `backend/api/src/middleware/creditGate.ts`; no client, no DB schema change for this part |
| Monthly premium balance top-up | Database / Storage | API / Backend (cron trigger) | The RPC (`grant_premium_credits`) owns the atomicity and ledger write; the cron route is only a scheduling trigger, matching `deduct_ai_credits`'s existing division of labor |
| Lifetime-premium provenance | Database / Storage | — | A schema-only column this phase; no reader/writer code ships in this phase per D-04 (the future redemption flow writes it) |
| `tier` regression surface (`branding/page.tsx`, mobile settings badge) | Frontend Server (SSR) / Browser | — | Both are independent readers of `user_profiles.tier`/`subscription_tier` outside the credit-gate path; this phase must not touch either |

## Standard Stack

### Core
No new libraries. This phase modifies existing backend code and adds one SQL migration using
patterns already in production.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.112.3 [VERIFIED: npm registry — `npm view` this session] | Postgres RPC calls, service-role reads | Already the only DB client in `backend/api` |
| `hono` | 4.13.2 [VERIFIED: npm registry — `npm view` this session] | Middleware/router for the gate and the new cron route | Already the only web framework in `backend/api` |

No `npm install` step for this phase — every dependency used is already in `backend/api/package.json`.

### Package Legitimacy Audit

Not applicable — this phase installs zero new external packages. Both libraries above are pre-existing
project dependencies confirmed still present on the npm registry at the versions already pinned; no
new supply-chain surface is introduced.

## Architecture Patterns

### System Architecture Diagram

```
Vercel Cron (vercel.json, 8th entry, "0 0 1 * *")
        │  GET /credits/cron/premium-grant  (Authorization: Bearer <CRON_SECRET>)
        ▼
┌─────────────────────────────┐
│ backend/api (Hono)          │
│ routes/credits-cron.ts      │  ← NEW router, no authMiddleware, verifyCronSecret() only
│   1. SELECT user_id FROM    │
│      user_profiles          │
│      WHERE tier='premium'   │
│   2. for each: call         │
│      grantMonthlyPremium-   │
│      Credits(userId)        │
└──────────────┬───────────────┘
               │ creditService.grantMonthlyPremiumCredits()
               ▼
┌─────────────────────────────────────────────┐
│ Supabase Postgres                            │
│ grant_premium_credits(p_user_id, p_amount)   │ SECURITY DEFINER
│   → UPDATE user_ai_credits.balance += amount │
│   → INSERT ai_credit_transactions            │
│       type='premium_grant'                   │
│       idempotency_key='premium_grant_YYYY-MM'│
│       ON CONFLICT DO NOTHING (idempotent)    │
└───────────────────────────────────────────────┘

Every /ai/* request (unrelated to the cron path above)
        │
        ▼
┌─────────────────────────────┐
│ creditCheck(action)          │  middleware/creditGate.ts
│  1. [DELETED] premium bypass │  ← this phase removes this branch entirely
│  2. Feature-flag read:       │  NEW: app_config.premium_credit_cap_enabled
│     (only changes messaging/ │  service-role direct SELECT, no RPC
│      rollout — see Pitfall 3)│
│  3. getQuotaStatus() —       │  UNCHANGED — already tier-agnostic
│     free-quota pass-through  │
│  4. deductCredits() —        │  UNCHANGED — balance now larger for premium
│     balance check + deduct   │  users because of the monthly grant, not
└─────────────────────────────┘  because of gate logic
```

A reader can trace the primary use case two ways: (1) once a month, the cron fires, funds every
premium user's balance; (2) on every AI request, the gate now treats premium and free users
identically — the only difference is a bigger number in `user_ai_credits.balance` for premium users,
put there by path (1).

### Recommended Project Structure

No new directories. Touch/add these files only:

```
supabase/migrations/
└── 20260816_premium_credit_grant.sql   # NEW — is_lifetime_premium, grant_premium_credits(), flag row
backend/api/src/
├── config/credits.ts                    # ADD — PREMIUM_MONTHLY_GRANT constant
├── services/creditService.ts            # ADD — grantMonthlyPremiumCredits()
├── middleware/creditGate.ts             # EDIT — delete bypass (lines 53-63) + stale comments
├── routes/credits-cron.ts               # NEW — cron router, no authMiddleware
├── routes/credits.ts                    # UNCHANGED (do not add the cron route here — see Pitfall 1)
└── app.ts                               # EDIT — mount app.route('/credits', creditsCronRouter)
backend/api/vercel.json                  # EDIT — add 8th cron entry
```

### Pattern 1: Delete-the-bypass, not tier-branch (D-03)

**What:** Remove the `if (profile?.tier === 'premium') { ...; return next(); }` branch entirely.
Premium users fall through to the exact same `getQuotaStatus`/`deductCredits` calls free users hit.
**When to use:** Always, per D-03 — this is a locked decision, not a discretion point.
**Verified current code** (`backend/api/src/middleware/creditGate.ts:49-72`, read this session, line
numbers unchanged from the 2026-08-12 research):

```typescript
// Source: backend/api/src/middleware/creditGate.ts (read this session, verbatim)
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
    // ...unchanged below
```

Delete the `if (profile?.tier === 'premium') { ... }` block (and, per D-05's feature-flag
requirement, wrap the *entire remaining bypass-related read* in the flag check rather than deleting
the `profile` query outright — see Pattern 3 below for how the flag interacts with this deletion).
Also update every stale comment cross-referenced in `ARCHITECTURE.md` §4's exhaustive grep (lines 17,
18, 44, 47, 121, 133-138) — verified unchanged at those same line numbers this session (see
`creditGate.ts` full read above: line 17-18 "creditPassThrough=true → free quota slot ... or premium
user (PREM-02) — no deduction", line 44 docblock "1. PREM-02: premium users bypass entirely", line
121 "not premium", lines 133-138 "Only track quota for non-premium").

### Pattern 2: Fund via monthly grant RPC, reusing the reserved `premium_grant` type

**What:** A new `SECURITY DEFINER` RPC that tops up `user_ai_credits.balance` and writes a
`type='premium_grant'` ledger row, called once/month by a cron for every `tier='premium'` user.
**When to use:** This is the only tier-aware code this phase adds — everything else stays
tier-agnostic (D-03's stated goal).
**Example, modeled directly on `deduct_ai_credits`** (`supabase/migrations/026_ai_credits.sql:89-134`,
verified this session — quoted below, this is the exact shape to mirror):

```sql
-- Source: supabase/migrations/026_ai_credits.sql:89-134 (read this session, verbatim structure to mirror)
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_user_id         UUID,
  p_cost            INTEGER,
  p_action_type     TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance
  FROM public.user_ai_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  -- ... (deduct, insert ledger row with ON CONFLICT DO NOTHING on the idempotency index)
END;
$$;
```

Note the exact CHECK constraint text this new RPC's `type` value must satisfy, quoted verbatim from
`supabase/migrations/026_ai_credits.sql:36` (read this session):

```
type TEXT NOT NULL CHECK (type IN ('deduct', 'earn', 'welcome', 'daily_base', 'monthly_base', 'admin_adjust', 'premium_grant')),
```

`'premium_grant'` is already a legal value — no CHECK-constraint migration needed for the type itself.
The idempotency unique index text, quoted verbatim from `026_ai_credits.sql:47-49` (read this
session):

```
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency
  ON public.ai_credit_transactions (user_id, source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

This index is on `(user_id, source, idempotency_key)` — **not** `(user_id, idempotency_key)` alone.
The new RPC's `INSERT` must therefore supply a `source` value (e.g. `'premium_grant'` or leave it
`NULL`, matching this index's partial-unique semantics) alongside the idempotency key
`'premium_grant_' || to_char(now(), 'YYYY-MM')` for the monthly-uniqueness guarantee to actually bind
on the composite key exactly as designed — a mismatch here (e.g. omitting `source`, or reusing a
`source` value another `type` already writes) would allow the same user to be double-granted in the
same month.

`creditService.ts`'s wrapper shape to match — `deductCredits` (verified this session,
`backend/api/src/services/creditService.ts:120-146`, quoted structure):

```typescript
// Source: backend/api/src/services/creditService.ts:120-146 (read this session — mirror this shape)
export async function deductCredits(
  userId: string,
  action: CreditAction,
  idempotencyKey: string,
  costOverride?: number,
): Promise<{ success: boolean; balance: number; required?: number }> {
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
  return { success: result.success, balance: result.balance_after ?? result.balance ?? 0, required: result.required };
}
```

`grantMonthlyPremiumCredits(userId, amount)` should follow this exact `supabase.rpc(...)` +
typed-return-narrowing shape.

### Pattern 3: Feature flag via `app_config`, direct service-role read (no new RPC)

**What:** `creditGate.ts` reads `app_config.value` for key `premium_credit_cap_enabled` with the same
service-role client it already uses for `user_profiles.tier`, and branches: flag `false` (default) →
current bypass behavior is preserved *as a fallback*; flag `true` → the bypass is gone, balance is
checked. **Read D-05 carefully: this means the deletion in Pattern 1 must be conditioned on the flag,
not unconditional**, since CRED-05 requires the new capped behavior to stay off by default. The
cleanest implementation is: keep a *flag check*, not a *tier check*, as the new early branch —
`if (!flagEnabled) { premiumBypassBehavior(); }` — collapsing to the Pattern 1 deletion once the flag
is true. This reconciles D-03 ("delete the bypass") with D-05 ("gated behind a flag, off by default")
without contradiction: the code path in `creditGate.ts` once the flag flips `true` looks exactly like
Pattern 1's deleted-bypass version; while the flag is `false`, the file still contains a small
conditional (a flag check, not a tier check) guarding the old behavior — this is fundamentally
different from D-03's rejected "tier-branching" pattern, because the branch is on the flag, not on
`tier`, and collapses to zero tier-specific logic once flipped.

**Verified `app_config` schema** (`supabase/migrations/20260812_waitlist_founder_offer.sql`, section 5,
read this session, quoted verbatim):

```sql
CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO CREATE POLICY statements, exactly like waitlist_signups (DATA-05).
```

Existing seeded rows (same file, plus `20260815_waitlist_retention_config.sql`, both read this
session): `('waitlist_reveal_threshold', '30')` and `('waitlist_retention_years', '3')`. Both were
inserted via plain `INSERT ... ON CONFLICT (key) DO NOTHING` — no RPC wraps generic reads of this
table anywhere in the codebase (grep-verified this session: zero hits for `app_config` in
`backend/api/src/`). The new migration should insert the flag the same way:

```sql
INSERT INTO public.app_config (key, value)
VALUES ('premium_credit_cap_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
```

The read in `creditGate.ts` mirrors the existing `user_profiles.tier` read exactly (same file,
same service-role client already instantiated at the top of `creditGate.ts`):

```typescript
// Modeled on the existing tier read in creditGate.ts, same client, same .single() pattern
const { data: config } = await supabase
  .from('app_config')
  .select('value')
  .eq('key', 'premium_credit_cap_enabled')
  .single();

const capEnabled = config?.value === true; // JSONB boolean — compare against JS `true`, not the string 'true'
```

RLS is deny-all on `app_config` with zero policies — this read only works because `creditGate.ts`'s
Supabase client uses the service-role key (`SUPABASE_SERVICE_KEY` falling back to
`SUPABASE_PUBLISHABLE_KEY`, verified at `creditGate.ts:8-9` this session), and Supabase's
`service_role` Postgres role bypasses RLS by default — the identical mechanism that already lets this
same file read `user_profiles.tier` today despite that table also having RLS enabled.

### Pattern 4: New cron route needs its own router instance, not `credits.ts`

**What:** `routes/credits.ts` applies `router.use('*', authMiddleware)` to its entire Hono instance
(verified this session, `backend/api/src/routes/credits.ts:9`, quoted: `router.use('*',
authMiddleware);`). A cron-triggered request carries a `CRON_SECRET` bearer token, not a Supabase user
JWT — `authMiddleware` would reject it. Two house patterns exist for solving this (both verified this
session), pick either:

- **Separate file** (`notifications-cron.ts` pattern, `backend/api/src/routes/notifications-cron.ts`,
  read this session in full): its own `Hono()` instance, no `authMiddleware`, a local
  `verifyCronSecret()` helper, exported and mounted with a **second** `app.route()` call at the same
  path prefix as the authenticated router.
- **Same file, second export** (`forms.ts` pattern, verified via `app.ts:28,86-87`:
  `import { formsRouter, formsCronRouter } from './routes/forms.js';` then both
  `app.route('/forms', formsRouter); app.route('/forms', formsCronRouter);`).

Recommend the separate-file pattern (`routes/credits-cron.ts`) to match the more common recent
convention (`notifications-cron.ts`, `storage.ts`'s cleanup router) and to keep the user-facing
`/credits/balance` and `/credits/earn` endpoints' file free of cron-only code.

**Verified mounting pattern** (`backend/api/src/app.ts`, read this session, quoted):
```typescript
app.route('/credits', creditsRouter);
// ...
app.route('/notifications', notificationsRouter);
app.route('/notifications', notificationsCronRouter);  // same prefix, separate Hono instance, separate middleware scope
```

The new line to add: `app.route('/credits', creditsCronRouter);` immediately after the existing
`app.route('/credits', creditsRouter);` line 68.

**Verified `verifyCronSecret` shape to mirror** (`notifications-cron.ts:22-28`, read this session,
quoted verbatim):
```typescript
function verifyCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}
```

**Verified Vercel cron entry shape to add** (`backend/api/vercel.json`, read this session, quoted):
```json
{
  "path": "/notifications/cron/streak-at-risk",
  "schedule": "0 21 * * *"
}
```
New 8th entry: `{ "path": "/credits/cron/premium-grant", "schedule": "0 0 1 * *" }`.

### Anti-Patterns to Avoid

- **Tier-branching throughout the gate/service layer** (rejected explicitly by D-03 and
  `ARCHITECTURE.md` Anti-Pattern 3): do not add `if (tier === 'premium') { ...different quota... }`
  to `getQuotaStatus`/`deductCredits`. The balance/ledger system is already tier-agnostic; only the
  *funding* (the cron) should be tier-aware.
- **Mounting the cron route inside `credits.ts`**: this silently requires a JWT on a
  Vercel-cron-triggered request (Pattern 4 above) — a request that will never carry one, causing every
  scheduled grant to fail with 401 and go unnoticed unless someone checks Vercel cron logs.
- **Reusing `earn_ai_credits` for the monthly grant** (explicit warning already in `ARCHITECTURE.md`
  §4): it enforces `DAILY_EARN_CAP`, the wrong cap for a once-a-month top-up of 300 credits.
- **Comparing the `app_config.value` JSONB column to the string `'true'`** instead of the JS boolean
  `true`: Supabase's JS client deserializes a JSONB scalar `true` to the native boolean `true`, not the
  string `"true"` — a `=== 'true'` comparison would silently always evaluate false.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic balance top-up under concurrency | A custom read-then-write balance increment in TypeScript | `SECURITY DEFINER` RPC (`grant_premium_credits`), same `FOR UPDATE`-guarded shape as `deduct_ai_credits` | The exact race class (Vercel Fluid Compute concurrent invocations) this codebase already paid down once for deductions; a naive top-up in app code reopens it for grants |
| Idempotent monthly re-run safety | A manual "have I already granted this user this month?" SELECT-then-INSERT check | The existing partial unique index `idx_credit_tx_idempotency` on `(user_id, source, idempotency_key)`, with a month-scoped key | Postgres enforces this atomically; a check-then-insert in app code is the same TOCTOU class already rejected for the founder-rank counter (ARCHITECTURE.md §1) |
| Feature-flag storage/config | A new environment variable requiring a redeploy to flip, or a bespoke config table | The existing `app_config` table from Phase 1 | CRED-05 explicitly requires decoupling from deploy; `app_config` already exists, is already deny-all RLS, and is already read by service-role code in this exact codebase pattern |
| Cron authentication | A custom signature/HMAC scheme for the cron endpoint | The existing `CRON_SECRET` Bearer-token check, copied verbatim from `notifications-cron.ts` | Six other cron routes in this codebase already use this exact pattern; inventing a new one adds inconsistency with zero security benefit |

**Key insight:** everything this phase needs beyond the RPC/migration was already built in a prior
phase for an unrelated feature (the waitlist) — `app_config` for the flag, the `premium_grant`
ledger type for the funding mechanism, and six precedent cron routes for the scheduling shape. The
work is wiring, not invention.

## Common Pitfalls

### Pitfall 1: Mounting the cron route on the authenticated `/credits` router
**What goes wrong:** The monthly grant cron silently 401s in production because Vercel's cron request
carries no Supabase user JWT and `credits.ts`'s `router.use('*', authMiddleware)` rejects it.
**Why it happens:** `/credits/cron/premium-grant` "looks like" it belongs in `routes/credits.ts`
alongside `/credits/balance` and `/credits/earn`.
**How to avoid:** New router file/export per Pattern 4, mounted with its own `app.route()` call, no
`authMiddleware` in its chain — verified idiom, not a novel design.
**Warning signs:** A test or manual curl of the cron path with only `Authorization: Bearer
<CRON_SECRET>` (no JWT) returns 401 instead of running the grant.

### Pitfall 2: Deleting the bypass unconditionally, contradicting CRED-05's "off by default"
**What goes wrong:** If Pattern 1's deletion is applied literally (bypass code physically removed,
full stop) at the same time the migration ships, premium users are capped in production the moment
this phase's code deploys — before Phase 6 explicitly flips the flag. This breaks CRED-05's
decoupling requirement even though D-03 says "delete the bypass."
**Why it happens:** D-03 and D-05 read as being in tension (delete vs. keep-behind-a-flag) unless
read together — D-03 is about *implementation style* (no tier-branching bypass), D-05 is about
*rollout control* (the new behavior must be flag-gated).
**How to avoid:** Implement per Pattern 3 — the surviving conditional in `creditGate.ts` checks the
flag, not `tier`. When the flag is `false` (the shipped default), the observable behavior is
identical to today's bypass; when `true`, the code path is exactly what D-03 describes. This is not
tier-branching (the thing D-03 rejects) because the branch never inspects `tier` — it inspects the
flag, and the "premium gets more" property still comes entirely from balance size, not gate logic.
**Warning signs:** A production premium user's AI calls start returning 402 immediately after this
phase's deploy, before Phase 6 has run.

### Pitfall 3: Ledger idempotency key collision on the composite unique index
**What goes wrong:** The monthly grant silently no-ops (or worse, silently double-grants) because the
new RPC's `INSERT` doesn't align with the exact columns the partial unique index constrains.
**Why it happens:** `idx_credit_tx_idempotency` is on `(user_id, source, idempotency_key)`, not
`(user_id, idempotency_key)` — a caller that supplies an idempotency key but a different or `NULL`
`source` value on a re-run will not collide with the first run's row, breaking the "cron re-run
mid-month cannot double-grant" guarantee.
**How to avoid:** Fix `source` to a constant literal (e.g. `'premium_grant'`) in every call the new
RPC makes, paired with the month-scoped idempotency key.
**Warning signs:** `SELECT count(*) FROM ai_credit_transactions WHERE type='premium_grant' AND
user_id = X` returning more than 1 row for the same calendar month after a cron re-run.

### Pitfall 4: Comparing `app_config.value` (JSONB) to a JS string
**What goes wrong:** `config?.value === 'true'` is always `false` because the Supabase JS client
deserializes a JSONB boolean scalar to the native JS `true`/`false`, not a string.
**Why it happens:** Every other config-like value already seeded in `app_config`
(`waitlist_reveal_threshold: '30'`, `waitlist_retention_years: '3'`) happens to be read via
`(value::text)::INTEGER` inside SQL (see `get_waitlist_founder_status()`), which masks this trap for
those keys — the boolean case behaves differently client-side.
**How to avoid:** Insert the flag as JSONB `false`/`true` literal (bare, unquoted, in the SQL
`INSERT`), and compare with `=== true` in TypeScript, or cast explicitly.
**Warning signs:** The flag appears to never flip on, even after an `UPDATE app_config SET
value='true' WHERE key='premium_credit_cap_enabled'`.

### Pitfall 5: Forgetting the stale-comment sweep alongside the code deletion
**What goes wrong:** `creditGate.ts` ships with the bypass logic removed but comments at lines
17-18, 44, 47, 121, 133-138 (all verified present this session, unchanged from the 2026-08-12
research) still describe "PREM-02: premium users bypass entirely" — future readers (including a future
AI agent) trust the stale comment over the actual code.
**How to avoid:** Treat the comment sweep as part of the same commit/task as the code deletion, not a
follow-up. `ARCHITECTURE.md` §4 already lists the exact line numbers to touch.
**Warning signs:** `grep -n "PREM-02\|premium bypass" backend/api/src/middleware/creditGate.ts`
returns any hit after this phase ships.

## Code Examples

### Migration skeleton (new file, additive only, matches house idiom)

```sql
-- Source: composed from verified patterns in 026_ai_credits.sql and 20260812_waitlist_founder_offer.sql
-- (both read this session) — this is a skeleton for the planner, not a final migration.

-- 1. Lifetime-premium provenance flag (CRED-04)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_lifetime_premium BOOLEAN NOT NULL DEFAULT false;

-- 2. Feature flag seed (CRED-05) — reuses Phase 1's app_config table, additive INSERT only
INSERT INTO public.app_config (key, value)
VALUES ('premium_credit_cap_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 3. Monthly grant RPC (CRED-03), mirrors deduct_ai_credits's SECURITY DEFINER shape
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

REVOKE EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) TO service_role;
```

**Note on the `REVOKE`/`GRANT` idiom:** every RPC shipped in Phase 1 (`20260812_waitlist_founder_offer.sql`, read this session) explicitly documents that a `PUBLIC`-only revoke is insufficient on this
Supabase project — `ALTER DEFAULT PRIVILEGES` on schema `public` grants `EXECUTE` to `anon`/
`authenticated` directly at `CREATE FUNCTION` time, so the revoke must name `anon` and `authenticated`
explicitly (`REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;`), not just `PUBLIC`.
This same finding is independently recorded in `STATE.md`'s blockers section as a live production
issue affecting three *other* functions — confirming it is real and current, not a one-off note. The
new `grant_premium_credits()` RPC must use the three-role revoke form, not the two-role form
`026_ai_credits.sql` used (that migration predates the discovery and is a known, separately-tracked
gap in older functions — do not copy its shorter revoke as a model for new code).

### `credits.ts` config constant

```typescript
// Source: backend/api/src/config/credits.ts convention (read this session) — new constant, additive
export const PREMIUM_MONTHLY_GRANT = 300; // D-02 — ~10x a fully-engaged free user's chat volume
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `tier==='premium'` unconditional AI bypass | `tier` only funds a larger monthly balance; gate logic is tier-agnostic | This phase | CGU/CGV (Phase 3, live) can now truthfully state AI credits are capped for every tier including premium |
| No feature-flag mechanism for backend-only policy changes | `app_config` table (Phase 1), read via service-role direct SELECT | Phase 1, reused here | Decouples deploy from activation for any future backend policy change, not just this one |

**Deprecated/outdated:** the `tier` column comment at `026_ai_credits.sql:182` ("Enables premium
bypass in Phase 18") becomes stale prose the moment this phase ships. Per house rule, do not edit
that existing migration file — the new migration's own header comment should note the behavior
change, matching the precedent already set by `20260815_waitlist_retention_config.sql`'s header
comment style.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cron schedule `0 0 1 * *` (monthly, 1st of month, midnight UTC) is an acceptable schedule for the premium grant | Pattern 4 / Code Examples | Low — Claude's Discretion per CONTEXT.md; a wrong schedule just delays/advances the grant timing, does not break correctness (idempotency key is month-scoped regardless of exact day/hour) |
| A2 | `premium_credit_cap_enabled` is an acceptable flag key name | User Constraints (Claude's Discretion) | None — explicitly discretionary in CONTEXT.md |
| A3 | Separate-file cron router (`credits-cron.ts`) is preferable to the same-file `forms.ts`-style export | Pattern 4 | Low — both are verified, real house patterns; either satisfies CRED-05/CRED-03 equally, this is a stylistic recommendation only |

**All other claims in this research were verified this session by reading the actual source files**
(`creditGate.ts`, `creditService.ts`, `credits.ts`, `notifications-cron.ts`, `forms.ts` via `app.ts`
imports, `026_ai_credits.sql`, `20260812_waitlist_founder_offer.sql`, `20260815_waitlist_retention_config.sql`,
`app.ts`, `vercel.json`, `branding/page.tsx`, mobile `settings.tsx`) or cited from the already-approved
CONTEXT.md decisions — not carried forward from training data.

## Open Questions

1. **Should the feature-flag check in `creditGate.ts` short-circuit before or after the
   `user_profiles.tier` read?**
   - What we know: today the `tier` read happens first (it's the entire point of the current bypass).
     Once flag-gated, the flag read could happen first (cheaper — skip the `tier` query entirely when
     the flag is off) or the `tier` read could stay first (simpler diff, `tier` read is unconditional
     either way since free-quota/balance logic needs to distinguish premium's *balance size* — actually
     it does not, since the balance itself is what differs, not gate logic; `tier` may not need to be
     read in the gate at all once the design is fully flag-driven).
   - What's unclear: whether `creditGate.ts` needs to read `tier` at all after this phase, given that
     the balance is now the only thing distinguishing premium users, and balance-checking is already
     tier-agnostic.
   - Recommendation: the planner should re-examine whether the `.select('tier')` query in `creditGate.ts`
     can be deleted entirely (not just the `if` branch) once the flag is the only conditional — this
     would be a larger, cleaner win than Pattern 3 as drafted, but changes the shape of Pitfall 2's flag
     check (the flag alone, no `tier` lookup, gates old-vs-new behavior). Worth a checkpoint at plan
     time rather than deciding here, since it interacts with exactly how "old bypass behavior, preserved
     while flag is false" is implemented.

## Environment Availability

Skipped — this phase has no new external tool/service dependencies. `CRON_SECRET`,
`SUPABASE_SERVICE_KEY`/`SUPABASE_PUBLISHABLE_KEY`, and Vercel Cron are already configured and in
active production use by six other cron jobs in this same `vercel.json` and `backend/api` codebase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x [CITED: backend/api/package.json — `"test": "vitest run --passWithNoTests"`, read this session] |
| Config file | `backend/api/vitest.config.ts` (verified this session — `include: ['test/**/*.{spec,test}.ts', 'src/**/*.test.ts']`, `fileParallelism: false`) |
| Quick run command | `cd backend/api && npx vitest run src/middleware/creditGate.test.ts` (new file — none exists yet) |
| Full suite command | `cd backend/api && npm test` |

No existing test file covers `creditGate.ts` or `creditService.ts` (verified this session — no
`*.test.ts` matches for `credit` under `backend/api/src/`). The closest precedent for mocking a Hono
router + `@supabase/supabase-js` + service module is `backend/api/src/coach/videos/service.test.ts`
(read this session) — it mocks `../../middleware/auth.js`, a local `db.js`, and `@supabase/supabase-js`
via `vi.mock`, then drives the Hono app with constructed `Request` objects. The same shape applies to
testing `creditCheck`/`creditDeduct`: mock `@supabase/supabase-js`'s `createClient` to control both the
`user_profiles.tier` and `app_config` reads, and mock `creditService` to control `getQuotaStatus`/
`deductCredits` return shapes.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-01 | Production count re-verification returns 0 (or escalates if not) | manual/scripted one-off | `SELECT count(*) FROM public.user_profiles WHERE tier='premium';` run against production via Supabase MCP or SQL editor | N/A — planning-time check, not a repo test |
| CRED-02 | Premium user with flag=true and balance=0 gets 402, same as a free user | unit | `npx vitest run src/middleware/creditGate.test.ts -t "premium user exhausted balance"` | ❌ Wave 0 |
| CRED-03 | Premium user's monthly grant RPC adds exactly `PREMIUM_MONTHLY_GRANT` and is idempotent on re-run same month | unit (mocked RPC) + integration (real RPC via `test:rls`-style harness) | `npx vitest run src/services/creditService.test.ts -t "grantMonthlyPremiumCredits"` | ❌ Wave 0 |
| CRED-04 | `is_lifetime_premium` column exists, defaults false, is never written by any Phase 4 code path | schema smoke test | `SELECT column_name FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_lifetime_premium';` | ❌ Wave 0 (or covered by RLS/schema suite) |
| CRED-05 | Flag defaults false; behavior with flag=false matches pre-phase bypass exactly; behavior with flag=true enforces balance | unit | `npx vitest run src/middleware/creditGate.test.ts -t "feature flag"` | ❌ Wave 0 |
| CRED-06 | `branding/page.tsx`'s `isPro` check is untouched and still reads `tier` the same way | manual code diff review | `git diff apps/web/src/app/'[locale]'/'(coach)'/coach/branding/page.tsx` (expect empty) | N/A — negative-change check, not a runnable test |

### Sampling Rate
- **Per task commit:** `cd backend/api && npx vitest run src/middleware/creditGate.test.ts src/services/creditService.test.ts`
- **Per wave merge:** `cd backend/api && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`; additionally, a manual production
  re-verification of the CRED-01 count (see Sampling table above) before the bypass-deletion task runs,
  not merely before the phase starts.

### Wave 0 Gaps
- [ ] `backend/api/src/middleware/creditGate.test.ts` — covers CRED-02, CRED-05 (new file, no
      existing coverage of `creditGate.ts` at all)
- [ ] `backend/api/src/services/creditService.test.ts` — covers CRED-03's grant wrapper (new file;
      `creditService.ts` currently has zero direct unit tests — verified via grep this session)
- [ ] No framework install needed — Vitest is already configured and used across `backend/api`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No — unchanged | `authMiddleware` already gates every `/ai/*` route upstream of `creditGate.ts`; this phase does not touch authentication |
| V3 Session Management | No | Unaffected |
| V4 Access Control | Yes | The new `grant_premium_credits()` RPC must use the three-role `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;` idiom (see Code Examples note) — granting only to `service_role`, matching every Phase-1 RPC and closing the exact default-privilege gap `STATE.md` already flags as live on three *other* functions in this project |
| V5 Input Validation | Marginal | The cron route takes no client-controlled input beyond the `CRON_SECRET` header; the grant RPC's `p_amount` is always the constant `PREMIUM_MONTHLY_GRANT`, never client-supplied, so no injection/validation surface is introduced |
| V6 Cryptography | No | `CRON_SECRET` comparison is a plain string equality check, matching the existing pattern in 6 other cron routes — no new crypto primitive introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cron endpoint invoked without a valid `CRON_SECRET`, triggering an out-of-schedule or attacker-driven mass grant | Elevation of Privilege | `verifyCronSecret()` check before any DB work, mirrored from `notifications-cron.ts`; RPC itself is `service_role`-only so even a leaked route path cannot be called by `anon`/`authenticated` |
| A second concurrent cron invocation (e.g. Vercel retry) double-granting a user in the same month | Tampering (integrity of ledger) | The month-scoped idempotency key + partial unique index on `(user_id, source, idempotency_key)` — the RPC's `ON CONFLICT DO NOTHING` makes a re-run a safe no-op, not a double-credit |
| The `PUBLIC`-default-privilege gap already live on `is_coach_of()`/`redeem_invitation_code()`/`peek_invitation()` (per `STATE.md`) being silently reproduced on the new `grant_premium_credits()` RPC | Elevation of Privilege | Explicit three-role `REVOKE ... FROM PUBLIC, anon, authenticated` on the new function, as Phase 1's migrations already do — do not copy the two-role revoke pattern from the older `026_ai_credits.sql` functions |

## Sources

### Primary (HIGH confidence — files read directly in this worktree this session)
- `backend/api/src/middleware/creditGate.ts` — full file, confirms bypass unchanged at lines 53-63
- `backend/api/src/services/creditService.ts` — full file, wrapper shapes for the new grant function
- `backend/api/src/config/credits.ts` — full file, constant convention
- `backend/api/src/routes/credits.ts` — full file, confirms `router.use('*', authMiddleware)` scope
- `backend/api/src/routes/notifications-cron.ts` — full file, `verifyCronSecret` + cron router shape
- `backend/api/src/app.ts` (grep) — confirms dual-mount pattern for `/notifications` and `/forms`
- `backend/api/src/coach/videos/service.test.ts` — Hono route unit-test mocking pattern
- `backend/api/vitest.config.ts` — test framework config
- `backend/api/vercel.json` — full file, 7 existing cron entries
- `supabase/migrations/026_ai_credits.sql` — full file, `deduct_ai_credits`, CHECK constraint, idempotency index
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — full file, confirms `app_config` schema and every Phase-1 RPC's revoke idiom
- `supabase/migrations/20260815_waitlist_retention_config.sql` — full file, confirms `app_config` read/write pattern for a second key
- `apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx` — full file, confirms `isPro`/`tier` read is independent of the credit path (CRED-06)
- `apps/mobile/app/(app)/profile/settings.tsx` (grep + targeted read) — confirms the mobile `PREMIUM`/`FREE` badge reads `subscription_tier`, a different column, not `user_profiles.tier`
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` §4, §5 — prior milestone-level research, re-verified against current code this session
- `.planning/workstreams/lien-invite/phases/04-credit-gate-alignment/04-CONTEXT.md` — locked decisions D-01 through D-04
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` D-08 — `app_config`'s origin and Phase 4 coupling
- `.planning/workstreams/lien-invite/ROADMAP.md` — Phase 4 goal, success criteria, drift-correction note confirming Phase 1 does NOT ship `is_lifetime_premium`/`grant_premium_credits()`
- `.planning/workstreams/lien-invite/STATE.md` — CRED-01 blocker status, live production default-privilege gap on three other RPCs
- `npm view @supabase/supabase-js version` / `npm view hono version` — version currency check this session

### Secondary (MEDIUM confidence)
- None — no web-sourced claims were needed for this phase; it is a pure in-repo integration task.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, versions confirmed against npm registry this session
- Architecture: HIGH — every pattern grounded in files read this session, cross-checked against the prior milestone research and found unchanged
- Pitfalls: HIGH — Pitfall 1 (cron router scoping) and Pitfall 3 (idempotency index columns) are net-new findings from this session's direct file reads, not carried from the 2026-08-12 research; Pitfalls 2, 4, 5 are directly grounded in verified code/schema

**Research date:** 2026-08-16
**Valid until:** 2026-09-15 (30 days — stable, in-repo integration domain; re-verify `creditGate.ts` line numbers and `app_config`/migration state if execution slips past this window, since the file has already moved once relative to the original 2026-08-12 research despite line numbers holding)
