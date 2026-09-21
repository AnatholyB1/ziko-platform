# Project Research Summary

**Project:** Ziko Platform — Milestone v1.19 "Migration Supabase ziko → portfolio"
**Domain:** Cross-project Supabase migration (schema + data + auth + storage) into an existing, live, multi-tenant Supabase project
**Researched:** 2026-09-21
**Confidence:** MEDIUM

## Executive Summary

This is not a feature build — it is an infrastructure consolidation: moving Ziko's entire Supabase footprint (90+ migration files defining ~93-100 tables, ~20 `SECURITY DEFINER` RPCs, RLS on every table, 9 storage buckets, and 39 users worth of `auth.users`/`auth.identities`) out of its own dedicated project and into `portfolio`, a Supabase project that already hosts two unrelated live apps (`rh_*`, `gecko_*`) with their own tables, functions, buckets, and — critically — a shared `auth.users` pool. Every Ziko object gets a `ziko_` prefix (tables, and defensively also functions/buckets where names are generic enough to collide, e.g. `award_xp`, `avatars`). Experts building this kind of merge treat it as four largely independent tracks — schema/rename, auth merge, data copy, storage copy — that converge only at a tightly ordered data-copy step (auth must exist before FK-dependent rows load) and a final cutover step (env vars across backend/web/mobile, in that order, never simultaneously).

The recommended approach: dump `ziko`'s schema via `supabase db dump` (which conveniently excludes `auth`/`storage` by default, keeping the rename pass scoped to just the 93 application tables), apply the `ziko_` prefix as a **text-level rewrite of the raw SQL dump before execution** (not `ALTER TABLE RENAME` after the fact — Postgres does not rewrite table-name string literals embedded in `SECURITY DEFINER` function bodies, RLS policy `USING`/`WITH CHECK` clauses, or dynamic SQL), then author this as a **new** migration series for `portfolio` (never edit `ziko`'s historical migration files). Auth is merged via `supabase-js` Admin API `createUser({ id, password_hash, ... })` per user — verified against GoTrue source, not just docs — which preserves the original UUID so all 758+ `.from()`/`.rpc()` call sites across `backend/api`, `apps/mobile`, `apps/web`, and 19 plugin packages need only a literal table-name find/replace, not FK remapping. Storage has no cross-project copy API; it is a scripted per-object download/reupload with buckets renamed to a `ziko-` prefix and RLS policies rebuilt by hand.

The dominant risk is **not** technical difficulty of the mechanics (Supabase's dump/restore/auth-migration primitives are well-documented and HIGH confidence) — it is the compounding effect of merging into an already-populated shared project: (1) `auth.users` email/ID collisions between Ziko's 39 users and existing `rh_*`/`gecko_*` users, (2) two existing `AFTER INSERT ON auth.users` triggers (`handle_new_user`, `handle_new_user_credits`) that will fire for **every** signup on **any** app the moment the auth pool is shared, silently corrupting other tenants' data unless scoped by an `app` discriminator first, (3) RLS policies that "succeed" but silently return zero rows because a stale unprefixed table name resolves to nothing (or worse, to a same-named `rh_*`/`gecko_*` object), and (4) the mobile `EXPO_PUBLIC_*` build-time env-baking problem, where already-installed app binaries keep writing to `ziko` indefinitely after cutover — meaning the final "delete `ziko`" step (explicitly required by PROJECT.md as a separate confirmed action) cannot be scheduled off "web/backend redeployed," only off a verified mobile-tail drain plus a full per-table/per-bucket verification checklist and a cold-storage backup taken first.

## Key Findings

### Recommended Stack

The stack is almost entirely existing Supabase/Postgres tooling, not new dependencies: the Supabase CLI (`db dump`/`db push`), direct `psql`/`pg_dump`/`pg_restore` on a **session-mode** connection (never the 6543 transaction pooler — documented to break long-running dumps), and two small custom Node scripts (~50-100 lines each) using `pg` + `@supabase/supabase-js` for (a) the auth merge and (b) the storage object copy. No new runtime dependency lands in the shipped app — this is one-off ops tooling.

**Core technologies:**
- Supabase CLI 2.117.0 (`db dump`/`db push`) — official, version-matched `pg_dump`/`psql` wrapper; excludes `auth`/`storage` by default, which usefully scopes the rename pass to just the 93 app tables
- `supabase-js` Admin API `admin.createUser({ id, password_hash, ... })` — verified directly against GoTrue server source (not just docs) to accept and honor a client-supplied UUID and a pass-through bcrypt hash, making ID-preserving auth migration a first-class, currently-supported operation
- Custom Node script (`pg` read + `supabase-js` admin write) — per-user, per-row error isolation for the 39-user auth merge; safer than a bulk `COPY` into a shared, already-populated `auth.users` table
- `supabase-js` Storage client (`download`/`upload`) — the only supported cross-project object-copy path; no native bucket-to-bucket copy API exists

### Expected Features

Reframed for a migration: "table stakes" means steps a correct migration literally cannot skip; "differentiators" means safety nets that reduce risk but are not mandatory; "anti-features" means approaches that look appealing but are wrong at this scale (39 users, shared destination).

**Must have (table stakes):**
- Full inventory of `ziko` (tables, functions, RLS, triggers, storage, auth config, extensions, realtime publications) before writing any migration code — the baseline everything is verified against
- Schema export + `ziko_` prefix rewrite (tables, functions, triggers, custom types, sequences) done at the DDL-generation step, not post-hoc `ALTER TABLE RENAME`
- RLS re-created and verified **enabled with correct behavior** on all ~93 `ziko_*` tables — Supabase's own docs confirm RLS status is not migrated by restore
- Auth merge with IDs preserved, collision-checked (email + ID) against `portfolio`'s existing users, `auth.identities` copied alongside `auth.users` for OAuth-linked accounts
- Auth-pool triggers (`handle_new_user`, `handle_new_user_credits`) scoped to Ziko signups only before the pools merge — otherwise every `rh_*`/`gecko_*` signup gets spurious Ziko side effects and vice versa
- Data copy (COPY-based, triggers disabled during load) strictly after schema+RLS+functions are in place and after auth merge completes (FK dependency)
- Row-count parity + FK-integrity validation per table, not just "restore exited 0"
- Storage bucket + object migration with buckets renamed (`ziko-` prefix) and RLS policies hand-rebuilt, checksummed/counted, signed-URL flows re-tested with a real authenticated (non-service-role) session
- Three-surface env cutover (backend then web then mobile, in that order) each independently verified against real `portfolio` data
- Regression check on `rh_*`/`gecko_*` — a migration that works for Ziko but silently degrades the other two live apps is not correct
- Explicit, separate confirmation gate before deleting `ziko` — never bundled with "cutover looks good"

**Should have (differentiators):**
- Dry run against a scratch/staging Supabase project before touching `portfolio`
- Short write-freeze + final delta-sync immediately before cutover (far simpler than dual-write or logical replication at this scale)
- Automated, scripted verification suite (row counts, FK orphans, RLS-enabled check, storage counts) reused across dry run and production run
- Keep `ziko` alive read-only for a defined rollback window (days, tied to mobile-tail traffic, not indefinitely)
- Cold-storage backup (`pg_dump` + storage export) taken immediately before deletion, outside Supabase

**Defer / explicitly out of scope:**
- Any functional schema redesign beyond renaming/prefixing (PROJECT.md scope boundary)
- True zero-downtime dual-write or Postgres logical replication (standard replication cannot remap table names mid-stream; not justified at 39 users)
- Native mobile rebuild is P3 — EAS Update OTA covers the cutover without app-store review for already-installed apps that check for updates

### Architecture Approach

Ziko's data model does not change — this is a rename-and-relocate, not a re-architecture. All ~93-100 tables move under a `ziko_` prefix into `portfolio`'s shared `public` schema, alongside pre-existing `rh_*`/`gecko_*` tables; `auth.users` and `storage.objects` become genuinely shared across all three tenants. The single highest-risk integration point (not called out in the original milestone context, found by direct migration inspection) is that `auth.users` currently has two unscoped `AFTER INSERT` triggers (`handle_new_user`, `handle_new_user_credits`) that will fire for every signup on every app once the pool is shared, and the backend's `authMiddleware` (`backend/api/src/middleware/auth.ts`) accepts **any** valid `portfolio` JWT with no app/tenant check, failing open by omission rather than closed by design.

**Major components:**
1. **Schema/rename layer** — a generated old-name-to-`ziko_`-prefixed-name map, applied as a scripted rewrite to both a fresh migration series (never editing `ziko`'s historical files) and every `.from()`/`.rpc()` call site (~758 across `backend/api`, `apps/mobile`, `apps/web`, 19 plugin packages); `packages/coach-sdk` needs zero changes (schemas/types only, no queries)
2. **Auth merge layer** — ID-preserving `auth.users`/`auth.identities` copy via Admin API, gated by a pre-flight email/ID collision check, with `handle_new_user*` triggers scoped to Ziko before the pools merge
3. **Data copy layer** — COPY-based bulk load (triggers disabled), executed only after schema+RLS+functions exist and auth rows are present, followed by FK `VALIDATE CONSTRAINT` and orphan-detection queries
4. **Storage layer** — independent track (own inventory, own copy mechanism, own verification); buckets renamed `ziko-*`, RLS policies hand-rebuilt, objects copied via download/reupload script
5. **Cutover/verification layer** — CI (`migrate-supabase` job, GitHub secrets), Vercel env vars (2 independent projects: web, backend API), mobile `EXPO_PUBLIC_*` (build-time baked, OTA-updatable), and the existing `backend/api/test/rls`+`test/coach` suite repurposed as the migration's own correctness gate

### Critical Pitfalls

1. **`auth.users` email/ID collisions on merge** — a shared `auth.users` table means email uniqueness that was per-project becomes global; run the intersection query (`ziko` emails vs `portfolio` emails) before any auth write, and re-run it again immediately before the real cutover insert since `ziko` stays live and accepting signups until then.
2. **RLS policies and `SECURITY DEFINER` functions silently referencing stale unprefixed names** — this fails *silently* (RLS defaults to deny, which looks like "empty data," not a crash). Prevent via a scripted, DDL-level prefix rewrite (not manual regex), then grep `pg_policies`/`pg_proc` for any bare unprefixed table name post-apply, then run a per-table authenticated-query test (expect >0 rows as owner, 0 as non-owner) — a naive "does it run" smoke test will not catch this.
3. **Shared `auth.users` triggers firing cross-tenant** — `handle_new_user`/`handle_new_user_credits` must be scoped to Ziko signups (e.g. `app_metadata` discriminator) before the pools merge; check `portfolio` for any equivalent `rh_*`/`gecko_*` triggers first via Supabase MCP — do not assume none exist.
4. **Storage bucket/RLS breakage on copy** — object copy tools move bytes, not RLS policies or bucket settings; policies must be hand-rebuilt against the renamed buckets before objects land, and any user whose ID had to be remapped due to an email collision needs a matching storage-path-prefix rename in the same phase (the path-prefix RLS pattern embeds `auth.uid()` directly).
5. **Mobile env split-brain / premature `ziko` deletion** — `EXPO_PUBLIC_*` vars are baked into the binary at build time; already-installed apps keep writing to `ziko` until they update, which can take weeks. Deletion must be gated on a verified mobile-tail-drained state plus a full per-table/per-bucket checklist and a cold-storage backup — never on "cutover looked clean," and never in the same approval step as the cutover itself.

## Implications for Roadmap

Based on combined research, the phase structure should mirror the dependency chain surfaced independently by all four research files (inventory, schema/rename, auth merge, data copy, storage, cutover, decommission), with storage as a parallel track and decommission as a hard-gated final phase.

### Phase 1: Inventory and Pre-Flight Audit
**Rationale:** Every downstream decision (rename map, collision handling, extension reconciliation, trigger scoping) depends on knowing both projects' actual live state — not the stale migration-file count (PITFALLS/ARCHITECTURE both flag the milestone context's "73 migrations/93 tables" as understated; live grep found ~90 files / ~100 `CREATE TABLE` statements). `portfolio`'s internals (`rh_*`/`gecko_*` schema, existing triggers, functions, buckets) are invisible from this repo and must be inspected directly via Supabase MCP before any collision-avoidance decision can be made.
**Delivers:** Authoritative table/function/trigger/bucket/extension/RLS inventory for both projects; email/ID overlap report; extension version diff; capacity/quota check on `portfolio`.
**Addresses:** FEATURES.md table-stakes items "full inventory," "capacity/quota check," "extension availability check."
**Avoids:** Pitfall 5 (extension mismatch discovered mid-migration), Pitfall 1 (collision discovered too late).

### Phase 2: Schema Rename and Function/RLS Rewrite
**Rationale:** Nothing else can proceed until the `ziko_` prefix rename map is finalized and locked — data copy, function rewrites, and RLS all depend on final table names being known first (a hard predecessor per ARCHITECTURE's dependency chain).
**Delivers:** New (not edited) migration series targeting `portfolio`, with all tables/functions/triggers/types prefixed defensively where generic (`award_xp`, `search_users_fuzzy`, etc.), applied schema-only (no data) with fresh monotonic migration timestamps appended after `portfolio`'s existing history.
**Uses:** `supabase db dump` (schema-only, excludes auth/storage by default), text-level DDL rewrite before execution (not `ALTER TABLE RENAME`).
**Implements:** Schema/rename architecture layer; RLS re-creation.
**Avoids:** Pitfall 2 (stale name references) via automated `pg_policies`/`pg_proc` grep plus per-table authenticated-query test suite as the phase's own exit gate.

### Phase 3: Auth Merge
**Rationale:** Must complete before any data copy — FKs to `auth.users(id)` need the referenced rows to exist, and the collision/trigger-scoping decisions here directly determine whether data copy can even start cleanly.
**Delivers:** `auth.users`/`auth.identities` copied into `portfolio` with original UUIDs preserved (Admin API `createUser` with `password_hash` pass-through), `handle_new_user`/`handle_new_user_credits` scoped to Ziko-only signups, auth config (redirect URLs, email templates, JWT secret reuse of `portfolio`'s existing secret) merged additively.
**Addresses:** FEATURES.md "auth merge preserving IDs," "collision check," "auth config merge, not overwrite," "custom triggers reviewed for collision."
**Avoids:** Pitfall 1 (email/ID collision), Pitfall 3 (storage RLS breaking on ID remap — the auth-merge decision here determines whether Pitfall 3 is even in play), the JWT-secret technical-debt trap flagged in PITFALLS ("reusing Ziko's secret" is impossible in a shared project — accept one re-login for Ziko users).

### Phase 4: Data Copy and Integrity Verification
**Rationale:** Requires schema+RLS+functions (Phase 2) AND auth merge (Phase 3) both complete — this is the convergence point of the dependency graph.
**Delivers:** All `ziko_*` table data copied (COPY-based, triggers disabled during load), sequences reconciled via `setval` for any non-UUID PK, FK constraints re-validated (`VALIDATE CONSTRAINT`), row-count parity and orphan-detection checks run per table.
**Addresses:** FEATURES.md "data copy," "row-count parity," "FK integrity check."
**Avoids:** Pitfall 4 (sequence collisions surfacing only on the first post-cutover production INSERT), Pitfall 6 (orphaned FKs from partial/incremental copy — includes the final short-freeze delta-sync immediately before cutover).

### Phase 5: Storage Migration (parallel to Phases 2-4)
**Rationale:** Architecturally independent of the DB track — own inventory (buckets), own copy mechanism (object-level script, not SQL), own verification (checksums/counts, not row counts). Can be worked concurrently once bucket inventory (Phase 1) is known.
**Delivers:** 9 buckets recreated in `portfolio` with `ziko-` prefix, RLS policies hand-rebuilt (`storage.foldername(name)` pattern), objects copied with count/checksum verification, signed-URL flows re-tested with real authenticated sessions per plugin (pantry, scan-photos, exports, exercise-media, coach videos).
**Addresses:** FEATURES.md "storage bucket + object migration," "signed URL flow re-verification."
**Avoids:** Pitfall 3 (storage RLS/bucket-identity breakage) — explicitly re-verify after any Phase 3 ID remap.

### Phase 6: Cutover
**Rationale:** Gated on Phases 2-5 all passing verification — this is the first point real production traffic touches `portfolio`, sequenced backend then web then mobile per the ordered runbook PITFALLS recommends (never simultaneous, given two independent Vercel projects and mobile's build-time env baking).
**Delivers:** Backend, web, and mobile independently redeployed/rebuilt against `portfolio`, each functionally smoke-tested (real login, real read/write, AI chat round-trip, storage upload, coach CRM read) before the next surface flips; `rh_*`/`gecko_*` regression check confirming zero impact; CI (`migrate-supabase` job) and GitHub secrets repointed.
**Addresses:** FEATURES.md "env cutover — backend/web/mobile," "functional smoke test," "regression check on rh_/gecko_."
**Avoids:** Pitfall 7 (Vercel env propagation lag / split-brain), the unscoped-JWT gap flagged in ARCHITECTURE (add an explicit "does a `ziko_user_profiles` row exist" 403 gate).

### Phase 7: Monitoring and Decommission (hard-gated, separate)
**Rationale:** PROJECT.md itself requires this as a distinct, explicitly-confirmed final step — never bundled with "cutover looks good." Must wait for the mobile binary tail to drain (weeks, not days) since already-installed apps keep writing to `ziko` until they update.
**Delivers:** Defined monitoring/soak window (Sentry, `ai_cost_log`, RLS test suite in CI against `portfolio`), full per-table/per-bucket checklist (not spot checks), cold-storage `pg_dump`+storage export taken and confirmed retrievable, explicit separate human sign-off, then `ziko` project deletion (or pause-first if the plan supports it).
**Addresses:** FEATURES.md "explicit separate confirmation gate before deletion."
**Avoids:** Pitfall 8 (premature/unverified deletion — the one genuinely irreversible failure mode in the whole migration).

### Phase Ordering Rationale

- **Auth before data is non-negotiable**, confirmed independently by all three of FEATURES, ARCHITECTURE, and PITFALLS: every `ziko_*` FK to `auth.users(id)` needs the row to exist first, and resolving auth collisions may require ID remapping that the data-copy phase needs to already know about.
- **Schema rename must fully lock before functions/RLS/data copy**, because function bodies and policy `USING`/`WITH CHECK` clauses reference final table names as text, not as live OIDs that survive a later rename — get this wrong and the failure is silent (RLS deny, not an error).
- **Storage is decoupled deliberately** — none of the three research files found a dependency between the storage track and the DB track; running it in parallel shortens the critical path.
- **Decommission is structurally separated from cutover** by a monitoring window specifically to absorb the mobile-tail risk (Pitfall 7) and to leave a recovery path open if Phase 6's verification missed something (Pitfall 8's entire justification).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Inventory):** `portfolio`'s actual live internals (existing triggers on `auth.users`, function names, bucket names, extension versions) are entirely unknown from this repo — needs direct Supabase MCP inspection before the phase can even be scoped, not just implementation research.
- **Phase 2 (Schema Rename):** The prefix-rewrite tooling (DDL-level rename script handling `CREATE TABLE`/`REFERENCES`/policy bodies/function bodies consistently) has no first-party Supabase tool — this is custom tooling with real edge-case risk (dynamic SQL, `format()`-built queries) flagged LOW/MEDIUM confidence across all four files.
- **Phase 3 (Auth Merge):** The ID-preserving `createUser` approach is verified against GoTrue source (HIGH), but the "merge into an already-populated shared auth pool with collision resolution" strategy itself has no official Supabase doc — MEDIUM confidence, should be validated with a real dry run against a scratch project before touching `portfolio`.
- **Phase 6 (Cutover):** The mobile OTA-vs-native-rebuild strategy and the accepted "mobile tail" window length is a product/business decision, not purely technical — needs explicit discussion before planning, not just research.

Phases with standard patterns (skip research-phase):
- **Phase 4 (Data Copy):** Sequence reconciliation, FK validation, and row-count parity are well-documented, standard Postgres bulk-load patterns (HIGH confidence).
- **Phase 5 (Storage Migration):** The download/reupload pattern is a known (if unofficial) community pattern with clear verification steps (checksums, signed-URL re-test) — MEDIUM/HIGH confidence, mechanically straightforward even though no first-party tool exists.
- **Phase 7 (Decommission):** Purely procedural (checklist, backup, sign-off) — no technical research needed, just discipline in sequencing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH for CLI/pg_dump/Admin API mechanics (verified against official docs + GoTrue/auth-js source directly); MEDIUM for the overall auth-merge-into-shared-pool strategy (no official doc covers this exact scenario) |
| Features | MEDIUM — generic dump/restore/auth-migration steps are HIGH confidence (official docs); the prefix-rename-into-an-already-live-shared-project pattern specifically is not an officially documented Supabase workflow |
| Architecture | HIGH for this repo's own integration points (verified via direct grep/read: 758+ call sites, trigger definitions, middleware); MEDIUM/LOW for `portfolio`'s internals, which are invisible from this repo and must be inspected live before execution |
| Pitfalls | MEDIUM — synthesized from official auth-migration troubleshooting docs, Supabase CLI docs, and community GitHub discussions on `auth.identities`/storage RLS; no official "merge two live projects" playbook exists, so collision/trigger-scoping guidance is reasoned from Postgres/GoTrue fundamentals, not a canonical source |

**Overall confidence:** MEDIUM

### Gaps to Address

- **`portfolio`'s actual live schema/triggers/functions/buckets are completely unverified from this repo** — every collision-avoidance decision (trigger scoping, function/bucket prefixing, extension diff) is currently a recommendation based on assuming `rh_*`/`gecko_*` exist with unknown internals. Phase 1 must resolve this via Supabase MCP inspection before Phase 2 planning can be finalized.
- **True table/function count discrepancy** (PROJECT.md says 73 migrations/93 tables; live grep found ~90 files/~100 `CREATE TABLE` statements) — must be reconciled against `ziko`'s live `information_schema.tables`, not migration file counts, before generating the authoritative rename map.
- **Mobile-tail strategy (OTA vs. native rebuild, acceptable drain window) is a product decision**, not resolved by this research — needs explicit stakeholder input before Phase 6/7 can be scheduled with real dates.
- **Extension version/Postgres major version parity between `ziko` and `portfolio`** is unverified — must be checked (Dashboard, Settings, Infrastructure; `pg_extension` diff) as the very first pre-flight action, since it determines which dump/restore tool path (CLI-wrapped vs. raw `pg_dump`) is even viable.
- **Whether `portfolio`'s plan tier supports "pause" as an intermediate step before hard deletion** is unverified (PITFALLS flags this LOW confidence) — check before finalizing the Phase 7 decommission runbook.

## Sources

### Primary (HIGH confidence)
- `https://supabase.com/docs/reference/cli/supabase-db-dump` / `supabase-db-push` — official CLI reference, schema exclusion behavior, flag semantics
- `https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore` — official roles-then-schema-then-data sequence, `--no-owner --no-privileges`, `--use-copy --data-only`, `session_replication_role = replica`
- `supabase/auth-js` `src/lib/types.ts` (`AdminUserAttributes`) and `supabase/auth` `internal/api/admin.go` (`adminUserCreate`) — primary source, fetched directly, confirms ID/password-hash override is a first-class supported server behavior
- `https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects` — official, confirms JWT-secret invalidation caveat and that no one-size-fits-all auth migration script exists
- `https://supabase.com/docs/guides/self-hosting/restore-from-platform` — official, source for extension/Postgres-version mismatch failure behavior
- `https://docs.expo.dev/eas/environment-variables/usage/` and `https://docs.expo.dev/guides/environment-variables/` — official, confirms `EXPO_PUBLIC_*` build-time baking and EAS Update re-inlining behavior
- Direct repository inspection (this repo, 2026-09-21): `supabase/migrations/*.sql`, `backend/api/src/middleware/auth.ts`, `backend/api/src/tools/db.ts`, `.github/workflows/ci.yml`, `.env.example` files, `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`/`STRUCTURE.md`, full grep of `.from()`/`.rpc()` call sites across all workspaces

### Secondary (MEDIUM confidence)
- `https://github.com/orgs/supabase/discussions/35953`, `#36664` — community discussions on auth-user migration, corroborate official guidance but do not cover multi-tenant merge/collision specifically
- `https://supabase.com/docs/guides/troubleshooting/supabase-storage-inefficient-folder-operations-and-hierarchical-rls-challenges-b05a4d` — official, storage RLS/folder-hierarchy challenges
- `https://github.com/orgs/supabase/discussions/28160` — storage RLS folder-join pattern discussion
- `https://supabase.com/docs/reference/api/v1-run-a-query` — Management API shape (verification-only use case)
- Postgres logical replication table-name-matching limitation — corroborated across multiple PostgreSQL mailing-list threads, no single canonical doc

### Tertiary (LOW confidence)
- `https://gist.github.com/inian/78d2263f40abec6fae9b49ba58ea57f9` and other community storage-migration scripts — illustrate the download/reupload pattern only, not official; verify against current `@supabase/supabase-js` Storage API signatures before use
- Supabase project "pause before delete" availability on current plan tier — not independently verified, flagged for direct confirmation in Supabase dashboard

---
*Research completed: 2026-09-21*
*Ready for roadmap: yes*
