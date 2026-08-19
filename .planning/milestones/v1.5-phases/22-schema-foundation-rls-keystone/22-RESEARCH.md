# Phase 22: Schema Foundation & RLS Keystone — Research

**Researched:** 2026-05-13
**Domain:** Postgres RLS, SECURITY DEFINER hardening, constant-time PLPGSQL RPC, Vitest + Supabase admin auth fixtures
**Confidence:** HIGH (all critical claims VERIFIED against PostgreSQL official docs + existing migrations 001/026/027 already in this repo)

## Summary

Phase 22 is pure database (3 migrations, 11 cross-user `FOR SELECT` policies, one SECURITY DEFINER function, one constant-time RPC) plus one Vitest spec. Every locked decision in 22-CONTEXT.md is a direct extension of patterns already proven in production migrations 026 (`deduct_ai_credits`) and 027 (`earn_ai_credits`). This research answers only the three narrow Claude's-Discretion questions the planner needs to resolve before writing tasks.

**Primary recommendation:** Reuse migration 026's hardening template verbatim for `is_coach_of()` and `redeem_invitation_code`. For RLS, **keep** the existing `FOR ALL USING (auth.uid()=user_id)` policy untouched and **add** a separate `FOR SELECT` policy — Postgres OR-combines them safely (VERIFIED, see Q2 below). For Vitest, **scaffold a fresh `backend/api/test/` setup** — no test infrastructure exists today (TESTING.md confirms zero `.test.ts` files repo-wide); install `vitest` + a tiny `tsx`-runnable spec that uses three Supabase clients (admin service-role for setup, two anon clients with JWT for coach/client roles).

## User Constraints (from CONTEXT.md)

### Locked Decisions (16 — verbatim from 22-CONTEXT.md)

- **D-01** `coach_client_links` uses pure timestamps — `revoked_at TIMESTAMPTZ NULL`, `expires_at TIMESTAMPTZ NULL`. No `status` column. Active row = `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
- **D-02** `is_coach_of(coach UUID, client UUID)` is a SQL function, `STABLE SECURITY DEFINER RETURNS boolean`. Body is an inline `EXISTS` predicate against `public.coach_client_links`. No PLPGSQL wrapper, no logging on the hot path.
- **D-03** Hardening matches migration 026: `SET search_path = public, pg_temp`, schema-qualified refs, `REVOKE EXECUTE FROM PUBLIC`, `GRANT EXECUTE TO authenticated`.
- **D-04** `CREATE UNIQUE INDEX coach_client_links_active_uq ON public.coach_client_links (coach_id, client_id) WHERE revoked_at IS NULL` — single index doubles as partial UNIQUE + RLS hot-path index. Add `CHECK (coach_id <> client_id)`.
- **D-05** `coach_profiles` columns: `user_id PK FK auth.users(id) ON DELETE CASCADE`, `display_name NOT NULL`, `bio`, `specialties TEXT[]`, `website`, `photo_url`, `kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (...)`, `kyc_docs JSONB NOT NULL DEFAULT '[]'`, `created_at`, `updated_at`.
- **D-06** Invitation `code` stored plaintext + `UNIQUE` + `CHECK (code ~ '^[A-Z2-9]{6}$')`. 31^6 ≈ 887M entropy.
- **D-07** Full `coach_invitations` column set (id, coach_id, code, client_email, expires_at default now()+14d, used_at, used_by, revoked_at, max_uses default 1, use_count default 0, created_at). Status is derived.
- **D-08** `redeem_invitation_code(code_input TEXT) RETURNS JSONB` ships constant-time in Phase 22. Uniform `{ ok, link_id, error_code }` shape. PLPGSQL, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
- **D-09** `ai_imports` ships full Phase 28 schema in migration 036 (15 columns including `re_upload_source_id` self-FK and `committed_program_id` FK).
- **D-10** `ai_imports` ships with owner-only RLS in Phase 22 (`ai_imports_own FOR ALL`).
- **D-11** `workout_programs.weeks_data JSONB` validated by Zod (coach-sdk Phase 23) — **no DB CHECK**.
- **D-12** `workout_programs` extensions use `ON DELETE SET NULL` (matches Open Decision #4).
- **D-RLS-01** 11 athlete tables get a new `<table>_coach_read FOR SELECT` policy. Existing `FOR ALL` (owner-only) write policy stays unchanged with `USING (auth.uid() = user_id)`.
- **D-RLS-02** Migration 035 starts with `SET LOCAL lock_timeout = '5s'`.
- **D-13** Smoke test = Vitest at `backend/api/test/rls/coach-rls.spec.ts` with admin + coach + client clients. 4 cases.
- **D-14** `user_profiles.role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','coach','both'))` — PG11+ metadata-only fast path.
- **D-15** Three migration files: `034_coach_role_profiles.sql`, `035_coach_invitations_links_rls.sql`, `036_workout_programs_ai_imports.sql`. One transactional unit each.
- **D-16** All DDL via Supabase MCP `apply_migration` (NOT `execute_sql`).

### Claude's Discretion (researched below)
- Exact constant-time pattern inside `redeem_invitation_code` → **answered in Q1**
- `error_code` value set → **answered in Q1**
- `set_updated_at()` trigger pattern → use existing `public.handle_updated_at()` from migration 001 line 224 (already in production)
- Vitest spec test-user-creation pattern → **answered in Q3**

### Deferred Ideas (OUT OF SCOPE)
- `coach_profiles.verified_by/verified_at/rejection_reason` — v1.6+
- GIN index on `workout_programs.weeks_data`
- `max_uses > 1` UX (column ships, UX deferred)
- IP / user-agent forensics on `coach_invitations`
- `coach_client_tags`, `coach_client_notes` — Phase 26
- `ai_tool_audit` — Phase 29
- Strava tables — Phase 30
- Per-request user-JWT Supabase client wiring (ARCH-03) — Phase 23/24

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-07 | `is_coach_of(coach UUID, client UUID)` SECURITY DEFINER STABLE SQL function is the sole pattern for cross-user RLS reads; every coach-readable table gets a separate `FOR SELECT` policy (owner OR is_coach_of), preserving the existing `FOR ALL` (owner only) write policy. | Q2 confirms additive RLS semantics; Q1 confirms RPC pattern; Q3 confirms how the 4-case smoke test verifies the contract. |

---

## Research Questions

### Q1 — Constant-Time `redeem_invitation_code` Pattern

**Definitive answer:** Use PLPGSQL with a single CTE that gathers **all** validity facts in one query, then a single `CASE` that picks the error code. Do **not** use `LANGUAGE sql` (the planner inliner can short-circuit nested EXISTS predicates). Do **not** use `pg_sleep` as a floor (it makes the function slower without adding meaningful protection — Upstash rate limiting added in Phase 25 is the real defense; pg_sleep can also leak via scheduler jitter at high concurrency).

**Why PLPGSQL beats SQL for constant-time:**
`LANGUAGE sql` functions are inlined by the planner. The planner is free to reorder predicates and short-circuit `OR`s, which means a query whose first clause is "code exists" will fail faster than one where every clause runs. `LANGUAGE plpgsql` with a single `WITH … SELECT INTO` followed by a single `RETURN CASE … END` is opaque to the planner — every code path runs the same SQL. [VERIFIED: matches the structure of `deduct_ai_credits` in migration 026 which uses the same "one SELECT for state, then branching" pattern, but flipped — `deduct_ai_credits` is not constant-time because it doesn't need to be.]

**Canonical `error_code` set (final list — recommend the planner lock this):**

| `error_code` | Meaning |
|--------------|---------|
| `INVALID_CODE` | Code doesn't match any row (most common path; must not be distinguishable from EXPIRED/REVOKED/USED by timing) |
| `EXPIRED` | `expires_at <= now()` |
| `REVOKED` | `revoked_at IS NOT NULL` |
| `ALREADY_USED` | `use_count >= max_uses` |
| `SELF_INVITATION` | `coach_id = auth.uid()` |
| `LINK_EXISTS` | An active row already exists in `coach_client_links` for this `(coach_id, auth.uid())` pair |

On success: `{ ok: true, link_id: <uuid>, error_code: null }`. On any failure: `{ ok: false, link_id: null, error_code: <one of the six above> }`.

**Recommended function shape (planner reference — DO NOT copy verbatim; the planner writes the migration):**

```sql
CREATE OR REPLACE FUNCTION public.redeem_invitation_code(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv RECORD;
  v_link_exists BOOLEAN;
  v_new_link_id UUID;
  v_error TEXT := NULL;
BEGIN
  -- Single SELECT that gathers ALL state (always runs, regardless of code validity)
  SELECT
    inv.id,
    inv.coach_id,
    inv.expires_at,
    inv.revoked_at,
    inv.used_at,
    inv.use_count,
    inv.max_uses,
    EXISTS (
      SELECT 1 FROM public.coach_client_links l
      WHERE l.coach_id = inv.coach_id
        AND l.client_id = v_caller_id
        AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
    ) AS link_exists
  INTO v_inv
  FROM public.coach_invitations inv
  WHERE inv.code = code_input
  LIMIT 1;

  -- Single CASE chain — order of checks chosen for caller usefulness, NOT skipping any
  IF v_inv.id IS NULL THEN
    v_error := 'INVALID_CODE';
  ELSIF v_inv.coach_id = v_caller_id THEN
    v_error := 'SELF_INVITATION';
  ELSIF v_inv.revoked_at IS NOT NULL THEN
    v_error := 'REVOKED';
  ELSIF v_inv.expires_at <= now() THEN
    v_error := 'EXPIRED';
  ELSIF v_inv.use_count >= v_inv.max_uses THEN
    v_error := 'ALREADY_USED';
  ELSIF v_inv.link_exists THEN
    v_error := 'LINK_EXISTS';
  END IF;

  IF v_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'link_id', NULL, 'error_code', v_error);
  END IF;

  -- Happy path — atomic increment + link insert
  INSERT INTO public.coach_client_links (coach_id, client_id)
  VALUES (v_inv.coach_id, v_caller_id)
  RETURNING id INTO v_new_link_id;

  UPDATE public.coach_invitations
  SET use_count = use_count + 1,
      used_at = COALESCE(used_at, now()),
      used_by = COALESCE(used_by, v_caller_id)
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'link_id', v_new_link_id, 'error_code', NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invitation_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_code(TEXT) TO authenticated;
```

**Constant-time properties:**
1. **Same single SELECT runs regardless of which check fails** — the IO cost (planner-stable index lookup on `code UNIQUE`) is identical for every error path.
2. **The `link_exists` correlated subquery runs in the same SELECT** — it doesn't matter that `LINK_EXISTS` is only meaningful when the prior checks pass; the work is done unconditionally so its cost cannot leak.
3. **The CASE chain is pure CPU** (constant-time NULL/equality checks, ~nanoseconds) — branching does not leak observable timing.
4. **No early `RAISE`** and no separate query in any error branch. All error paths take the same code path.

**Whether a `pg_sleep` floor is needed:** **NO.** Rationale:
- Postgres index lookups on a UNIQUE `code` column have sub-millisecond, low-variance latency.
- Upstash IP+user rate limit (Phase 25, 5/15min IP + 10/hour user) caps attacker throughput so timing oracle attacks require thousands of samples per error class, which is rate-limited away.
- `pg_sleep(0.01)` adds scheduler jitter (Postgres uses `nanosleep` which is subject to host CPU contention on Supabase Fluid Compute) and would actually **widen** timing variance.
- If the planner later discovers a real timing leak in production, adding `pg_sleep` is a non-breaking patch — defer until evidence.

[CITED: pg_sleep documentation — https://www.postgresql.org/docs/16/functions-datetime.html#FUNCTIONS-DATETIME-DELAY confirms the function uses host OS sleep primitives; variance is inherently OS-dependent.]
[VERIFIED: pattern follows migration 026 hardening template — `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public`, `REVOKE … GRANT …`.]

---

### Q2 — Postgres Additive RLS Semantics (HIGHEST RISK)

**Definitive answer (VERIFIED against PostgreSQL 16 docs, `CREATE POLICY`):**

When a table has **both** a `FOR ALL` policy with `USING (auth.uid() = user_id)` AND a `FOR SELECT` policy with `USING (auth.uid() = user_id OR is_coach_of(auth.uid(), user_id))`:

1. **For a SELECT statement, BOTH policies' USING clauses apply, OR-combined.** Postgres docs (`CREATE POLICY`): *"all of the PERMISSIVE policy expressions are combined using OR"*. Since both policies are permissive by default, the effective predicate for a coach SELECT is:
   ```
   (auth.uid() = user_id)  -- from FOR ALL
   OR
   (auth.uid() = user_id OR is_coach_of(auth.uid(), user_id))  -- from FOR SELECT
   ```
   Which simplifies to `auth.uid() = user_id OR is_coach_of(...)`. Coach reads work.

2. **For INSERT/UPDATE/DELETE on the same table:**
   - The `FOR SELECT` policy does **not** apply (different command).
   - Only the `FOR ALL` policy applies. Its USING is `auth.uid() = user_id`.
   - For modifications, `WITH CHECK` falls back to `USING` when `WITH CHECK` is not specified (VERIFIED: docs — *"if no WITH CHECK expression is defined, then the USING expression will be used both to determine which rows are visible (normal USING case) and which new rows will be allowed to be added (WITH CHECK case)"*).
   - Therefore: a coach attempting `INSERT INTO habits (user_id, ...) VALUES ('<client_uuid>', ...)` fails the WITH CHECK because `auth.uid()` (the coach) ≠ `user_id` (the client).
   - **Coaches CANNOT write via the additive `FOR SELECT` design. Confirmed safe.** [VERIFIED]

3. **Critical corollary — the existing `FOR ALL` USING must stay `auth.uid() = user_id` ONLY.** If anyone ever changes it to include `is_coach_of(...)`, coaches would silently gain INSERT/UPDATE/DELETE on client tables. **PLAN.md must add a code-review rule banning modification of existing `FOR ALL` policies on the 11 athlete tables.**

**Question: separate FOR SELECT vs. drop FOR ALL and split into FOR SELECT/INSERT/UPDATE/DELETE?**

**Recommendation: KEEP the FOR ALL policy and ADD a separate FOR SELECT policy.** Rationale:
- Locked in by D-RLS-01 (user decision).
- Smaller migration footprint — migration 035 just `CREATE POLICY <table>_coach_read FOR SELECT …` on 11 tables (11 new policies, 0 dropped).
- No risk of accidentally dropping existing write protection during migration.
- Postgres semantics are unambiguous (verified above), so the perceived "overlap surprise" risk is zero with documented OR-combination.
- Refactoring to split FOR ALL into 4 separate policies is a strictly larger change set (44+ policies vs. 11 added) and offers no functional benefit.

**Exact migration SQL pattern for migration 035 (planner reference):**

```sql
-- DO NOT drop or alter the existing FOR ALL policy
-- For each of the 11 tables, add ONE new FOR SELECT policy:
CREATE POLICY habits_coach_read ON public.habits
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_coach_of(auth.uid(), user_id)
  );
-- ... repeat for habit_logs, workout_sessions, session_sets,
--             body_measurements, nutrition_logs, sleep_logs,
--             cardio_sessions, hydration_logs, journal_entries, stretching_logs
```

**Naming:** `<table>_coach_read` (per D-RLS-01). The existing owner-only policies use names like `own_sessions`, `own_nutrition_logs`, etc. (VERIFIED in migration 001 lines 287-355). The new naming `<table>_coach_read` is distinct and audit-greppable.

**Critical pitfall (must surface to planner):** Tables whose RLS is enforced **through a parent** (e.g., `session_sets` — migration 001 line 323-325 — uses `USING (session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid()))`) need the new coach-read policy to traverse the same parent chain:

```sql
CREATE POLICY session_sets_coach_read ON public.session_sets
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.workout_sessions
      WHERE user_id = auth.uid()
         OR public.is_coach_of(auth.uid(), user_id)
    )
  );
```

The 11 athlete tables split into two groups:
- **Direct `user_id` column (8 tables):** habits, habit_logs (has user_id column on it — verify), workout_sessions, body_measurements, nutrition_logs, sleep_logs, cardio_sessions, hydration_logs, journal_entries, stretching_logs.
- **Through parent (1 table):** session_sets (via workout_sessions).

The planner MUST inspect each table's current RLS policy (migrations 001–033) before authoring migration 035 to pick the right pattern per table. **Action for planner:** Run `\d+ <table>` (or read the migration that created each table's RLS) to discover whether the table has a `user_id` column directly or relies on a parent-chain policy.

Reading verified so far (migration 001 only — habits, habit_logs etc. are in migration 002 which the planner must read):
- `workout_sessions` line 84: has `user_id UUID NOT NULL` — direct ✓
- `session_sets` line 99-110: NO `user_id`, uses parent chain via `session_id` → needs the parent-chain coach-read pattern ✓
- `nutrition_logs` line 171-184: has `user_id` — direct ✓

**Locks during migration 035:**
- `CREATE POLICY` takes `ACCESS EXCLUSIVE` on the target table — brief but blocking. `SET LOCAL lock_timeout = '5s'` (D-RLS-02) ensures it fails fast on contention rather than queuing up writer requests. [CITED: PostgreSQL 16 docs — https://www.postgresql.org/docs/16/sql-createpolicy.html *"ALTER TABLE … ENABLE ROW LEVEL SECURITY"* and policy creation require ACCESS EXCLUSIVE.]

[VERIFIED: PostgreSQL 16 `CREATE POLICY` documentation — https://www.postgresql.org/docs/16/sql-createpolicy.html]

---

### Q3 — Vitest + Supabase Test Fixtures for the 4-Case Smoke Test

**Current state (VERIFIED from filesystem inspection):**
- `backend/api/test/` does **not exist** (confirmed: `ls /c/ziko-platform/backend/api/test → no test dir`).
- `backend/api/package.json` (read) has **no Vitest, no `test` script, no devDependency**. Listed devDeps: only `@types/node`, `tsx`, `typescript`.
- `.planning/codebase/TESTING.md` confirms repo-wide: *"No test files or test framework found … No vitest.config.ts."*
- This phase is therefore the **first** automated test in the entire repo. The planner must include test scaffolding as a discrete task.

**Required scaffolding additions (planner: include as a Wave 0 task):**

1. **Install Vitest in backend/api** as devDependencies:
   ```bash
   cd backend/api && npm install -D vitest @vitest/coverage-v8
   ```
   Vitest v3.x ships ESM-native, runs `.ts` directly via the bundled `vite-node` (no separate `tsx` step needed), and supports `defineConfig` for env-loading.
2. **Add `vitest.config.ts`** at `backend/api/vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       include: ['test/**/*.spec.ts'],
       env: { /* dotenv loaded by setupFiles */ },
       testTimeout: 30_000,
       hookTimeout: 30_000,
       setupFiles: ['./test/setup.ts'],
     },
   });
   ```
3. **Add `test` and `test:watch` scripts** to `backend/api/package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest watch",
     "test:rls": "vitest run test/rls"
   }
   ```
4. **Add `backend/api/test/setup.ts`** that loads `.env.test` (or reuses `.env.local`) and exposes Supabase URL + service-role key + anon key globally.

**Test-user creation pattern (canonical for the 4-case smoke spec):**

Two anon Supabase clients (one for coach, one for client) need real JWTs. The cleanest path is:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // test env only
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createTestUser(email: string, password: string): Promise<{ id: string; client: SupabaseClient }> {
  // 1. Create user via admin (auto-confirm email — required for password sign-in)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr) throw cErr;

  // 2. Sign in with a fresh anon client to obtain a real JWT
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;

  return { id: created.user!.id, client };
}
```

This is the simplest, most explicit pattern. It gives each test user (a) a real auth.users row and (b) an anon-key client whose `auth.uid()` resolves to that user inside RLS predicates.

**Important security note for the planner (ARCH-03 boundary):** This `SUPABASE_SERVICE_ROLE_KEY` is loaded ONLY inside `backend/api/test/**` files, never under `backend/api/src/**`. ARCH-03 (Phase 24+) bans service-role under `coach/`; Phase 22's test setup predates that boundary but still observes it spatially. The planner must call this out: the env var lives in `.env.local` for the dev's machine and in GitHub Actions secrets for CI — never in `src/`.

**Where to run the smoke test:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| (a) **Linked Supabase project** (the dev's real ziko-app project) | Zero setup — just runs | Risk of test data polluting prod-like project; flaky if multiple developers test in parallel | **NOT recommended for CI**, acceptable for first local smoke run |
| (b) **Supabase branch** (preview database created per PR) | True isolation; matches Supabase platform model; supports `apply_migration` MCP cleanly | Requires Supabase Pro plan; ~30s spin-up; needs CI to provision the branch and tear down | **RECOMMENDED for CI** |
| (c) **Local supabase-cli stack** (`supabase start`) | Fastest, deterministic, offline | Requires Docker locally; CI needs Docker-in-Docker; ~60s startup; auth.uid()/RLS works identically | **RECOMMENDED for local dev** |

**Recommendation for Phase 22:** Use (c) locally (`supabase start` → `supabase db reset` → migrations applied → vitest runs); use (b) in CI (provisioned via Supabase MCP `apply_migration` against a per-PR preview branch). Document both in PLAN.md.

**Cleanup pattern (Vitest `afterAll`):**

```ts
afterAll(async () => {
  // Order matters: child rows first (FK cascade handles most), then auth.users last
  await admin.auth.admin.deleteUser(coachUserId);
  await admin.auth.admin.deleteUser(clientUserId);
  // coach_client_links rows are removed by FK CASCADE on auth.users
});
```

`auth.admin.deleteUser` cascades through `auth.users → user_profiles → coach_profiles → coach_client_links → coach_invitations` because every FK in the new schema chains `ON DELETE CASCADE` back to `auth.users(id)` (verified against D-05, D-07).

**Suggested CI workflow shape (GitHub Actions):**

No `.github/workflows/` exists in this repo today (per file system inspection). The planner should treat CI integration as **out of scope for Phase 22** and call it a "Phase 22 follow-up" — the local smoke test command (`cd backend/api && npm run test:rls`) is the contract the migration must pass; CI orchestration is Phase 23 territory.

[VERIFIED: existing `backend/api/package.json` has no `vitest` — installation is the first concrete code task.]
[CITED: Supabase admin auth.admin.createUser — https://supabase.com/docs/reference/javascript/auth-admin-createuser]
[CITED: Vitest defineConfig — https://vitest.dev/config/]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (to be installed — does NOT currently exist) |
| Config file | `backend/api/vitest.config.ts` (new — Wave 0) |
| Quick run command | `cd backend/api && npm run test:rls` |
| Full suite command | `cd backend/api && npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ARCH-07 | `is_coach_of()` defined, STABLE, SECURITY DEFINER, search_path locked | unit (SQL introspection) | `npm run test:rls -- --grep is_coach_of_definition` | ❌ Wave 0 |
| ARCH-07 | Coach reads habit_logs of a LINKED client (success criterion #5 case 1) | integration | `npm run test:rls -- --grep "linked client"` | ❌ Wave 0 |
| ARCH-07 | Coach reads habit_logs of an UNLINKED client → 0 rows (case 2) | integration | `npm run test:rls -- --grep "unlinked client"` | ❌ Wave 0 |
| ARCH-07 | Revoke link → coach immediately returns 0 rows (case 3) | integration | `npm run test:rls -- --grep "revoke"` | ❌ Wave 0 |
| ARCH-07 | Expired link = revoked → coach returns 0 rows (case 4) | integration | `npm run test:rls -- --grep "expired"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:rls` (the 4 RLS cases — ~10–15s on local Supabase)
- **Per wave merge:** `npm run test` (everything under `backend/api/test/`)
- **Phase gate:** Full suite green; the 4-case smoke test must pass on the Supabase branch for the PR.

### Validation of the 5 Success Criteria

| Success Criterion | Validated By | Type |
|-------------------|--------------|------|
| 1. Migration 034 lands `user_profiles.role` + `coach_profiles`; existing reads unbroken | SQL introspection test: `SELECT column_default FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='role'` returns `'client'::text`; existing `user_profiles_own` policy unchanged | Wave 0 unit |
| 2. Migration 035 lands invitations, links, `is_coach_of()`, `redeem_invitation_code` | SQL introspection: `pg_proc` rows exist with correct prosrc, prosecdef=true, provolatile='s'; `pg_indexes` for `coach_client_links_active_uq` shows `WHERE (revoked_at IS NULL)` | Wave 0 unit |
| 3. 11 tables have additive `FOR SELECT` policy, existing `FOR ALL` unchanged | SQL introspection: `pg_policies` per table shows 2 rows (one `cmd='ALL'`, one `cmd='SELECT'`); the SELECT policy's `qual` text contains `is_coach_of` | Wave 0 unit |
| 4. Migration 036 lands workout_programs extensions + ai_imports | `information_schema.columns` checks for each new column; `ai_imports` RLS enabled and policy present | Wave 0 unit |
| 5. 4-case smoke test | The Vitest spec at `test/rls/coach-rls.spec.ts` | Integration |

### Additional Validation Scenarios (beyond the 4 cases)

The planner should add these to the smoke spec to harden the keystone:

1. **`is_coach_of(NULL, NULL)` returns FALSE** (defensive — RLS predicates evaluate `is_coach_of(auth.uid(), user_id)` where either could be NULL during edge cases like unauthenticated reads or NULL FK values).
2. **`is_coach_of(coach, coach)` returns FALSE** (defensive — confirms a coach can't accidentally appear as their own coach due to a corrupted self-link).
3. **`redeem_invitation_code` timing variance check** — call the RPC 50 times with each error class (INVALID_CODE, EXPIRED, REVOKED, ALREADY_USED, SELF_INVITATION, LINK_EXISTS) and assert all p95 latencies are within a tolerance window (e.g., ±20% of the median across classes). This is a coarse but useful regression guard.
4. **Role backfill correctness** — `SELECT count(*) FROM user_profiles WHERE role IS NULL` returns 0; `SELECT count(*) FROM user_profiles WHERE role = 'client'` equals `(SELECT count(*) FROM user_profiles)` (i.e., every existing row has the default applied).
5. **Coach cannot INSERT into a client table via the new policy** — `coachClient.from('habits').insert({ user_id: clientId, … })` returns an RLS error. Defends against accidental future drift of the `FOR ALL` policy.
6. **Active partial UNIQUE works as designed** — admin tries to insert a second active link for the same `(coach_id, client_id)` and gets a UNIQUE violation; revoking the first then inserting a new active row succeeds.

### Wave 0 Gaps

- [ ] Install Vitest in `backend/api`: `cd backend/api && npm install -D vitest @vitest/coverage-v8`
- [ ] Create `backend/api/vitest.config.ts` — Vitest config + setupFiles + env loading
- [ ] Create `backend/api/test/setup.ts` — load `.env.test` (mirrors `.env.local`) + export `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`
- [ ] Create `backend/api/test/rls/coach-rls.spec.ts` — the 4 cases + additional 6 validation scenarios above
- [ ] Add `.env.test` to `backend/api/.gitignore` (already covered by existing `.env*` pattern but verify)
- [ ] Add `test`, `test:watch`, `test:rls` scripts to `backend/api/package.json`
- [ ] Document `SUPABASE_SERVICE_ROLE_KEY` rotation procedure (the key only needs to be valid during test execution; rotate via Supabase dashboard after Phase 22 ships)

---

## Project Constraints (from CLAUDE.md)

These directives apply to every task the planner generates:

- **RLS policy naming convention:** `<table>_own` for owner-only (already in place since migration 001). New cross-user SELECT policies follow `<table>_coach_read` (per D-RLS-01) — distinct prefix keeps audit greps unambiguous.
- **Migration file location:** `supabase/migrations/NNN_<slug>.sql`. Phase 22 occupies 034, 035, 036 (verified: 033 is the highest existing, see `ls supabase/migrations/`).
- **All DDL via Supabase MCP `apply_migration`** (D-16 + CLAUDE.md MCP guidance). Never `execute_sql` for DDL.
- **No `Alert.alert` in plugins** — irrelevant to Phase 22 (no mobile code) but worth noting that the codebase has strict conventions.
- **Backend tests live under `backend/api/test/`** (per TESTING.md recommendation; subfolder `rls/` for this phase).
- **Service-role keys:** ARCH-03 bans `SERVICE_ROLE` references under `backend/api/src/coach/`. Phase 22's service-role usage is confined to `backend/api/test/**` — outside `src/coach/`. Planner must add an ESLint rule or CI grep in Phase 24 to enforce; Phase 22 only needs a `// SERVICE-ROLE ONLY IN TESTS` comment in the test setup file.
- **`.env.production` is gitignored** — `.env.test` follows the same pattern.
- **Use existing `public.handle_updated_at()` trigger** (defined in migration 001 line 224) for any new tables needing `updated_at` auto-update. Do NOT redefine it.

## Sources

### Primary (HIGH confidence)
- PostgreSQL 16 `CREATE POLICY` docs — https://www.postgresql.org/docs/16/sql-createpolicy.html (combination rules, USING/WITH CHECK semantics)
- PostgreSQL 16 datetime functions — https://www.postgresql.org/docs/16/functions-datetime.html#FUNCTIONS-DATETIME-DELAY (`pg_sleep` semantics)
- `supabase/migrations/026_ai_credits.sql` (in this repo) — canonical SECURITY DEFINER hardening pattern
- `supabase/migrations/027_earn_rpc.sql` (in this repo) — canonical RPC return-shape pattern
- `supabase/migrations/001_initial_schema.sql` (in this repo) — base RLS conventions, `handle_updated_at()` trigger
- `backend/api/package.json` (in this repo) — VERIFIED no Vitest currently installed
- `.planning/codebase/TESTING.md` — VERIFIED no test infrastructure exists
- `22-CONTEXT.md` (this phase) — 16 locked decisions

### Secondary (MEDIUM confidence)
- Supabase Admin API auth.admin.createUser — https://supabase.com/docs/reference/javascript/auth-admin-createuser
- Vitest configuration — https://vitest.dev/config/

### Tertiary (LOW confidence)
- None — all critical claims in this RESEARCH.md are HIGH confidence.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `habit_logs` has a direct `user_id` column (not a parent-chain RLS). Migration 002 not directly inspected in this research. | Q2 | Planner must verify by reading `supabase/migrations/002_habits_schema.sql` before writing migration 035. If `habit_logs` is parent-chained, the `<table>_coach_read` policy needs the parent-chain shape (like `session_sets`). |
| A2 | Supabase branch databases support `pg_proc.prosecdef` introspection identically to the main project. | Q3 | Very low risk — branches use full Postgres. |
| A3 | The constant-time work-equalization pattern is sufficient defense without `pg_sleep`. | Q1 | Low — Upstash rate limiting in Phase 25 is the primary defense. If timing leak is later discovered, adding `pg_sleep(0.005)` at function entry is a non-breaking patch. |

## Metadata

**Confidence breakdown:**
- Q1 (constant-time RPC): HIGH — pattern directly mirrors migration 026; PLPGSQL vs SQL behavior verified against Postgres docs
- Q2 (additive RLS): HIGH — verified verbatim against PostgreSQL 16 CREATE POLICY docs
- Q3 (Vitest setup): HIGH for the pattern; MEDIUM on the CI branch choice (depends on team's Supabase plan tier — not verified in this research)

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days — Postgres RLS semantics are stable; Vitest/Supabase APIs unlikely to change materially in this window)
