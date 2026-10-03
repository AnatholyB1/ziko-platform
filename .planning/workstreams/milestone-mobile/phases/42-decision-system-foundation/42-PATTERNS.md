# Phase 42: Decision-System Foundation - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 4 new files (3 migrations + 1 test spec; a 4th test spec is optional per CONTEXT.md's discretion note)
**Analogs found:** 4 / 4

This phase is pure backend/schema work — no application code. RESEARCH.md already named the exact analog files; this document verifies each is real, extracts concrete excerpts (line numbers), and resolves which analog wins where two exist for the same concern (older vs. newer GRANT/REVOKE convention).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<ts>_athlete_state.sql` | migration (table + RLS) | CRUD (current-state row) | `supabase/migrations/026_ai_credits.sql` (table shape) + `supabase/migrations/20260813182644_waitlist_founder_offer.sql` (RLS deny-all posture) | exact (composite) |
| `supabase/migrations/<ts>_athlete_decisions.sql` | migration (table + RLS) | event-driven (append-only journal) | `supabase/migrations/026_ai_credits.sql` (`ai_credit_transactions` ledger table + partial unique index) | exact |
| `supabase/migrations/<ts>_athlete_decisions_rpc.sql` | migration (RPC + GRANT/REVOKE lockdown) | request-response (atomic write gate) | `supabase/migrations/20260818190601_premium_credit_grant.sql` (RPC body shape + REVOKE-by-name) — primary; `supabase/migrations/20260822120000_gamification_economy_rpc.sql` (table-level REVOKE INSERT/UPDATE syntax) — secondary | exact (composite) |
| `backend/api/test/rls/athlete-state.spec.ts` | test (RLS integration) | request-response | `backend/api/test/rls/coach-rls.spec.ts` (RLS-deny assertion style) + `backend/api/test/rls/premium-grant-rpc.spec.ts` (RUN_DB guard, admin-vs-anon-vs-authenticated RPC matrix) | exact (composite) |
| `backend/api/test/rls/athlete-decisions.spec.ts` (optional per CONTEXT.md discretion) | test (RLS integration) | request-response | `backend/api/test/rls/premium-grant-rpc.spec.ts` | exact |
| `backend/api/test/rls/fixtures.ts` | test utility | — | **no change needed** — `getAdminClient()`, `getAnonClient()`, `getAuthedClient()`, `createTestUser()`, `cleanupTestUsers()` already cover every fixture this phase's specs require (confirmed by direct read, see below) | n/a (reuse, not modify) |

## Pattern Assignments

### `supabase/migrations/<ts>_athlete_state.sql` (migration, CRUD current-state)

**Primary analog:** `supabase/migrations/026_ai_credits.sql` (table shape, trigger)
**RLS-posture analog:** `supabase/migrations/20260813182644_waitlist_founder_offer.sql` (why zero write policies, not `USING(false)`)

**Table shape pattern** (`026_ai_credits.sql` lines 12-27):
```sql
CREATE TABLE IF NOT EXISTS public.user_ai_credits (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_ai_credits_own" ON public.user_ai_credits
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- updated_at trigger (reuses handle_updated_at from migration 001)
CREATE TRIGGER trg_user_ai_credits_updated
  BEFORE UPDATE ON public.user_ai_credits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```
Note: `athlete_state` must **not** copy the `USING/WITH CHECK` write-permissive policy above verbatim — per D-06/D-07 it needs SELECT-only (see next excerpt). The `PRIMARY KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` shape and the `updated_at` trigger wiring are exactly what to copy.

**`handle_updated_at()` trigger function already exists — do not redefine it** (`supabase/migrations/001_initial_schema.sql` lines 224-234):
```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```
Just attach a new `CREATE TRIGGER trg_athlete_state_updated ... EXECUTE FUNCTION public.handle_updated_at();` — the function is global and already shipped.

**SELECT-only RLS pattern (what to copy for `athlete_state`)** — no existing table in this codebase does SELECT-only RLS with an explicit `CREATE POLICY`; the closest precedent is `waitlist_signups`' deny-all-with-zero-policies idiom (`20260813182644_waitlist_founder_offer.sql` lines 41-44):
```sql
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO CREATE POLICY statements (DATA-05). Deny-all + RPC-door idiom,
-- matching user_ai_credits / coach_client_links. No GRANT to anon or authenticated anywhere below.
```
`athlete_state`/`athlete_decisions` differ from this precedent in one respect: they need a real `CREATE POLICY ... FOR SELECT` (athletes must read their own row), not zero policies — RESEARCH.md's drafted shape is correct:
```sql
CREATE POLICY "athlete_state_select_own" ON public.athlete_state
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
```
Note the `FOR SELECT` command restriction — this is the detail that distinguishes it from `026_ai_credits.sql`'s `user_ai_credits_own` policy (which has no `FOR` clause, meaning it applies to ALL commands). Omitting `FOR SELECT` here would silently re-open write access via RLS's default WITH CHECK-less permissiveness on other commands — always include the explicit `FOR SELECT`.

---

### `supabase/migrations/<ts>_athlete_decisions.sql` (migration, event-driven append-only journal)

**Analog:** `supabase/migrations/026_ai_credits.sql` lines 33-57 (`ai_credit_transactions`)

**Ledger table + partial-unique-index idempotency pattern:**
```sql
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('deduct', 'earn', 'welcome', 'daily_base', 'monthly_base', 'admin_adjust', 'premium_grant')),
  amount           INTEGER NOT NULL,
  source           TEXT,
  idempotency_key  TEXT,
  balance_after    INTEGER,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency constraint — prevents double-crediting on mobile retry
-- Partial index: only constrain rows that carry an idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency
  ON public.ai_credit_transactions (user_id, source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON public.ai_credit_transactions (user_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_transactions_own" ON public.ai_credit_transactions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```
For `athlete_decisions`: copy the `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, the `user_id ... REFERENCES auth.users(id) ON DELETE CASCADE`, the `CREATE INDEX ... (user_id, created_at DESC)` (needed for the bounded-window read: `ORDER BY created_at DESC LIMIT 4`), and the partial-unique-index idempotency shape (apply it to `(user_id, decision_type, week_of) WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL` per RESEARCH.md's Pattern 2). Replace the RLS policy with `FOR SELECT`-only per D-06 (same substitution as `athlete_state` above) — `ai_credit_transactions_own` here is the write-permissive shape to explicitly deviate from, not copy.

---

### `supabase/migrations/<ts>_athlete_decisions_rpc.sql` (migration, RPC + GRANT lockdown)

**Primary analog (RPC body shape, idempotency-before-mutation ordering):** `supabase/migrations/20260818190601_premium_credit_grant.sql` lines 25-101

**Secondary analog (table-level REVOKE INSERT/UPDATE syntax — this is the piece the primary analog doesn't need, since credits are gated by RPC alone, not also table-locked from `authenticated`):** `supabase/migrations/20260822120000_gamification_economy_rpc.sql` lines 164-177

**RPC skeleton to copy from (`20260818190601_premium_credit_grant.sql` lines 25-91):**
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
  v_idempotency_key TEXT := 'premium_grant_' || to_char(now(), 'YYYY-MM');
  v_rows             INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'invalid_amount');
  END IF;

  INSERT INTO public.ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  VALUES (p_user_id, 'premium_grant', p_amount, 'premium_grant', v_idempotency_key)
  ON CONFLICT (user_id, source, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'duplicate');
  END IF;

  INSERT INTO public.user_ai_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_ai_credits
  SET balance    = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('granted', true, 'amount', p_amount);
END;
$$;
```
Directly applicable lessons for `record_athlete_decision()`: (1) validate/guard first, return an error-shaped JSONB rather than raising, before touching any table (RESEARCH.md's `evidence_required` check should be the first statement, mirroring the `invalid_amount` check here); (2) `SET search_path = public, pg_temp` on every new function — copy verbatim; (3) `INSERT ... ON CONFLICT DO NOTHING` to self-heal a missing parent row (`user_ai_credits`/here `athlete_state`) before the `UPDATE`, exactly as RESEARCH.md's drafted RPC already does.

**GRANT/REVOKE lockdown for the RPC's `EXECUTE`** (`20260818190601_premium_credit_grant.sql` lines 93-101 — copy this exactly, only the function name/signature changes):
```sql
-- This project's `ALTER DEFAULT PRIVILEGES` on schema public grants EXECUTE
-- to anon/authenticated directly at CREATE FUNCTION time — a grant separate
-- from PUBLIC that a PUBLIC-only REVOKE never removes (see STATE.md's
-- open blocker on is_coach_of()/redeem_invitation_code()/peek_invitation(),
-- and 20260812_waitlist_founder_offer.sql's identical note). anon and
-- authenticated must therefore be revoked explicitly, by name, on every
-- new function — this one included.
REVOKE EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium_credits(UUID, INTEGER) TO service_role;
```
For `record_athlete_decision(...)`, the REVOKE list must additionally **not** include `service_role` here (the function's own `EXECUTE` grant goes only to `service_role` in the first place — this REVOKE just blocks `PUBLIC`/`anon`/`authenticated` from calling it, which mirrors this analog exactly, no change needed).

**Table-level `REVOKE INSERT/UPDATE ... FROM authenticated[, service_role]`** — this project's only existing precedent for this technique is `authenticated`-only (`20260822120000_gamification_economy_rpc.sql` lines 164-177):
```sql
-- ── Lock down direct client writes ──────────────────────────────────
-- RLS is row-level only; column-level restriction needs GRANT/REVOKE.
-- SECURITY DEFINER functions above bypass this (they run as the function
-- owner), so the RPCs keep working after the revoke.

REVOKE INSERT, UPDATE ON public.user_gamification FROM authenticated;
GRANT UPDATE (equipped_title, equipped_badge, equipped_banner_name, equipped_theme)
  ON public.user_gamification TO authenticated;

REVOKE INSERT ON public.xp_transactions FROM authenticated;
```
**This phase's REVOKE must extend the role list to `authenticated, service_role`** — no existing precedent revokes from `service_role`, this is genuinely new (per D-06/RESEARCH.md's explicit finding that `BYPASSRLS` does not exempt `service_role` from table-level GRANT checks). Apply the same `REVOKE` syntax/comment style, just widen the role list:
```sql
REVOKE INSERT ON public.athlete_decisions FROM authenticated, service_role;
REVOKE UPDATE ON public.athlete_state FROM authenticated, service_role;
```
Also copy the explicit-by-name discipline demonstrated in the "why PUBLIC alone fails" comment block from `20260813182644_waitlist_founder_offer.sql` lines 86-92 — reuse verbatim as a header comment in this migration file since it documents a project-specific gotcha this exact migration must not repeat:
```sql
-- REVOKE FROM PUBLIC alone is NOT sufficient on this project: ALTER DEFAULT PRIVILEGES
-- for schema public grants EXECUTE to anon/authenticated/service_role directly at
-- CREATE FUNCTION time (verified live — this also affects is_coach_of() /
-- redeem_invitation_code() / peek_invitation(), a pre-existing gap outside this phase's
-- scope). PUBLIC-only revoke never touches an already-materialized per-role grant, so
-- anon/authenticated must be revoked explicitly, by name, on every new function.
```

---

### `backend/api/test/rls/athlete-state.spec.ts` (test, RLS integration)

**Primary analog (RUN_DB guard + admin/anon/authenticated RPC matrix):** `backend/api/test/rls/premium-grant-rpc.spec.ts` lines 1-14, 148-162
**Secondary analog (RLS own-vs-cross-read assertion style):** `backend/api/test/rls/coach-rls.spec.ts` lines 62-79, 256-263

**RUN_DB guard — copy verbatim** (`premium-grant-rpc.spec.ts` lines 10-14):
```typescript
// Load-bearing guard: the root CI `verify` job runs the backend suite with the
// production Supabase secrets. This spec creates users and mutates credit
// balances, so it must never run there. See waitlist-config-rpc.spec.ts for
// the same pattern.
const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;
```
Wrap the whole `describe` in `describe.skipIf(!RUN_DB)(...)`.

**Imports pattern** (`premium-grant-rpc.spec.ts` lines 7-8):
```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';
```

**Role-matrix RPC test (the load-bearing D-06 assertion — this is the shape to copy for `record_athlete_decision`)** (`premium-grant-rpc.spec.ts` lines 148-162):
```typescript
it('the anon client gets an error; the authenticated client gets an error; the admin client succeeds', async () => {
  const user = await createTestUser('premium-grant-role-check');
  createdUserIds.push(user.id);

  const anon = getAnonClient();
  const anonResult = await anon.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
  expect(anonResult.error).not.toBeNull();

  const authedResult = await user.client.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
  expect(authedResult.error).not.toBeNull();

  const adminResult = await admin.rpc('grant_premium_credits', { p_user_id: user.id, p_amount: GRANT_AMOUNT });
  expect(adminResult.error).toBeNull();
  expect(adminResult.data.granted).toBe(true);
});
```
For `athlete_state`, adapt this to also prove the **table-level REVOKE**, not just the RPC's `EXECUTE` grant — this second assertion has no existing precedent test in this codebase (it is new to this phase, per D-06's admin-write-block requirement) and must be added net-new, following the same admin-client-attempts-a-direct-write shape already drafted in RESEARCH.md's Code Examples section:
```typescript
it('service-role (admin) client ALSO cannot UPDATE athlete_state directly (D-06 — the load-bearing case)', async () => {
  const user = await createTestUser('athlete-service-write-block');
  const admin = getAdminClient(); // uses SUPABASE_SERVICE_ROLE_KEY — BYPASSRLS, but NOT bypass-GRANT
  await admin.from('athlete_state').insert({ user_id: user.id });

  const result = await admin.from('athlete_state').update({ level: 99 }).eq('user_id', user.id);
  expect(result.error).not.toBeNull(); // proves table REVOKE, not just RLS, is in effect

  await cleanupTestUsers([user.id]);
});
```

**Own-read vs. cross-read assertion style** (`coach-rls.spec.ts` lines 62-70, adapt `coach.client`/`linkedClient.id` to two independent athlete test users with no coach relationship at all — `athlete_state` RLS has nothing analogous to the coach-link condition, it's a plain `auth.uid() = user_id` check):
```typescript
it('linked client: coach reads habit_logs → rows returned (case 1, 22-03-01)', async () => {
  const { data, error } = await coach.client
    .from('habit_logs')
    .select('id')
    .eq('user_id', linkedClient.id);
  expect(error).toBeNull();
  expect(data?.length).toBeGreaterThan(0);
});
```
And the RLS-silently-filters-not-errors idiom for cross-user SELECT (`coach-rls.spec.ts` line 78 pattern: `expect(data?.length ?? 0).toBe(0)` with `error` still `toBeNull()`) — this is the correct assertion shape for "athlete A cannot read athlete B's row," distinct from the permission-denied-error shape used for blocked writes.

---

### `backend/api/test/rls/fixtures.ts` — no changes needed

**Full file already read** (`backend/api/test/rls/fixtures.ts`, 63 lines) — confirms every fixture RESEARCH.md's Wave 0 gap analysis assumed is present:
- `getAdminClient()` (lines 17-21) — `service_role`-keyed client, `autoRefreshToken: false`
- `getAnonClient()` (lines 23-27) — publishable-key client
- `getAuthedClient(email, password)` (lines 29-34) — signs in and returns a session-scoped client
- `createTestUser(prefix)` (lines 36-53) — creates via `admin.auth.admin.createUser`, returns `{ id, email, password, client }`
- `cleanupTestUsers(userIds)` (lines 55-62) — `admin.auth.admin.deleteUser(id)` per id; relies on FK `ON DELETE CASCADE` from `auth.users` to wipe dependent rows — **this means `athlete_state`/`athlete_decisions` MUST use `REFERENCES auth.users(id) ON DELETE CASCADE`** (matching every other per-user table in this codebase) or `cleanupTestUsers` will leave orphaned rows after a test run.

No new fixture file or export is needed for this phase's specs.

## Shared Patterns

### DB-level write lockdown (the phase's core cross-cutting concern)
**Source:** `supabase/migrations/20260822120000_gamification_economy_rpc.sql` lines 164-177 (table REVOKE syntax) + `supabase/migrations/20260818190601_premium_credit_grant.sql` lines 93-101 (function REVOKE syntax)
**Apply to:** Both `athlete_state` and `athlete_decisions` migrations, and the RPC migration.
```sql
REVOKE INSERT ON public.athlete_decisions FROM authenticated, service_role;
REVOKE UPDATE ON public.athlete_state FROM authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_athlete_decision(
  UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_athlete_decision(
  UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB
) TO service_role;
```

### ALTER DEFAULT PRIVILEGES gotcha — explicit-by-role REVOKE, never `PUBLIC`-only
**Source:** `supabase/migrations/20260813182644_waitlist_founder_offer.sql` lines 86-92, `supabase/migrations/20260818190601_premium_credit_grant.sql` lines 93-99
**Apply to:** Every `REVOKE EXECUTE` statement in the RPC migration file — always name `PUBLIC, anon, authenticated` explicitly, never rely on a bare `REVOKE ... FROM PUBLIC`.

### `updated_at` trigger reuse
**Source:** `supabase/migrations/001_initial_schema.sql` lines 224-230 (`handle_updated_at()` — already exists, do not redefine)
**Apply to:** `athlete_state` migration only (`athlete_decisions` is append-only/immutable, no `updated_at` mutation ever occurs on it post-insert).

### RLS SELECT-only, no write policy at all
**Source:** No exact precedent exists for "real SELECT policy + zero write policies" in this codebase yet — `waitlist_signups` has zero policies of any kind (deny-all-including-select, `20260813182644_waitlist_founder_offer.sql` lines 41-44); `user_ai_credits`/`ai_credit_transactions` have a single ALL-commands `USING/WITH CHECK` policy (`026_ai_credits.sql` lines 19-22, 54-57). This phase is the **first** instance combining "athlete can read their own row" with "no client of any kind, including service_role, can write it" — RESEARCH.md's drafted `CREATE POLICY ... FOR SELECT USING (...)` is correct and has no closer analog to defer to; use it as written.
**Apply to:** Both `athlete_state` and `athlete_decisions`.

### RLS integration test structure (RUN_DB gate + admin/anon/authenticated role matrix)
**Source:** `backend/api/test/rls/premium-grant-rpc.spec.ts` (full file pattern) and `backend/api/test/rls/waitlist-config-rpc.spec.ts` lines 1-14
**Apply to:** `athlete-state.spec.ts` (and `athlete-decisions.spec.ts` if built this phase per CONTEXT.md's discretion note).

## No Analog Found

None. Every file this phase needs has at least one exact analog in the codebase (RESEARCH.md's own analog list was verified accurate by direct read — all four referenced migration files and both referenced test files exist exactly as named, with line numbers as cited above).

## Metadata

**Analog search scope:** `supabase/migrations/*.sql` (83 files, globbed), `backend/api/test/rls/*.ts` (12 files, globbed)
**Files read in full or in targeted excerpt:** `026_ai_credits.sql`, `20260822120000_gamification_economy_rpc.sql`, `20260813182644_waitlist_founder_offer.sql`, `20260818190601_premium_credit_grant.sql`, `007_gamification_schema.sql` (targeted excerpt, anti-pattern), `001_initial_schema.sql` (targeted excerpt, `handle_updated_at()`), `backend/api/test/rls/fixtures.ts` (full), `backend/api/test/rls/coach-rls.spec.ts` (full), `backend/api/test/rls/premium-grant-rpc.spec.ts` (full), `backend/api/test/rls/waitlist-config-rpc.spec.ts` (targeted excerpt, RUN_DB guard)
**Pattern extraction date:** 2026-08-31
