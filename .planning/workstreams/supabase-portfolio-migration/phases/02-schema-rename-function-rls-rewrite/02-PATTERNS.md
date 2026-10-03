# Phase 2: Schema Rename & Function/RLS Rewrite - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 6 (this phase produces ops/migration tooling, not application code)
**Analogs found:** 6 / 6

This phase's deliverables are all new files under `scripts/portfolio-migration/` (Node/SQL ops
tooling) and a new `supabase/migrations/*.sql` series — there is no existing `scripts/` subtree or
migration file doing exactly this "dump → rewrite → verify" job, so every analog below is a
role-match or pattern-match, not an exact match. No files are *modified* in this phase (no app
call-site rewrite — see CONTEXT.md Integration Points / RESEARCH.md Open Question 1, which scopes
`.rpc()`/`.from()` call-site rewriting outside this phase's success criteria).

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|---------------|
| `scripts/portfolio-migration/01-generate-rename-map.sql` | utility (introspection query) | batch/transform | `scripts/purge-test-accounts/dry-run.mjs` (read-only enumeration script) + live `information_schema` query style | role-match |
| `scripts/portfolio-migration/02-dump-and-rewrite.js` | utility (DDL rewrite tool) | batch/transform | `scripts/purge-test-accounts/lib.mjs` (admin-client + fail-fast env pattern) | role-match |
| `scripts/portfolio-migration/03-verify-post-apply.sql` | test (SQL assertion) | batch/transform | `backend/api/test/rls/*.spec.ts` (assertion pattern) + RESEARCH.md's own Code Examples (concrete query shapes) | role-match |
| `scripts/portfolio-migration/04-rls-smoke-test.js` | test (integration, request-response) | CRUD | `backend/api/test/rls/workout-programs.spec.ts` + `backend/api/test/rls/fixtures.ts` | role-match |
| `supabase/migrations/<TS>_portfolio_ziko_schema.sql` (table/enum DDL + RLS) | migration | batch/transform | `supabase/migrations/001_initial_schema.sql` (table + RLS pattern) | exact (DDL shape) |
| `supabase/migrations/<TS>_portfolio_ziko_functions.sql` (SECURITY DEFINER fns + GRANT/REVOKE) | migration | batch/transform | `supabase/migrations/035_coach_invitations_links_rls.sql`, `20260530200608_unaccent_user_search.sql`, `20260813182644_waitlist_founder_offer.sql` | exact (DDL shape) |

**Note on migration file count/naming:** RESEARCH.md's "Claude's Discretion" leaves the exact
file split (single migration vs. one-per-object-class) and timestamp scheme to the
planner/executor — the two rows above represent the two dominant DDL shapes (tables+RLS vs.
functions+grants) this phase must emit, not a mandated 1:1 file mapping. Follow the
`YYYYMMDDHHMMSS_description.sql` convention, timestamped after **`portfolio`'s** history (see
RESEARCH.md Open Question 2 — simplest correct approach is current wall-clock UTC timestamp at
authoring time).

## Pattern Assignments

### `scripts/portfolio-migration/01-generate-rename-map.sql` (utility, batch/transform)

**Analog:** `scripts/purge-test-accounts/dry-run.mjs` (read-only-by-construction convention) +
concrete introspection query shapes already drafted in RESEARCH.md's own "Code Examples" section.

**Read-only-by-construction pattern** (`scripts/purge-test-accounts/dry-run.mjs` lines 1-12):
```js
#!/usr/bin/env node
/**
 * Read-only dry-run for the test-account purge — enumerates auth.users,
 * applies the @ziko-app.com criterion (D-01), detects cross-links to real
 * accounts (D-05), and writes a review report to disk.
 *
 * Usage: node scripts/purge-test-accounts/dry-run.mjs [--out <dir>]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * This file imports nothing capable of removing an account and performs no
 * write against Supabase — it is read-only by construction.
 */
```
Apply the same self-documenting "this step cannot write" comment convention to
`01-generate-rename-map.sql` (it only ever runs `SELECT`/`information_schema` queries against
live `ziko`, per RESEARCH.md Pattern 1 — never against migration files, to avoid the
`shopping_list_items` resurrection risk in Pitfall 5).

**Query shape to build on** (already drafted in RESEARCH.md's Code Examples — do not re-derive,
extend to full 99-table/37-function/1-type live inventory using Phase 1's `01-INVENTORY.md` as
the source list):
```sql
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.prosrc ~* '\bnet\.' OR p.prosrc ~* '\bunaccent\s*\(');

SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND pg_get_triggerdef(t.oid) ~* 'supabase_functions\.http_request|\bnet\.';
```
Output format: JSON map `{ tables: {...}, functions: {...}, types: {...} }` per RESEARCH.md's
Recommended Project Structure — written to `rename-map.generated.json`, committed, and consumed
by steps 02-04.

---

### `scripts/portfolio-migration/02-dump-and-rewrite.js` (utility, batch/transform)

**Analog:** `scripts/purge-test-accounts/lib.mjs` — admin-client construction + fail-fast env-var
handling convention (no first-party in-repo DDL-rewrite analog exists; this is the closest
Node-ops-script precedent for the surrounding scaffolding).

**Admin client + fail-fast env pattern** (`scripts/purge-test-accounts/lib.mjs` lines 38-59):
```js
// ── Admin client (mirrors apps/web/src/lib/supabase/admin.ts) ──────────────

/**
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from process.env. Exits 1
 * (naming the missing variables, never a value) when either is absent — this
 * fail-fast is also the D-03 safety property: with no key in the environment
 * this tooling cannot touch anything.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createPurgeAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```
Apply the same fail-fast/name-the-missing-var convention for whatever connection mechanism
`02-dump-and-rewrite.js` uses to invoke `supabase db dump --linked --schema public` /
`supabase link --project-ref <ref>` (shell out via `child_process`, not a raw DB client, since
this step drives the Supabase CLI per RESEARCH.md's Standard Stack).

**CLI arg parsing pattern** (`scripts/purge-test-accounts/dry-run.mjs` lines 26-30):
```js
function parseOutDir(argv) {
  const idx = argv.indexOf('--out');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return join(__dirname, 'exports');
}
```
Reuse this flag-parsing style for whatever `--project-ref`/`--dry-run`/`--out` flags
`02-dump-and-rewrite.js` needs (e.g. distinguishing scratch-project vs. `portfolio` target).

**Main/error-exit pattern** (`scripts/purge-test-accounts/dry-run.mjs` lines 32-62):
```js
async function main() {
  const outDir = parseOutDir(process.argv.slice(2));
  const client = createPurgeAdminClient();
  const report = await runDryRun({ /* ... */ });
  const { jsonPath, csvPath } = await writeReport(report, outDir);
  console.log('Test-account purge — dry run');
  console.log(`  users_scanned: ${report.totals.users_scanned}`);
  // ...
  process.exit(0);
}

main().catch((err) => {
  console.error('dry-run failed:', err.message);
  process.exit(1);
});
```

**No AST-parser analog exists in-repo.** If the executor uses `pgsql-parser`/`libpg-query`
(RESEARCH.md's primary recommendation, `[ASSUMED]` provenance — gate first install behind
`checkpoint:human-verify` per the Package Legitimacy Audit), there is no existing usage pattern
to copy from this codebase; follow RESEARCH.md's own "Pattern 2: Two-pass rewrite" directly. The
zero-dependency regex fallback (also pre-validated in RESEARCH.md) needs no new library pattern.

---

### `scripts/portfolio-migration/03-verify-post-apply.sql` (test, batch/transform)

**Analog:** `backend/api/test/rls/*.spec.ts` assertion *pattern* (see Don't Hand-Roll in
RESEARCH.md — reuse the pattern, not the files verbatim, since those reference unprefixed table
names and `ziko`'s env vars). Concrete SQL already drafted in RESEARCH.md's Code Examples section
— copy directly, extending the illustrative subset to the full generated rename map:

```sql
-- 1. RLS policies referencing an unprefixed table name in USING/WITH CHECK
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'ziko_%'
  AND (
    qual ~* '\y(user_profiles|coach_client_links|workout_programs|session_sets|ai_credit_transactions)\y'
    OR with_check ~* '\y(user_profiles|coach_client_links|workout_programs|session_sets|ai_credit_transactions)\y'
  );

-- 2. Function bodies referencing an unprefixed table/function name
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'ziko_%'
  AND p.prosrc ~* '\y(user_profiles|deduct_ai_credits|is_coach_of|record_athlete_decision)\y';

-- 3. RLS actually enabled on every ziko_* table
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname LIKE 'ziko_%'
  AND relrowsecurity IS NOT TRUE;   -- expect 0 rows
```
This file must be driven programmatically by `rename-map.generated.json` (step 01's output), not
hardcoded to this illustrative subset — the executor's script should generate the full
alternation list from the map, per RESEARCH.md's closing note under Code Examples.

---

### `scripts/portfolio-migration/04-rls-smoke-test.js` (test, CRUD)

**Analog:** `backend/api/test/rls/workout-programs.spec.ts` + `backend/api/test/rls/fixtures.ts`
— the exact "owner sees >0 rows, non-owner sees 0 rows" assertion style SCHEMA-03's exit gate
needs, 17 existing examples in this repo to imitate.

**Fixtures pattern** (`backend/api/test/rls/fixtures.ts`, full file, 63 lines):
```typescript
// SERVICE-ROLE ONLY IN TESTS — this file MUST NOT be imported from backend/api/src/**
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(prefix: string): Promise<TestUser> {
  const admin = getAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const email = `${prefix}-${suffix}@ziko.test`;
  const password = `Test_${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createTestUser(${prefix}): ${error?.message ?? 'no user returned'}`);
  }
  const client = await getAuthedClient(email, password);
  return { id: data.user.id, email, password, client };
}

export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  const admin = getAdminClient();
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id); // FK CASCADE wipes owned rows
  }
}
```
**Adaptation required (do not copy env var names as-is):** this fixtures file reads
`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` pointed at `ziko` by
default (via `.env.local`/CI secrets) — `04-rls-smoke-test.js` must instead point at the
**scratch project**, then **`portfolio`**, per SCHEMA-05's two-pass gate, so either accept an
explicit `--project-url`/`--service-role-key` CLI arg (see `02-dump-and-rewrite.js`'s arg-parsing
analog above) or a distinctly-named env var pair, never reuse the bare `SUPABASE_URL` name that
implicitly means "ziko" elsewhere in this repo.

**Owner-vs-non-owner assertion pattern** (`backend/api/test/rls/workout-programs.spec.ts` lines
113-126):
```typescript
it('own_programs FOR ALL policy unchanged — non-owner cannot read', async () => {
  const a = await createTestUser('wp-own-a');
  const b = await createTestUser('wp-own-b');
  createdIds.push(a.id, b.id);
  const { data: pgm } = await a.client
    .from('workout_programs')
    .insert({ user_id: a.id, name: 'A private' })
    .select('id')
    .single();

  const { data, error } = await b.client.from('workout_programs').select('id').eq('id', pgm!.id);
  expect(error).toBeNull();
  expect(data?.length ?? 0).toBe(0);
});
```
Apply this same shape against every `ziko_*` table in the rename map — table name is now
`ziko_workout_programs` etc. — this is the "actual RLS behavior, not just no error" gate
CONTEXT.md's Claude's Discretion note requires. Per RESEARCH.md Open Question 1, this **cannot**
be a literal re-run of `test/rls/*.spec.ts` (those hardcode unprefixed names and `ziko`'s own
`.env.local`) — it is a new, purpose-built script that imitates the pattern.

**Cleanup pattern** (`workout-programs.spec.ts` lines 1-9):
```typescript
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from './fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});
```

---

### `supabase/migrations/<TS>_portfolio_ziko_schema.sql` (migration, batch/transform)

**Analog:** `supabase/migrations/001_initial_schema.sql`

**Extension + table pattern** (lines 1-27):
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT,
  ...
);
```
Rewrite target: `public.user_profiles` → `public.ziko_user_profiles`, per D-01/Pattern 2. The
`REFERENCES auth.users(id)` lines are **not** rewritten (shared auth, per phase boundary — no
`auth`/`storage` schema objects touched).

**RLS enable + policy pattern** (lines 272-299):
```sql
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs     ENABLE ROW LEVEL SECURITY;
...

CREATE POLICY "users_own_profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "own_programs" ON public.workout_programs
  FOR ALL USING (user_id = auth.uid());

-- program_workouts: through parent program (cross-table subquery — table refs inside
-- the subquery must ALSO be rewritten, not just the CREATE POLICY ... ON target)
CREATE POLICY "own_program_workouts" ON public.program_workouts
  FOR ALL USING (
    program_id IN (SELECT id FROM public.workout_programs WHERE user_id = auth.uid())
  );
```
This confirms CLAUDE.md's stated `auth.uid() = user_id` RLS pattern verbatim, and demonstrates
the multi-table-reference-inside-one-policy case the rewrite script must handle (both
`public.program_workouts` in the `ON` clause and `public.workout_programs` inside the `USING`
subquery need the `ziko_` prefix applied consistently from the same rename map).

---

### `supabase/migrations/<TS>_portfolio_ziko_functions.sql` (migration, batch/transform)

**Analogs:** `supabase/migrations/035_coach_invitations_links_rls.sql`,
`20260530200608_unaccent_user_search.sql`, `20260813182644_waitlist_founder_offer.sql`

**SECURITY DEFINER function with search_path pin** (`035_coach_invitations_links_rls.sql` lines
84-98, before/after already verified against real repo content):
```sql
CREATE OR REPLACE FUNCTION public.is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = coach AND client_id = client
      AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  );
$$;
```
Rewrite target — function name AND every table reference inside the `$$...$$` body:
```sql
CREATE OR REPLACE FUNCTION public.ziko_is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ziko_coach_client_links
    WHERE coach_id = coach AND client_id = client
      AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  );
$$;
```

**Extension-gated function pattern** (`20260530200608_unaccent_user_search.sql`, full file):
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_users_fuzzy(
  search_query TEXT, calling_user_id UUID, result_limit INT DEFAULT 20
)
RETURNS TABLE (id UUID, name TEXT, avatar_url TEXT, goal TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.id, p.name, p.avatar_url, p.goal
  FROM public.user_profiles p
  WHERE p.id <> calling_user_id
    AND unaccent(lower(p.name)) LIKE '%' || unaccent(lower(search_query)) || '%'
  ...
$$;

GRANT EXECUTE ON FUNCTION public.search_users_fuzzy(TEXT, UUID, INT) TO authenticated;
```
This is the **confirmed** `unaccent(` dependency D-04 asks about (RESEARCH.md Pitfall 3) —
`CREATE EXTENSION IF NOT EXISTS unaccent;` is a near-certain, pre-authorized step in this
migration. Table reference `public.user_profiles` inside the body → `public.ziko_user_profiles`;
function name and the trailing `GRANT EXECUTE ON FUNCTION public.search_users_fuzzy(...)` line
both need rewriting (see next pattern) → `public.ziko_search_users_fuzzy(...)`.

**GRANT/REVOKE-on-function rewrite target** (`20260813182644_waitlist_founder_offer.sql` lines
92-93 — confirmed distinct from `CREATE FUNCTION`, easy to miss per Pitfall 4):
```sql
REVOKE EXECUTE ON FUNCTION public.normalize_waitlist_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_waitlist_email(TEXT) TO service_role;
```
Rewrite: `public.normalize_waitlist_email(TEXT)` → `public.ziko_normalize_waitlist_email(TEXT)`
in **both** the `REVOKE` and `GRANT` lines — the AST/regex rewrite pass (Pattern 2/Pitfall 4 in
RESEARCH.md) must include `GRANT`/`REVOKE ... ON FUNCTION` as a distinct statement-type target,
not assume `CREATE FUNCTION` coverage is sufficient.

**`handle_new_user` trigger function — create but do NOT attach (D-02)**
(`001_initial_schema.sql` lines 252-266, already verified before/after in RESEARCH.md):
```sql
-- AFTER rewrite (this phase's output — function only, no CREATE TRIGGER):
CREATE OR REPLACE FUNCTION public.ziko_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ziko_user_profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- (no CREATE TRIGGER emitted here — Phase 3 attaches it to auth.users per D-02)
```

## Shared Patterns

### Rename-map-driven, not hand-written, rewrite
**Source:** RESEARCH.md Pattern 1/2 + this phase's own `01-generate-rename-map.sql`
**Apply to:** `02-dump-and-rewrite.js`, `03-verify-post-apply.sql`, `04-rls-smoke-test.js`, and
both migration files
Every file in this phase must consume the same `rename-map.generated.json` rather than
hardcoding table/function names independently — a table renamed one way in the schema migration
must be renamed identically inside every function body, policy clause, and verification query
that references it (RESEARCH.md's explicit "same map" requirement in Pattern 2).

### Fail-fast env var / CLI-arg convention for ops scripts
**Source:** `scripts/purge-test-accounts/lib.mjs` (`createPurgeAdminClient`),
`scripts/purge-test-accounts/dry-run.mjs` (`parseOutDir`)
**Apply to:** `02-dump-and-rewrite.js`, `04-rls-smoke-test.js`
Name the missing env var/flag explicitly and `process.exit(1)`, never proceed with an
undefined/partial config — matches this repo's established convention for scripts that can touch
a live Supabase project. Given this phase runs against **two different projects** (scratch, then
`portfolio`) in sequence, prefer an explicit `--project-url`/`--service-role-key` (or clearly
distinct env var names) over the bare `SUPABASE_URL` that implicitly means "ziko" in
`backend/api/test/rls/fixtures.ts` — reusing that exact name risks accidentally running
verification against the wrong (or production `ziko`) project.

### `SECURITY DEFINER` + `SET search_path = public, pg_temp` on every recreated function
**Source:** `supabase/migrations/035_coach_invitations_links_rls.sql` lines 84-90
**Apply to:** every function in the functions migration
Not every existing ziko function pins `search_path` (e.g. `search_users_fuzzy` omits it) —
`035_coach_invitations_links_rls.sql` is the more defensive, more recent pattern; prefer it going
forward for all 37 recreated functions unless a specific function's original body already lacked
it and changing that is out of this phase's "preserve behavior exactly" mandate (RESEARCH.md
Anti-Patterns — the rename must not silently change semantics beyond the identifier prefix).

### Ops-tooling directory convention: `RUNBOOK.md` alongside scripts
**Source:** `scripts/waitlist-erasure/RUNBOOK.md`, `scripts/purge-test-accounts/RUNBOOK.md`,
`scripts/founder-offer-go-live/RUNBOOK.md`
**Apply to:** `scripts/portfolio-migration/` as a whole
Every existing `scripts/<task-name>/` directory in this repo pairs its `.mjs`/`.sql` tooling with
a `RUNBOOK.md` aimed at "the person about to run a real, credential-gated command against
production" — same audience/stakes as this phase (a scratch-project dry run, then a real apply to
shared `portfolio`). Not explicitly required by CONTEXT.md/RESEARCH.md, but matches established
repo convention closely enough that the planner should consider adding one, particularly to
document the Vercel-dashboard-only scratch-project provisioning step (Pitfall 1) that cannot be
scripted at all.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| AST-based DDL rewrite logic inside `02-dump-and-rewrite.js` (if `pgsql-parser` is used) | utility | transform | No existing file in this repo parses/rewrites Postgres DDL programmatically — every existing `scripts/*.mjs` operates on already-structured Supabase Admin API/query results, not raw SQL text. RESEARCH.md's own Pattern 2 and Code Examples are the only available reference; treat RESEARCH.md as the source of the pattern here, not the codebase. |
| Scratch-project provisioning step (Vercel dashboard, manual) | n/a (not a file) | n/a | Not a code artifact at all — RESEARCH.md Pitfall 1 confirms this must be a `checkpoint:human-verify` task, no scriptable analog exists or should be attempted (`supabase projects create`/MCP `create_project` are documented as blocked for this org type) |

## Metadata

**Analog search scope:** `supabase/migrations/` (90 files, targeted reads of
`001_initial_schema.sql`, `035_coach_invitations_links_rls.sql`,
`20260530200608_unaccent_user_search.sql`, `20260813182644_waitlist_founder_offer.sql`),
`scripts/` (5 subdirectories + 4 loose files — read `founder-offer-go-live/`,
`purge-test-accounts/`, `waitlist-erasure/` listings + `purge-test-accounts/dry-run.mjs`,
`purge-test-accounts/lib.mjs`, `waitlist-erasure/RUNBOOK.md`), `backend/api/test/rls/` (17 spec
files listed, `fixtures.ts` read in full, `workout-programs.spec.ts` read in full),
`backend/api/test/coach/` (17 spec files + 2 subdirs listed, not deep-read — RLS pattern already
well-covered by `test/rls/`), `backend/api/package.json` (`test:rls` script confirmed).
**Files scanned:** ~130 files/listings touched; 8 files read in full or targeted-range.
**Pattern extraction date:** 2026-09-22

