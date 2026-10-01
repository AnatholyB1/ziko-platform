# Roadmap: Migration Supabase ziko → portfolio (v1.19)

## Overview

Ziko's entire Supabase footprint — ~93 tables, ~20 SECURITY DEFINER functions, RLS on every table, 9 storage buckets, and 39 users' worth of `auth.users`/`auth.identities` — moves out of its dedicated `ziko` project (`slkobhavpwsubnsmuhya`) into `portfolio` (`ubxllsvanurkwkohzxau`), a shared project already hosting `rh_*` and `gecko_*` tenants. The journey runs inventory-first (nothing else can be scoped without knowing both projects' live state), then locks the `ziko_` rename map and rebuilds functions/RLS against it, merges auth with IDs preserved (a hard predecessor to any data copy because of FK dependencies), copies and verifies data, migrates storage as an independent parallel track, executes an ordered backend→web→mobile cutover with zero regression on the existing tenants, and only then — after a monitored rollback window and a second, separate human confirmation — deletes the old `ziko` project. This is a one-shot infrastructure consolidation, not iterative feature work: there is no v2.

## Phases

**Phase Numbering:** Independent numbering for this workstream (`supabase-portfolio-migration`), starting at Phase 1. Not continuous with the root project or other workstreams.

- [x] **Phase 1: Inventory & Pre-Flight Audit** - Both Supabase projects' live state (schema, auth, storage, extensions) is fully known and cross-checked before any migration code is written (completed 2026-09-22)
- [x] **Phase 2: Schema Rename & Function/RLS Rewrite** - Every ziko schema object exists in portfolio under a `ziko_` prefix, functionally identical, with zero stale unprefixed references (completed 2026-10-01)
- [ ] **Phase 3: Auth Merge** - Ziko's 39 users exist in portfolio's shared auth pool with IDs preserved and no cross-tenant side effects
- [ ] **Phase 4: Data Copy & Integrity Verification** - All ziko production data exists in portfolio with verified row-count parity and FK integrity
- [ ] **Phase 5: Storage Migration** - All ziko storage buckets and objects exist in portfolio, fully functional under real authenticated sessions
- [ ] **Phase 6: Cutover** - Backend, web, and mobile all run against portfolio in production with zero regression on rh_*/gecko_*
- [ ] **Phase 7: Monitoring & Decommission** - ziko is retired and deleted only after a monitored rollback window, full verification, and a second explicit human confirmation

## Phase Details

### Phase 1: Inventory & Pre-Flight Audit
**Goal**: Both Supabase projects' actual live state is fully known and cross-checked before any migration decision (rename map, collision handling, trigger scoping, extension reconciliation) is made
**Depends on**: Nothing (first phase)
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05
**Success Criteria** (what must be TRUE):
  1. A live `information_schema`-derived inventory of `ziko` exists (tables, functions, RLS, triggers, buckets, extensions, realtime) — not a migration-file count
  2. A live inventory of `portfolio`'s existing `rh_*`/`gecko_*` footprint exists (tables, functions, triggers on `auth.users`, buckets, extensions)
  3. A collision report lists every email/ID overlap between ziko's 39 users and portfolio's existing users
  4. Postgres version and extension versions are diffed between the two projects, with any mismatch documented
  5. portfolio's available DB size, connection, and storage quota are confirmed sufficient for ziko's data volume
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — ziko + portfolio live inventory, version/extension diff, capacity/quota check with human plan-tier checkpoint (INV-01, INV-02, INV-04, INV-05)
- [x] 01-02-PLAN.md — PII-safe collision report, finalize and commit 01-INVENTORY.md (INV-03)

### Phase 2: Schema Rename & Function/RLS Rewrite
**Goal**: Every ziko schema object exists in portfolio under a `ziko_` prefix, functionally identical to the original, with zero stale unprefixed references anywhere in DDL, function bodies, or policies
**Depends on**: Phase 1
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05
**Success Criteria** (what must be TRUE):
  1. A new migration series (ziko's own migration history untouched) applies to portfolio and creates all tables under the `ziko_` prefix
  2. All SECURITY DEFINER functions/RPCs (`deduct_ai_credits`, `is_coach_of`, `record_athlete_decision`, etc.) execute successfully against the renamed tables
  3. RLS is enabled with correct policies active on all ~93 `ziko_*` tables
  4. An automated grep of `pg_policies`/`pg_proc` confirms zero unprefixed table-name references
  5. A full dry run of the rename has completed successfully on a scratch Supabase project before being applied to portfolio
**Plans**: 7 plans

Plans:
- [x] 02-01-PLAN.md — Generate the rename map from ziko's live schema (tables/functions/types, extension-owned functions excluded), resolve D-04's pg_net/unaccent dependency from live evidence (SCHEMA-01)
- [x] 02-02-PLAN.md — Provision the scratch Supabase project via the Vercel dashboard (Pitfall 1, checkpoint) and link it locally (SCHEMA-05)
- [x] 02-03-PLAN.md — Dump and rewrite ziko's schema into the new ziko_-prefixed migration series (tables/RLS + functions/triggers/grants) (SCHEMA-01, SCHEMA-02, SCHEMA-03)
- [x] 02-04-PLAN.md — Build the stale-reference grep + authenticated RLS smoke-test verification tooling (SCHEMA-03, SCHEMA-04)
- [x] 02-05-PLAN.md — [BLOCKING] Apply the migration series to the scratch project and run full verification (SCHEMA-05, SCHEMA-04, SCHEMA-03)
- [x] 02-06-PLAN.md — Checkpoint: human confirms the scratch dry run before the real portfolio apply (SCHEMA-05)
- [x] 02-07-PLAN.md — [BLOCKING] Apply the migration series to portfolio for real and run full verification — phase completion (SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05)

### Phase 3: Auth Merge
**Goal**: Ziko's 39 users exist in portfolio's shared auth pool with IDs preserved and no cross-tenant side effects from shared `auth.users` triggers
**Depends on**: Phase 2
**Requirements**: AUTHMIG-01, AUTHMIG-02, AUTHMIG-03, AUTHMIG-04, AUTHMIG-05
**Success Criteria** (what must be TRUE):
  1. All 39 ziko `auth.users` rows exist in portfolio with identical UUIDs and working password hashes
  2. `auth.identities` rows are copied for every OAuth-linked account
  3. `handle_new_user`/`handle_new_user_credits` fire only for Ziko signups after the merge — verified by a test signup on rh_*/gecko_* producing zero Ziko-side effects
  4. portfolio's auth config (redirect URLs, email templates) contains both ziko's entries and the pre-existing ones, with nothing overwritten
  5. Ziko users have been informed that a re-login will be required post-cutover
  6. `ziko_waitlist_founder_seq` is set to ziko's live value (87 on 2026-10-01 — re-read live before setting) via `setval`; Phase 2 creates the sequence fresh and does not carry the value
**Plans**: 13 plans

Plans:
- [x] 03-01-PLAN.md — Wave 0: scripts/auth-merge/lib.mjs + node:test, read-only portfolio baseline snapshot (AUTHMIG-01, AUTHMIG-04)
- [x] 03-02-PLAN.md — Gated trigger functions + separate trigger DDL + rolled-back probe; Phase 6 signup-path hand-off; Phase 4 UUID-remap spec (AUTHMIG-03, AUTHMIG-01)
- [ ] 03-03-PLAN.md — ReloginNotice email template (FR/EN) + dry-run-default Resend send script (AUTHMIG-05)
- [ ] 03-04-PLAN.md — In-app re-login notice (web): coach CRM banner, date-driven, inert until Phase 6 (AUTHMIG-05, partial)
- [ ] 03-05-PLAN.md — Collision gate + idempotent single-transaction auth import + scratch collision seeding (AUTHMIG-01, AUTHMIG-02)
- [ ] 03-06-PLAN.md — Stage-aware trigger apply, live waitlist setval, 06-verify suite (AUTHMIG-01, AUTHMIG-02, AUTHMIG-03)
- [ ] 03-07-PLAN.md — Management API read-merge-write for uri_allow_list + RUNBOOK (AUTHMIG-04)
- [ ] 03-08-PLAN.md — Scratch rehearsal: import, GoTrue login proof, idempotence, triggers, real signups, full verify (AUTHMIG-01, AUTHMIG-02, AUTHMIG-03)
- [ ] 03-09-PLAN.md — Checkpoint: access token; config merge rehearsal on scratch + portfolio preview (AUTHMIG-04)
- [ ] 03-10-PLAN.md — Disable auto-chain, read-only portfolio pre-flight + typed-phrase checkpoint before first portfolio write (AUTHMIG-01..04)
- [ ] 03-11-PLAN.md — [BLOCKING] Portfolio import, triggers, sequence, full verification; uuid-remap.json for Phase 4 (AUTHMIG-01, AUTHMIG-02, AUTHMIG-03)
- [ ] 03-12-PLAN.md — [BLOCKING] Portfolio uri_allow_list merge + diff (if authorized); retire token unconditionally (AUTHMIG-04)
- [ ] 03-13-PLAN.md — In-app re-login notice (mobile): one-time showAlert, date-driven, inert until Phase 6 (AUTHMIG-05, partial)

### Phase 4: Data Copy & Integrity Verification
**Goal**: All ziko production data exists in portfolio with verified integrity and zero loss
**Depends on**: Phase 2, Phase 3
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. Every `ziko_*` table has been loaded via COPY with triggers disabled during load and re-enabled after
  2. Sequences for non-UUID PKs are reconciled via `setval` and a subsequent insert succeeds without collision
  3. Row counts match exactly between ziko (source) and portfolio (destination) for every table
  4. All FK constraints pass `VALIDATE CONSTRAINT` with zero orphaned rows detected
  5. The verification suite (row counts, RLS-enabled check, FK orphans) is committed to the repo and re-runnable on demand
**Plans**: TBD

### Phase 5: Storage Migration
**Goal**: All ziko storage buckets and objects exist in portfolio, fully functional under real authenticated sessions
**Depends on**: Phase 1 (bucket inventory) — architecturally independent of Phases 2-4, can run in parallel
**Requirements**: STORAGE-01, STORAGE-02, STORAGE-03, STORAGE-04
**Success Criteria** (what must be TRUE):
  1. All 9 buckets exist in portfolio, renamed with a `ziko-` prefix
  2. Object count and checksums match between source and destination buckets
  3. Storage RLS policies (`storage.foldername` pattern) are rebuilt and enforce the same per-user access as on ziko
  4. Signed-URL upload/download flows succeed end-to-end using a real authenticated (non-service-role) session, re-tested per plugin that uses storage
**Plans**: TBD

### Phase 6: Cutover
**Goal**: Backend, web, and mobile all run against portfolio in production, sequenced and verified one surface at a time, with zero regression on existing tenants
**Depends on**: Phase 2, Phase 3, Phase 4, Phase 5
**Requirements**: CUTOVER-01, CUTOVER-02, CUTOVER-03, CUTOVER-04, CUTOVER-05
**Success Criteria** (what must be TRUE):
  1. Local env files (`apps/mobile/.env`, `apps/web/.env.local`, `backend/api/.env.local`) point to portfolio and each app runs locally against it
  2. Vercel env vars for both the web and backend API projects are updated and redeployed
  3. Backend, then web, then mobile are each independently smoke-tested and confirmed working against portfolio before the next surface flips — never simultaneously
  4. rh_* and gecko_* functionality shows zero regression after the merge
  5. CI's `migrate-supabase` job and GitHub secrets are repointed to portfolio, and a subsequent CI run succeeds
**Plans**: TBD

### Phase 7: Monitoring & Decommission
**Goal**: ziko is retired and deleted only after a monitored rollback window, full per-table/per-bucket verification, and a second, separate human confirmation — never bundled with cutover sign-off
**Depends on**: Phase 6
**Requirements**: DECOM-01, DECOM-02, DECOM-03, DECOM-04, DECOM-05
**Success Criteria** (what must be TRUE):
  1. ziko is kept live in read-only mode for the defined rollback window, tied to mobile binary renewal rather than a fixed calendar date
  2. A cold backup (`pg_dump` + storage export) of ziko has been taken and confirmed restorable
  3. The full per-table/per-bucket checklist (no sampling) has been completed and passes for every `ziko_*` table and bucket
  4. **The user has given an explicit, separate confirmation — distinct from and after cutover sign-off — specifically authorizing deletion of the `ziko` project**
  5. The `ziko` project is deleted only after criteria 1-4 above are all satisfied, and the deletion is logged as the final, deliberate action of the milestone
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 (Phase 5 may run concurrently with 2-4 once Phase 1's bucket inventory is complete)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Inventory & Pre-Flight Audit | 2/2 | Complete   | 2026-09-22 |
| 2. Schema Rename & Function/RLS Rewrite | 7/7 | Complete    | 2026-10-01 |
| 3. Auth Merge | 2/13 | In Progress|  |
| 4. Data Copy & Integrity Verification | 0/TBD | Not started | - |
| 5. Storage Migration | 0/TBD | Not started | - |
| 6. Cutover | 0/TBD | Not started | - |
| 7. Monitoring & Decommission | 0/TBD | Not started | - |
