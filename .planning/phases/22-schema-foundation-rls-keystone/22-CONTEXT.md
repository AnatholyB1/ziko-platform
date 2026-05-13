# Phase 22: Schema Foundation & RLS Keystone — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM

<domain>
## Phase Boundary

Three migrations (034, 035, 036) land the v1.5 schema keystone:

- `user_profiles.role` enum (`'client' | 'coach' | 'both'`) + `coach_profiles` table with RLS
- `coach_invitations`, `coach_client_links`, `is_coach_of(coach, client)` SECURITY DEFINER STABLE function, `redeem_invitation_code` RPC
- `FOR SELECT` policy `(owner OR is_coach_of(auth.uid(), user_id))` on 11 athlete tables (habits, habit_logs, workout_sessions, session_sets, body_measurements, nutrition_logs, sleep_logs, cardio_sessions, hydration_logs, journal_entries, stretching_logs) — existing `FOR ALL` write policies untouched
- `workout_programs` extensions (`created_by_coach_id`, `assigned_to_user_id`, `is_template`, `weeks_data JSONB`, `template_source_id`) + `ai_imports` table
- 4-case smoke test proves: coach reads linked client / coach blocked on unlinked / revocation immediate / expired = revoked

**The phase is pure database + one Vitest spec. No mobile, no backend routes, no web — those start in Phase 23.**

**Out of phase (deferred to later milestones):**
- Coach onboarding UI (Phase 24)
- Mobile "Mon coach" redemption screen (Phase 25)
- CRM client list / tabs (Phase 26)
- Program template authoring (Phase 27)
- AI import upload/parse flow (Phase 28)
- Strava (Phase 30)

</domain>

<decisions>
## Implementation Decisions

### Link lifecycle & `is_coach_of()` (the keystone)

- **D-01** — `coach_client_links` uses **pure timestamps**, no `status` column. Columns: `revoked_at TIMESTAMPTZ NULL`, `expires_at TIMESTAMPTZ NULL`. Active row = `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`. This makes "expired = revoked" enforced at the predicate level — no cron, no drift risk.

- **D-02** — `is_coach_of(coach UUID, client UUID)` is a **SQL function**, `STABLE SECURITY DEFINER`, returning `boolean`. Body:
  ```sql
  EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = $1
      AND client_id = $2
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
  ```
  No PLPGSQL wrapper, no logging in the hot path (this function runs on every RLS row evaluation across 11 tables).

- **D-03** — Hardening matches existing pattern (migration 026 `earn_ai_credits`):
  - `SET search_path = public, pg_temp`
  - Schema-qualified table references (`public.coach_client_links`)
  - `REVOKE EXECUTE FROM PUBLIC`
  - `GRANT EXECUTE TO authenticated`

- **D-04** — Single RLS hot-path index: `CREATE UNIQUE INDEX coach_client_links_active_uq ON public.coach_client_links (coach_id, client_id) WHERE revoked_at IS NULL`. Doubles as the partial UNIQUE the roadmap requires. Add `CHECK (coach_id <> client_id)` per roadmap.

### Coach profiles, invitations, RPC

- **D-05** — `coach_profiles` minimum-viable column set (so Phase 24 onboarding form ships without ALTER):
  - `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `display_name TEXT NOT NULL`
  - `bio TEXT`
  - `specialties TEXT[]`
  - `website TEXT`
  - `photo_url TEXT`
  - `kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','submitted','verified','rejected'))`
  - `kyc_docs JSONB NOT NULL DEFAULT '[]'`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

- **D-06** — Invitation `code` stored **plaintext** with `UNIQUE` + `CHECK (code ~ '^[A-Z2-9]{6}$')`. Entropy (31^6 ≈ 887M) combined with Phase 25 rate limiting defeats brute force; plaintext allows the coach's invitations list to display active codes (Phase 25 success criterion 1 demands this).

- **D-07** — `coach_invitations` columns (full Phase 25 set, no follow-up ALTERs needed):
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$')`
  - `client_email TEXT NULL` (optional pre-fill)
  - `expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days'`
  - `used_at TIMESTAMPTZ NULL`
  - `used_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL`
  - `revoked_at TIMESTAMPTZ NULL`
  - `max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1)`
  - `use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0 AND use_count <= max_uses)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - Status (`active`/`used`/`expired`/`revoked`) is **derived**, not stored.

- **D-08** — `redeem_invitation_code(code_input TEXT) RETURNS JSONB` ships **constant-time** in Phase 22. Pattern:
  - Single uniform return shape `{ ok: boolean, link_id: UUID|null, error_code: TEXT|null }`
  - The function **always** performs the same query path regardless of which check fails (invalid code / expired / revoked / already used / self-invitation). Use a CTE that collects all validity facts in one SELECT, then a single CASE expression decides the return.
  - Use `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`.
  - Phase 25 layers Upstash IP+user rate limiting **on top** — no rewrite needed.
  - Planner: research the exact constant-time pattern (work-equalization vs `pg_sleep` floor); recommend work-equalization since `pg_sleep` makes the function slower than necessary and can still leak via early CPU-cycle differences.

### Cross-user RLS (the 11 tables)

- **D-RLS-01** — For each of the 11 cross-user readable tables (habits, habit_logs, workout_sessions, session_sets, body_measurements, nutrition_logs, sleep_logs, cardio_sessions, hydration_logs, journal_entries, stretching_logs):
  - The existing `FOR ALL` (owner-only) policy is **unchanged** — coaches never write client data.
  - A **new** `FOR SELECT` policy named `<table>_coach_read` is added: `USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id))`.
  - The existing `FOR ALL` policy `USING` clause **must remain** `auth.uid() = user_id` so coach reads don't accidentally inherit write privileges via `FOR ALL`.

- **D-RLS-02** — Migration 035 is the single migration that adds all 11 SELECT policies. It starts with `SET LOCAL lock_timeout = '5s'` to fail fast rather than hold ACCESS EXCLUSIVE locks during a deploy.

### `workout_programs` & `ai_imports` (migration 036)

- **D-09** — `ai_imports` ships **full Phase 28 schema** in migration 036 (so Phase 28 needs zero ALTERs):
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `file_url TEXT NOT NULL` (Supabase Storage path)
  - `original_filename TEXT NOT NULL`
  - `mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))`
  - `size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400)` (25 MB ceiling)
  - `page_count INTEGER NULL`
  - `mode TEXT NOT NULL CHECK (mode IN ('athlete','coach_template'))`
  - `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploaded','parsing','ready','failed','committed'))`
  - `parsed_data JSONB NULL`
  - `confidence_scores JSONB NULL`
  - `error_message TEXT NULL`
  - `credit_transaction_id UUID NULL` (FK pluggable — Phase 28 wires this to the credit ledger row)
  - `committed_program_id UUID NULL REFERENCES public.workout_programs(id) ON DELETE SET NULL`
  - `re_upload_source_id UUID NULL REFERENCES public.ai_imports(id) ON DELETE SET NULL` (self-FK for Phase 28 diff feature)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `parsed_at TIMESTAMPTZ NULL`
  - `committed_at TIMESTAMPTZ NULL`

- **D-10** — `ai_imports` ships with **owner-only RLS in Phase 22**: `ENABLE ROW LEVEL SECURITY` + single policy `ai_imports_own FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. No coach `FOR SELECT` policy — coaches don't share read on athletes' imports (a coach who imports in `coach_template` mode owns those rows themselves).

- **D-11** — `workout_programs.weeks_data JSONB` is validated by **Zod only** via `packages/coach-sdk` (Phase 23). **No DB CHECK.** Schema can evolve without migrations. Safety relies on ARCH-03 (no service-role under `coach/`); the planner must call this out in PLAN.md so reviewers understand the trade-off.

- **D-12** — `workout_programs` extension columns ship with **full FKs and `ON DELETE SET NULL`** (matches Open Architectural Decision #4 — preserves coach's authored content on athlete deletion pending GDPR review):
  - `created_by_coach_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL`
  - `assigned_to_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL`
  - `template_source_id UUID NULL REFERENCES public.workout_programs(id) ON DELETE SET NULL`
  - `is_template BOOLEAN NOT NULL DEFAULT FALSE`
  - `weeks_data JSONB NULL` (no CHECK — see D-11)

### Smoke test & migration safety

- **D-13** — 4-case smoke test = Vitest spec at `backend/api/test/rls/coach-rls.spec.ts`. Three Supabase clients in the suite:
  - admin (service-role) for setup/teardown
  - coach anon client (JWT for a test coach user)
  - client anon client (JWT for a test athlete user)

  Four cases (matching success criterion 5):
  1. Coach reads habit_logs of a linked athlete → rows returned.
  2. Coach reads habit_logs of an unlinked athlete → zero rows.
  3. Setup link, then `UPDATE coach_client_links SET revoked_at = now()` → coach immediately returns zero rows on next SELECT.
  4. Setup link with `expires_at = now() - interval '1 hour'` → coach returns zero rows (no cron required).

  CI gate: this spec runs on every PR that touches `supabase/migrations/**` or the function/policy bodies, against a Supabase branch.

- **D-14** — Existing `user_profiles` rows are backfilled by single metadata-only ALTER: `ADD COLUMN role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','coach','both'))`. PG11+ fast path means no rewrite of existing rows.

- **D-15** — Three migration files exactly as roadmap-named:
  - `034_coach_role_profiles.sql` — `user_profiles.role` + `coach_profiles` table + its RLS.
  - `035_coach_invitations_links_rls.sql` — `coach_invitations`, `coach_client_links` (with CHECK + partial UNIQUE), `is_coach_of()`, `redeem_invitation_code()`, the 11 cross-user `FOR SELECT` policies. Starts with `SET LOCAL lock_timeout = '5s'`.
  - `036_workout_programs_ai_imports.sql` — `workout_programs` extension columns + `ai_imports` + its RLS.

  Each file is one transactional unit. Rollback granularity is by file.

- **D-16** — All DDL goes through Supabase MCP `apply_migration` — writes the file to `supabase/migrations/` AND applies to the linked project in one step. No `execute_sql` for data backfill (the `DEFAULT 'client'` on the role column handles it).

### Claude's Discretion

The planner has flexibility on (and is expected to research before locking):
- The exact constant-time pattern inside `redeem_invitation_code` (work-equalization shape, whether `pg_sleep` floor is needed, how to surface error codes without timing leaks).
- The list of `error_code` values returned by `redeem_invitation_code` (e.g. `INVALID_CODE`, `EXPIRED`, `REVOKED`, `ALREADY_USED`, `SELF_INVITATION`, `LINK_EXISTS`).
- Updated-at trigger pattern (re-use the project's existing `set_updated_at()` trigger if one exists, otherwise a single shared one).
- Whether `coach_profiles` and `coach_invitations` RLS policies are added in 034/035 respectively or split — but they must exist by end of 035 so the smoke test can run.
- The exact test-user-creation pattern in the Vitest spec (Supabase admin `auth.admin.createUser` is the canonical path).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — vision, key decisions log
- `.planning/REQUIREMENTS.md` §ARCH-07 — RLS keystone requirement (the foundation of this phase)
- `.planning/STATE.md` — v1.5 scoping decisions, especially the Phase 22 HIGH risk callout on `is_coach_of()` recursion / revocation bypass
- `.planning/ROADMAP.md` §Phase 22 — success criteria (the 5 items)
- `.planning/ROADMAP.md` §Open Architectural Decisions — Decision #4 (ON DELETE SET NULL on `assigned_to_user_id`)
- `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md` — v1.5 research baseline

### Existing patterns to reuse
- `supabase/migrations/026_ai_credits.sql` — canonical `SECURITY DEFINER SET search_path = public` hardening + RPC return-shape pattern; reuse for `is_coach_of()` and `redeem_invitation_code`
- `supabase/migrations/027_earn_rpc.sql` — RPC + audit trail pattern
- `supabase/migrations/001_initial_schema.sql` — base RLS conventions and `<table>_own` policy naming
- Any existing `set_updated_at()` trigger pattern in the migrations folder — discover and reuse

### Codebase intel
- `.planning/codebase/CONVENTIONS.md` — RLS policy naming, migration conventions
- `.planning/codebase/STRUCTURE.md` — where backend tests live (Vitest spec location)
- `.planning/codebase/STACK.md` — Supabase + Postgres versions in play

### Future phases that depend on these schemas (do NOT modify these tables without coordination)
- Phase 23: `packages/coach-sdk` Zod schemas — `weeks_data` shape is defined there, not in DB
- Phase 24: `coach_profiles` populated by onboarding form
- Phase 25: `redeem_invitation_code` RPC consumed by mobile, Upstash rate limit added on top
- Phase 28: `ai_imports` consumed by upload/parse/preview/commit flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SECURITY DEFINER SET search_path = public` pattern** (`supabase/migrations/026_ai_credits.sql`): exact template for hardening `is_coach_of()` and `redeem_invitation_code()`. Already proven in v1.4 prod.
- **RLS policy naming `<table>_own`** (every migration since 001): new SELECT policies should follow with `<table>_coach_read` so audit greps remain readable.
- **`SET LOCAL lock_timeout`** pattern in migration 035 — required because that migration touches 11 existing tables with active production data.
- **Supabase MCP `apply_migration`**: the v1.4 milestone (migrations 017–033) ran entirely on this tool; team is comfortable with it.

### Established Patterns
- Every cross-user table currently has a single `FOR ALL` policy `USING (auth.uid() = user_id)`. Phase 22 **keeps that** and **adds** a separate `FOR SELECT` `USING (auth.uid() = user_id OR is_coach_of(...))`. Postgres OR-combines policies of the same command (`FOR SELECT`), so the new policy is additive — but the existing `FOR ALL` must keep `auth.uid() = user_id` only, otherwise coach reads would inadvertently grant write paths.
- Migrations live exclusively in `supabase/migrations/NNN_<slug>.sql`. There is no `db/seed` for this phase — only DDL.
- Backend tests live under `backend/api/test/` (Vitest); the RLS spec is a new subfolder `rls/`.

### Integration Points
- `backend/api/src/coach/` — does NOT exist yet (lands in Phase 24). Phase 22 ships **no TypeScript code** under `coach/`; the only TS deliverable is the Vitest spec.
- `packages/coach-sdk` — does NOT exist yet (lands in Phase 23). Phase 22 does NOT define Zod schemas. The `weeks_data` JSONB shape is documented in this CONTEXT.md and PLAN.md but the canonical schema lives in coach-sdk once it exists.

### Constraints from the existing architecture
- ARCH-03 (Phase 24+) — no `SERVICE_ROLE` references under `coach/`. Phase 22 setup of test fixtures uses admin client only inside `backend/api/test/rls/`, never under `src/`.
- ARCH-07 — `is_coach_of` is the SOLE pattern for cross-user RLS reads. No ad-hoc `coach_client_links` JOINs allowed in policies.

</code_context>

<specifics>
## Specific Ideas

- The user emphasized **"no cron risk"** by selecting timestamp-based lifecycle + inline predicate. Planner: any future suggestion to add a cron that touches `coach_client_links` lifecycle must be rejected at review.
- The user accepted Zod-only validation for `weeks_data` — this is a deliberate trade-off favoring schema agility over DB-enforced integrity. Planner: PLAN.md must call this out as an explicit decision so the reviewer sees the trade-off.
- The user chose **full Phase 28 schema** for `ai_imports`. Phase 28 planner gets a head start — but Phase 22 planner must double-check the column set against any Phase 28 research artifacts before writing migration 036.
- All four areas received the recommended option without modification — the user is aligned with the conservative, codebase-pattern-matching default. Treat that as ratification of the existing v1.0–v1.4 conventions, not just this phase.

</specifics>

<deferred>
## Deferred Ideas

(None — discussion stayed inside Phase 22 scope. The following items were considered but explicitly belong to later phases:)

- `coach_profiles` admin verification workflow (`verified_by`, `verified_at`, `rejection_reason`) — deferred to v1.6+.
- GIN index on `workout_programs.weeks_data` for program search — not needed until search UI lands (out of v1.5 scope).
- Multi-use invitation codes (group/bulk invitations) — `max_uses` column ships in Phase 22 with DEFAULT 1, but the UX to set `max_uses > 1` is deferred.
- IP / user-agent forensics on `coach_invitations` redemption — defer until GDPR review and abuse evidence justify the PII storage.
- `coach_client_tags` and `coach_client_notes` tables — explicitly Phase 26 scope (CRM Client Management), not Phase 22.
- Coach AI audit table `ai_tool_audit` — explicitly Phase 29 scope.
- `strava_accounts`, `strava_webhook_events`, `cardio_sessions.external_strava_id` — explicitly Phase 30 (migration 037).
- Per-request user-JWT Supabase client wiring (ARCH-03) — explicitly Phase 23/24.

</deferred>

---

*Phase: 22-schema-foundation-rls-keystone*
*Context gathered: 2026-05-13*
