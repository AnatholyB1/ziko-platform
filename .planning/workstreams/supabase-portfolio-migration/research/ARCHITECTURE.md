# Architecture Patterns — Supabase `ziko` → `portfolio` Migration

**Domain:** Infrastructure migration (multi-tenant Supabase project consolidation)
**Researched:** 2026-09-21
**Confidence:** HIGH for codebase integration points (verified via direct grep/read of this repo) · MEDIUM for `portfolio` project internals (rh_*/gecko_* schema not visible from this repo — must be inspected directly via Supabase MCP/dashboard before execution)

## Recommended Architecture

Ziko's ~93-100 tables (90 migration files as of 2026-09-21, not 73 — the PROJECT.md count is stale; grep found 100 distinct `CREATE TABLE public.<name>` statements, some possibly superseded/dropped later, so the real count must be verified against the live `ziko` project's `information_schema.tables`, not the migration file count) move into `portfolio`'s `public` schema under a `ziko_` prefix, alongside pre-existing `rh_*` and `gecko_*` tables and generic un-prefixed tables (`products`, `orders`, `prospects`). Nothing about Ziko's internal data model changes — this is a rename + host move, not a re-architecture.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase project "portfolio"                     │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │ rh_* tables   │  │ gecko_* tables│  │ ziko_* tables (NEW: ~100)│ │
│  │ (unaffected)  │  │ (unaffected)  │  │ ziko_user_profiles, etc. │ │
│  └───────┬───────┘  └───────┬───────┘  └────────────┬─────────────┘ │
│          │                  │                        │               │
│          └──────────┬───────┴────────────────────────┘               │
│                      ▼                                                │
│           auth.users (SHARED pool — rh + gecko + ziko accounts,      │
│           IDs preserved on Ziko import)                              │
│                      │                                                │
│           storage.objects (SHARED bucket namespace —                 │
│           ziko-owned buckets renamed with ziko- prefix to avoid      │
│           collision, e.g. avatars → ziko-avatars)                    │
└─────────────────────────────────────────────────────────────────────┘
                      ▲
   Bearer JWT (unscoped — auth.getUser(token) accepts ANY portfolio user)
                      │
        backend/api (Hono) · apps/web (Next.js) · apps/mobile (Expo)
        — all Supabase client calls updated to query ziko_* tables
```

### Component Boundaries

| Component | Responsibility | Changes Required |
|-----------|----------------|-------------------|
| `supabase/migrations/*.sql` (90 files) | Schema history for `ziko` project | **New parallel migration set** — cannot edit in place (never-edit-existing-migration rule); a fresh, consolidated, renamed migration (or migration series) is authored for `portfolio`, replayed there |
| `supabase/seed.sql` | Exercises, plugins_registry, food_database seed data | Table names updated to `ziko_exercises`, `ziko_plugins_registry`, `ziko_food_database` |
| `backend/api/src/**` (53 files, 348 `.from()` calls, ~130 `.rpc()` calls across ~20 RPC names) | All backend DB access | Every `.from('<table>')` and `.rpc('<fn>')` string literal updated; `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_KEY` env vars repointed to `portfolio` |
| `apps/mobile/**` (39 files, 168 `.from()` calls) | Direct-to-Supabase queries (mobile bypasses Hono for most reads) | Same string-literal rename; `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_KEY` repointed |
| `apps/web/src/**` (41 files, 71 `.from()` calls) | SSR/server-action Supabase queries + Hono proxy | Same rename; `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` repointed |
| `plugins/*/src/**` (50 files, 240 `.from()` calls) | Plugin-local Supabase queries (each plugin owns its store) | Same rename, spread across 19 plugin packages |
| `packages/coach-sdk/src/**` | Zod schemas + TS types shared web/mobile/backend | **Zero table-name references found** (grep confirmed) — coach-sdk only defines shapes, never queries. No change needed for the rename itself. |
| `backend/api/test/rls/*.spec.ts` (17 files) + `backend/api/test/coach/*.spec.ts` | RLS/RPC integration tests, run against live schema | Same rename in test bodies — these are also the verification harness for the migration itself |
| Storage: 9 buckets (`profile-photos`, `scan-photos`, `exports`, `avatars`, `coach-kyc`, `ai-imports`, `coach-logos`, `coach-exercises`, `exercise-media`) | File storage, RLS via `storage.foldername(name)[1] = auth.uid()` | Bucket **names** collide-risk with `portfolio`'s other apps if any share generic names (`avatars`, `exports` are plausible collisions) — recommend `ziko-` prefixing all 9 bucket IDs, not just table names |
| CI: `.github/workflows/ci.yml` `migrate-supabase` job | Applies new migrations via `supabase link --project-ref $SUPABASE_PROJECT_ID && supabase db push` | `SUPABASE_PROJECT_ID`/`SUPABASE_ACCESS_TOKEN` GitHub secrets repointed to `portfolio`'s ref; **migration history table** (`supabase_migrations.schema_migrations`) in `portfolio` already has rh_*/gecko_* history — Ziko's renamed migrations need fresh version timestamps appended after existing history, not a `db push --include-all` replay of the old ziko history (version collisions/out-of-order timestamps otherwise) |
| Vercel env vars (web + backend API projects) | Runtime config | All `SUPABASE_*`/`NEXT_PUBLIC_SUPABASE_*` vars updated in both Vercel projects, Production + Preview scopes |

## Critical Integration Point: Shared `auth.users` Triggers

**This is the highest-risk item in the whole migration** and was not called out in the milestone context — found by reading the migrations directly.

Two `AFTER INSERT ON auth.users FOR EACH ROW` triggers exist today, unscoped to any tenant:

- `on_auth_user_created` → `public.handle_new_user()` (migration `001_initial_schema.sql`) — inserts a `user_profiles` row for every new `auth.users` row
- `on_auth_user_created_credits` → `public.handle_new_user_credits()` (migration `026_ai_credits.sql`) — grants 5 welcome AI credits to every new `auth.users` row

**What goes wrong if migrated as-is:** once `auth.users` is the *shared* pool across `rh_*`, `gecko_*`, and `ziko_*`, these two triggers fire for **every** signup on **any** app in `portfolio` — a `gecko_admins` signup or an `rh_users` signup would silently get a spurious `ziko_user_profiles` row + 5 Ziko AI credits. If `portfolio` already has analogous `rh_*`/`gecko_*` triggers on `auth.users`, the reverse also applies — a Ziko signup could trigger `rh_*`/`gecko_*` side effects.

**Required fix before deploying to `portfolio`:** scope both trigger functions to only act for Ziko signups — e.g. gate on `NEW.raw_app_meta_data->>'app' = 'ziko'` (requires the mobile/web signup call to set that `app_metadata` key at signup time) or gate on the existence of an inviting context. This must be decided and implemented as its own migration step, and the equivalent must be checked/requested for any existing `rh_*`/`gecko_*` `auth.users` triggers in `portfolio` (inspect via Supabase MCP `list functions`/`list triggers` on `portfolio` before writing Ziko's — do not assume there are none).

The unscoped `authMiddleware` in `backend/api/src/middleware/auth.ts` compounds this: `adminClient.auth.getUser(token)` accepts **any** valid `portfolio` JWT (rh, gecko, or ziko) and sets `c.set('auth', {...})` with no app/tenant check. Most routes will naturally fail downstream (FK to `ziko_user_profiles` won't resolve for a non-Ziko user), but this is fail-*open* by omission rather than fail-closed by design. Recommend adding an explicit early check — "does a `ziko_user_profiles` row exist for this userId" — that returns a clean 403 instead of letting a cross-tenant JWT fall through to a raw DB error.

## Data Flow Changes

**Before:** Mobile/web/backend → `ziko` project (dedicated, single-tenant) → `auth.users` (Ziko-only) → unprefixed tables → 9 unprefixed storage buckets.

**After:** Mobile/web/backend → `portfolio` project (shared) → `auth.users` (Ziko + rh + gecko, IDs preserved for Ziko) → `ziko_*`-prefixed tables → `ziko-*`-prefixed storage buckets. No change to the *shape* of any request/response — only the connection target and the literal strings used in every query. AI orchestrator flow, credit gating, coach RLS pattern (`is_coach_of()`), and SSE streaming are structurally unaffected; `is_coach_of()`, `deduct_ai_credits()`, `record_athlete_decision()`, and every other `SECURITY DEFINER` function get renamed to reference `ziko_*` tables internally but keep their existing (unprefixed, since they're Ziko-specific) function names — **unless** a name collision exists with an `rh_*`/`gecko_*` function of the same name in `portfolio` (verify via Supabase MCP `list functions` before writing the fork; `is_coach_of`, `deduct_ai_credits`, `redeem_invitation_code`, `record_athlete_decision`, `award_xp`, `award_coins`, `send_xp_gift`, `search_users_fuzzy`, `generate_referral_code`, `check_and_award_badges`, `ensure_gamification_profile`, `create_form_instances_for_trigger`, `peek_invitation`, `claim_waitlist_signup`, `normalize_waitlist_email`, `reset_waitlist_founder_sequence`, `get_waitlist_founder_status`, `anonymize_waitlist_signup`, `grant_premium_credits`, `earn_ai_credits`, `purchase_shop_item`, `increment_community_stat` are the ~20 distinct RPC names found via grep — generic names like `search_users_fuzzy` or `award_xp` are realistic collision candidates with `rh_*`/`gecko_*` and should probably be prefixed `ziko_` defensively even though functions technically live in a shared `public` schema and don't need table-style prefixing for RLS purposes).

## Full Table-Name Reference Inventory (grep-verified, this repo)

| Location | Files | `.from()` calls | Notes |
|----------|-------|------------------|-------|
| `backend/api/src/**` | 53 | 348 | Includes all `coach/*/db.ts`, `tools/*.ts`, `routes/*.ts`, `services/*.ts`, `context/*.ts`, `coaching-engine/*.ts` |
| `backend/api/test/rls/**` + `test/coach/**` | ~19 | not counted separately | Test fixtures construct/query rows directly — these are the migration's own verification suite and must be updated in lockstep |
| `apps/mobile/**` | 39 | 168 | Mobile queries Supabase directly for most reads (per ARCHITECTURE.md: "Mobile queries hit Supabase directly; web hooks call the Hono API") |
| `apps/web/src/**` | 41 | 71 | Server actions, dashboard lib (`lib/dashboard/*.ts`), coach lib |
| `plugins/*/src/**` | 50 | 240 | Spread across all 19 plugin packages; heaviest: `plugins/community/src/store.ts` (46), `plugins/stats/src/store.ts` (50) |
| `packages/coach-sdk/src/**` | 0 | 0 | Confirmed clean — types/schemas only |
| `supabase/migrations/*.sql` | 90 | N/A (DDL, not `.from()`) | Every `CREATE TABLE public.<name>`, every `REFERENCES public.<name>`, every RLS `ON public.<name>`, every trigger `ON public.<name>`, every function body querying `public.<name>` |
| `supabase/seed.sql` | 1 | 3 `INSERT INTO` | `exercises`, `food_database`, `plugins_registry` |

**Total surface:** ~758 raw `.from()`/`.rpc()` call sites in application TypeScript, plus the full DDL of 90 migration files. Manual per-file editing is not viable at this scale — the migration must be driven by a **generated table-name mapping** (old name → `ziko_<old name>`, produced once via `grep -roE "CREATE TABLE( IF NOT EXISTS)? public\.[a-z_0-9]+" supabase/migrations` deduplicated against a live `information_schema.tables` query on the actual `ziko` project) and applied via scripted find-and-replace across both the new migration SQL and the TypeScript codebase in the same pass, with `npx turbo run type-check` and `npm run test:rls` as the correctness gate (type-check won't catch string-literal table names, but the RLS integration tests will catch anything the rename script missed, since they exercise real queries against the real schema).

## Patterns to Follow

### Pattern 1: Generate the rename map once, apply everywhere from it
**What:** A single JSON/CSV mapping `{ "user_profiles": "ziko_user_profiles", ... }` derived from the live schema (not just migration files, which may be stale relative to what's actually deployed).
**When:** Before touching a single line of TS or SQL.
**Why:** 100 tables × 4 codebases × RLS/trigger/function bodies referencing each other means a single missed rename (e.g. a JOIN inside an RLS policy referencing the old unprefixed name) produces a silently-broken policy, not a compile error.

### Pattern 2: Fork-and-verify before touching production data
**What:** Stand up the renamed schema in `portfolio` (or a throwaway Supabase project first, if available) fully — schema, RLS, functions, triggers, seed — and run the full `backend/api/test/rls` + `test/coach` suite against it with test data, before any real Ziko production row is copied.
**When:** Always, given this is described as an irreversible, production-data migration.
**Why:** `test/rls/*.spec.ts` already encodes the security contract (coach/client isolation, credit atomicity, waitlist RPCs); if it passes green against the renamed+relocated schema, the RLS rename didn't silently break isolation.

### Pattern 3: Scope `auth.users` triggers to the owning app before merging pools
**What:** Add an `app`/`source` discriminator (JWT `app_metadata` or a lookup) to `handle_new_user()` and `handle_new_user_credits()` (and inspect/patch any existing `rh_*`/`gecko_*` equivalents) so cross-app signups don't cross-pollinate side-effect tables.
**When:** Before the auth pools are merged — this cannot be fixed after the fact without a data-cleanup pass on any already-corrupted rows.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Editing existing migration files to rename tables in place
**What happens:** Someone opens `001_initial_schema.sql` and s/user_profiles/ziko_user_profiles/ directly.
**Why it's wrong:** Violates the repo's own "never edit an existing migration" rule (`CLAUDE.md`, `STRUCTURE.md`), and more importantly these files are the historical record of what's *already applied* to the `ziko` project — editing them does nothing to the live `ziko` database and creates drift between file and reality.
**Instead:** Author the renamed schema as a **new**, `portfolio`-targeted migration set (either one consolidated "create everything as ziko_*" migration replayed fresh, or a `supabase db diff`-generated set) — never mutate the historical `ziko` migration files.

### Anti-Pattern 2: Treating this as a pure find-and-replace on table names only
**What happens:** Table names get the `ziko_` prefix everywhere, but storage bucket IDs, RPC function names, and trigger function names are left unprefixed because "they're not tables."
**Why it's wrong:** Bucket IDs (`avatars`, `exports`) and generically-named functions (`award_xp`, `search_users_fuzzy`) share the same global namespace within `portfolio` as `rh_*`/`gecko_*` — a name collision either silently overwrites/reuses the wrong object or fails the migration outright.
**Instead:** Audit `portfolio`'s existing bucket list and function list (via Supabase MCP) before finalizing Ziko's renamed set; prefix defensively wherever a generic name is used today.

### Anti-Pattern 3: Repointing env vars before the schema/RLS/data verification is complete
**What happens:** `EXPO_PUBLIC_SUPABASE_URL` etc. get flipped to `portfolio` as soon as the schema exists, before RLS and data are verified, because "the app needs *something* to point at to test."
**Why it's wrong:** Real users on production mobile/web builds would start hitting a half-migrated project the moment any env var (especially the Vercel ones, which affect the live API/web immediately on redeploy) is flipped.
**Instead:** Verify fully against `portfolio` using a separate preview/staging deploy or local `.env.local` override first; flip production env vars (mobile via new build, Vercel via dashboard) only as the final, deliberate cutover step — mirroring the "delete `ziko` project" step's explicit-confirmation treatment already planned in PROJECT.md.

## Suggested Build/Execution Order

This directly follows from the dependency chain: schema must exist before RLS, RLS before functions/triggers that reference it, all of that before data copy, data before auth merge is meaningful, auth merge before any RLS relying on `auth.uid()` can be truly tested end-to-end, and env cutover last.

1. **Inventory `portfolio`'s existing state** (read-only, via Supabase MCP) — full table list, function list, trigger list (especially any `auth.users` triggers), bucket list, RLS policies. This is a prerequisite for every collision-avoidance decision below and was explicitly out of reach from this repo alone.
2. **Generate the authoritative rename map** from `ziko`'s live `information_schema` (not migration files alone, per the 73-vs-90-vs-100 discrepancy found above).
3. **Author the renamed schema as new migration(s)** targeting `portfolio` — tables, RLS policies, indexes, `SECURITY DEFINER` functions (with `auth.users`-trigger scoping added per the Critical Integration Point above), triggers, storage bucket definitions (prefixed).
4. **Apply schema-only to `portfolio`** (no data yet) — via `supabase db push` with correctly-versioned migration timestamps appended after `portfolio`'s existing history.
5. **Verify schema + RLS in isolation** — run `backend/api/test/rls/**` and `test/coach/**` against `portfolio` with synthetic/test data (not production Ziko data yet), confirming no collision with `rh_*`/`gecko_*` (e.g. run their smoke flows too, if feasible, to confirm zero regression).
6. **Codemod the application layer** — scripted rename of every `.from()`/`.rpc()`/`.storage.from()` string literal across `backend/api/src`, `apps/mobile`, `apps/web/src`, `plugins/*/src`, `supabase/seed.sql`, and the RLS test suite itself, using the same rename map from step 2. Run `npx turbo run type-check` (catches nothing table-name-related but confirms no syntax breakage) then re-run `test:rls`/`test:coach` against `portfolio`.
7. **Copy production data** — `auth.users` merge first (ID-preserving insert into the shared pool, with the trigger-scoping from step 3 already in place so it doesn't fire spurious side effects for the bulk import), then all `ziko_*` tables in FK-dependency order, then Storage objects into the renamed/prefixed buckets. Verify via row-count comparison + spot-sampling per milestone context (39 users, 1318 exercises, 1495 supplements, 3106 prices, etc.).
8. **End-to-end verification against real data** — run the full app (mobile dev client + web preview + backend pointed at `portfolio` via local/preview env override only) against the migrated data; confirm signed-URL upload/download flows work against the renamed buckets; confirm no `rh_*`/`gecko_*` regression (their own smoke tests/manual check, since this repo has no visibility into their code).
9. **Cutover env vars** — update `apps/mobile/.env` (+ new EAS build), `apps/web/.env.local` + Vercel web project env (Production + Preview), `backend/api/.env.local` + Vercel API project env, and the `SUPABASE_PROJECT_ID`/`SUPABASE_ACCESS_TOKEN` GitHub Actions secrets used by `migrate-supabase` in `ci.yml`. This is the first point real production traffic touches `portfolio`.
10. **Monitor + soak** — watch Sentry, `ai_cost_log`, and RLS test suite in CI against `portfolio` for a soak period before the irreversible step.
11. **Decommission `ziko` project** — last step, explicit separate confirmation, per the milestone's own stated plan.

## Scalability / Risk Considerations

| Concern | Risk if mishandled | Mitigation |
|---------|--------------------|--------------|
| `auth.users` triggers firing cross-tenant | Spurious `ziko_user_profiles`/credit rows for rh/gecko signups, or vice versa | Scope every `AFTER INSERT ON auth.users` trigger function to its owning app before merging pools (see Critical Integration Point) |
| Storage bucket / RPC function name collisions | Silent overwrite or migration failure | Inventory `portfolio` first (step 1); prefix defensively |
| CI migration history mismatch | `supabase db push` either skips Ziko's new migrations or tries to replay stale ones out of order against `portfolio`'s existing history | Use fresh, monotonically-later timestamp versions for all renamed Ziko migrations; do not reuse old `ziko`-era version numbers |
| Unscoped `authMiddleware` accepting any `portfolio` JWT | Cross-tenant token technically "authenticates" against Ziko routes, fails messily downstream instead of cleanly | Add an explicit "does a `ziko_user_profiles` row exist for this userId" gate immediately after JWT validation |
| Scale of literal-string rename (758+ call sites) | Manual editing misses call sites, causing runtime `relation "user_profiles" does not exist` errors post-cutover | Scripted rename from a single generated map (Pattern 1), gated by the RLS test suite, not manual review |

## Sources

- Direct repository inspection (HIGH confidence — this repo's own code, read 2026-09-21):
  - `supabase/migrations/001_initial_schema.sql`, `026_ai_credits.sql`, `035_coach_invitations_links_rls.sql`, `025_storage_buckets.sql`, `20260819065437_coach_metric_thresholds.sql`
  - `backend/api/src/middleware/auth.ts`, `backend/api/src/tools/db.ts`, `backend/api/src/routes/storage.ts`
  - `.github/workflows/ci.yml`
  - `apps/mobile/.env.example`, `apps/web/.env.example`, `backend/api/.env.example`
  - `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/PROJECT.md`
  - Grep across `backend/api/src`, `apps/mobile`, `apps/web/src`, `plugins/*/src`, `packages/coach-sdk/src`, `supabase/migrations`, `supabase/seed.sql`
- `portfolio` project internals (rh_*/gecko_* schema, existing functions/triggers/buckets) — **NOT verified from this repo**; MEDIUM/LOW confidence by extension until inspected directly via Supabase MCP tools against the live `portfolio` project (ref `ubxllsvanurkwkohzxau`) before execution begins.
