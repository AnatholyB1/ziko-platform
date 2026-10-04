# Roadmap: Migration Supabase ziko → portfolio (v1.19)

## Overview

Ziko's entire Supabase footprint — ~93 tables, ~20 SECURITY DEFINER functions, RLS on every table, 9 storage buckets, and 39 users' worth of `auth.users`/`auth.identities` — moves out of its dedicated `ziko` project (`slkobhavpwsubnsmuhya`) into `portfolio` (`ubxllsvanurkwkohzxau`), a shared project already hosting `rh_*` and `gecko_*` tenants. The journey runs inventory-first (nothing else can be scoped without knowing both projects' live state), then locks the `ziko_` rename map and rebuilds functions/RLS against it, merges auth with IDs preserved (a hard predecessor to any data copy because of FK dependencies), copies and verifies data, migrates storage as an independent parallel track, executes an ordered backend→web→mobile cutover with zero regression on the existing tenants, and only then — after a monitored rollback window and a second, separate human confirmation — deletes the old `ziko` project. This is a one-shot infrastructure consolidation, not iterative feature work: there is no v2.

## Phases

**Phase Numbering:** Independent numbering for this workstream (`supabase-portfolio-migration`), starting at Phase 1. Not continuous with the root project or other workstreams.

- [x] **Phase 1: Inventory & Pre-Flight Audit** - Both Supabase projects' live state (schema, auth, storage, extensions) is fully known and cross-checked before any migration code is written (completed 2026-09-22)
- [x] **Phase 2: Schema Rename & Function/RLS Rewrite** - Every ziko schema object exists in portfolio under a `ziko_` prefix, functionally identical, with zero stale unprefixed references (completed 2026-10-01)
- [x] **Phase 3: Auth Merge** - Ziko's 39 users exist in portfolio's shared auth pool with IDs preserved and no cross-tenant side effects (completed 2026-10-01)
- [x] **Phase 4: Data Copy & Integrity Verification** - All ziko production data exists in portfolio with verified row-count parity and FK integrity (completed 2026-10-02)
- [x] **Phase 5: Storage Migration** - All ziko storage buckets and objects exist in portfolio, fully functional under real authenticated sessions (completed 2026-10-02)
- [x] **Phase 6: Cutover** - Backend, web, and mobile all run against portfolio in production with zero regression on rh_*/gecko_*
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
- [x] 03-03-PLAN.md — ReloginNotice email template (FR/EN) + dry-run-default Resend send script (AUTHMIG-05)
- [x] 03-04-PLAN.md — In-app re-login notice (web): coach CRM banner, date-driven, inert until Phase 6 (AUTHMIG-05, partial)
- [x] 03-05-PLAN.md — Collision gate + idempotent single-transaction auth import + scratch collision seeding (AUTHMIG-01, AUTHMIG-02)
- [x] 03-06-PLAN.md — Stage-aware trigger apply, live waitlist setval, 06-verify suite (AUTHMIG-01, AUTHMIG-02, AUTHMIG-03)
- [x] 03-07-PLAN.md — Management API read-merge-write for uri_allow_list + RUNBOOK (AUTHMIG-04)
- [x] 03-08-PLAN.md — Scratch rehearsal: import, GoTrue login proof, idempotence, triggers, real signups, full verify (AUTHMIG-01, AUTHMIG-02, AUTHMIG-03)
- [x] 03-09-PLAN.md — Checkpoint: access token; config merge rehearsal on scratch + portfolio preview (AUTHMIG-04)
- [x] 03-10-PLAN.md — Disable auto-chain, read-only portfolio pre-flight + typed-phrase checkpoint before first portfolio write (AUTHMIG-01..04)
- [x] 03-11-PLAN.md — [BLOCKING] Portfolio import, triggers, sequence, full verification; uuid-remap.json for Phase 4 (AUTHMIG-01, AUTHMIG-02, AUTHMIG-03)
- [x] 03-12-PLAN.md — [BLOCKING] Portfolio uri_allow_list merge + diff (if authorized); retire token unconditionally (AUTHMIG-04)
- [x] 03-13-PLAN.md — In-app re-login notice (mobile): one-time showAlert, date-driven, inert until Phase 6 (AUTHMIG-05, partial)

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
**Plans**: 7 plans

Plans:
- [x] 04-01-PLAN.md — Wave 0: install pg/pg-copy-streams, gitignore, lib-data pure loader helpers (table plan, ziko_-only builders, remap transform) + tests (DATA-01)
- [x] 04-02-PLAN.md — lib-verify pure checks (counts, RLS, triggers, corrected FK discovery, orphans, sequences without nextval, remap, tenants, report sanitizer) + tests (DATA-02..05)
- [x] 04-03-PLAN.md — lib-conn (login-role, session pooler, verified TLS) + 05-load-data CLI (--plan/--probe/--apply, guarded truncate, per-table replica COPY, setval) (DATA-01, DATA-02)
- [x] 04-04-PLAN.md — 06-verify-data re-runnable suite (--check all, JSON + masked summary) + RUNBOOK Phase 4 section (DATA-03..05)
- [x] 04-05-PLAN.md — Checkpoint PAT; scratch auth precondition, probe, full load + verify, reload + verify (DATA-01..05)
- [x] 04-06-PLAN.md — Disable auto-chain, read-only portfolio pre-flight + tenants baseline, typed-phrase checkpoint (DATA-01, DATA-03, DATA-04)
- [x] 04-07-PLAN.md — [BLOCKING] Portfolio load + --check all + tenants; retire token on every path (DATA-01..05)

### Phase 5: Storage Migration
**Goal**: All ziko storage buckets and objects exist in portfolio, fully functional under real authenticated sessions
**Depends on**: Phase 1 (bucket inventory) — architecturally independent of Phases 2-4, can run in parallel
**Requirements**: STORAGE-01, STORAGE-02, STORAGE-03, STORAGE-04
**Success Criteria** (what must be TRUE):
  1. All 9 buckets exist in portfolio, renamed with a `ziko-` prefix (live inventory 2026-10-02: 10 buckets incl. empty `coach-videos`; the live count governs)
  2. Object count and checksums match between source and destination buckets
  3. Storage RLS policies (`storage.foldername` pattern) are rebuilt and enforce the same per-user access as on ziko
  4. Signed-URL upload/download flows succeed end-to-end using a real authenticated (non-service-role) session, re-tested per plugin that uses storage
**Plans**: 11 plans

Plans:
- [x] 05-01-PLAN.md — Wave 0 TDD: lib-storage pure helpers (bucket map/config diff, re-key, policy rewrite, URL rewrite, evaluators) (STORAGE-01, STORAGE-02, STORAGE-03)
- [x] 05-02-PLAN.md — Bucket-name codemod script (--scan/--apply/--check, per-deployable STORAGE_BUCKETS constants) + fixture tests (STORAGE-01, STORAGE-04)
- [x] 05-03-PLAN.md — Generate bucket map + ziko_ storage policies migration from live ziko, stale-reference check, guarded apply (STORAGE-01, STORAGE-03)
- [x] 05-04-PLAN.md — 08-copy-storage: read-only plan + add-only idempotent apply, live bucket config, re-key, SHA-256 round trip, no delete path (STORAGE-01, STORAGE-02)
- [x] 05-05-PLAN.md — 09-verify-storage suite: buckets/policies/objects/hashes/rekey/urls/tenants, PII-safe JSON (STORAGE-01, STORAGE-02, STORAGE-03)
- [x] 05-06-PLAN.md — Loader in-flight storage-URL rewrite (D-05) + live URL scan in --plan (STORAGE-02)
- [x] 05-07-PLAN.md — STORAGE-04 auth harness: throwaway users, real JWTs, backend in-process + web live spec, guaranteed cleanup (STORAGE-04)
- [x] 05-08-PLAN.md — Apply codemod, type-check/test, capture patch + unmerged branch gsd/phase-5-bucket-codemod, restore tree (STORAGE-01, STORAGE-04)
- [x] 05-09-PLAN.md — Checkpoint PAT; scratch rehearsal: policies, copy, loader re-run, verify all, full auth matrix, idempotent re-run, RUNBOOK (STORAGE-01..04)
- [x] 05-10-PLAN.md — Disable auto-chain, read-only portfolio pre-flight + baselines, typed-phrase checkpoint (STORAGE-01..04)
- [x] 05-11-PLAN.md — [BLOCKING] Portfolio policies, copy, loader re-run, verify all, auth smoke; retire token on every path (STORAGE-01..04)

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
**Carried from Phase 5 (explicit smoke-test items; 17/17 closed, but the 6 mobile UI items are WAIVED with API-level evidence only):**
- [x] backend (ziko-coach-kyc): GET /coach/clients/links/me: full-route smoke against portfolio after the table-name codemod (proof: scripts/portfolio-migration/reports/prod-backend-storage-auth.json case bk-clients-links-me (26/26 PASS, production API on portfolio, 06-15))
- [x] backend (ziko-coach-videos): POST /coach/videos/upload-url: full-route smoke against portfolio after the table-name codemod (proof: prod-backend-storage-auth.json case bk-videos-upload-url (06-15))
- [x] backend (ziko-coach-videos): GET /coach/videos/:videoId/signed-url: full-route smoke against portfolio after the table-name codemod (proof: prod-backend-storage-auth.json cases bk-videos-signed-url (+foreign deny) (06-15))
- [x] backend (ziko-coach-videos): GET /coach/videos/annotations/:annotationId/audio-url: full-route smoke against portfolio after the table-name codemod (proof: prod-backend-storage-auth.json cases bk-videos-audio-url (+foreign deny) (06-15))
- [x] backend (ziko-coach-exercises): GET /coach/exercises/:id/media-url: full-route smoke against portfolio after the table-name codemod (proof: prod-backend-storage-auth.json cases bk-exercises-media-url (+2 deny) (06-15))
- [x] backend (ziko-ai-imports): POST /coach/imports: full-route smoke against portfolio after the table-name codemod (proof: prod-backend-storage-auth.json case bk-imports-create (06-15))
- [x] mobile profile (ziko-avatars): avatar upload and display (D-10 UI-level flow) (WAIVED, not device-tested (checklist row M-01, 06-18 waiver). API-level only: case av-public-read in prod-backend-storage-auth.json)
- [x] mobile profile (ziko-profile-photos): profile photo upload, display and remove (D-02 quirk expected: private bucket, public SELECT policy, no DELETE policy) (WAIVED, not device-tested (M-02, 06-18 waiver). API-level only: cases pp-baseline-public-url, sp-* in prod-backend-storage-auth.json)
- [x] mobile workout (ziko-exercise-media): exercise media display in the exercise screen and picker (WAIVED, not device-tested (M-03, 06-18 waiver). API-level only: case em-public-read)
- [x] plugin-nutrition (ziko-scan-photos): scan photo upload via /storage/upload-url and display (WAIVED, not device-tested (M-04, 06-18 waiver). API-level only: cases sp-sign-upload-own, sp-backend-own/foreign)
- [x] plugin-coach (ziko-coach-logos): coach logo display (WAIVED, not device-tested (M-05, 06-18 waiver). API-level only: case cl-public-read)
- [x] web coach (ziko-coach-kyc): KYC document upload and api/photo display (proof: scripts/portfolio-migration/reports/prod-web-storage-auth.json cases ck-web-upload-url-own/foreign, ck-web-photo-foreign (26/26, 06-16); browser W-01 not exercised, scripted coverage accepted by the user)
- [x] web coach (ziko-coach-exercises): coach exercise media upload (proof: checklist W-02 (06-16 Task 4: upload accepted, storage write to portfolio OK; one orphan test PNG left in ziko-coach-exercises))
- [x] web coach (ziko-coach-logos): coach logo upload and branding preview (proof: checklist W-03 (06-16 Task 4: migrated logo renders in the branding preview; replace not exercised) + case cl-public-read in prod-web-storage-auth.json)
- [x] web coach (ziko-ai-imports): coach AI import upload (proof: bk-imports-create + ai-foreign-read in prod-web-storage-auth.json (06-16); browser W-04 not exercised, scripted coverage accepted by the user)
- [x] mobile athlete + web coach (ziko-coach-videos): athlete video upload and coach view (WAIVED, not run end to end (M-06 and W-05 never done, 06-18 waiver). API-level only: bk-videos-upload-url, bk-videos-signed-url)
- [x] codemod (all ziko- buckets): re-run 11-codemod-buckets.mjs --apply on a fresh main (or rebase gsd/phase-5-bucket-codemod), run --check with its repo-wide residual pass, merge together with the Vercel env flip, never before (proof: phases/06-cutover/06-CUTOVER-SMOKE-CHECKLIST.md S-7, 06-08 and 06-15 summaries (--check clean, merged with the flip via PR #38))

**Status: CLOSED 2026-10-04 by user decision, with waivers (no mobile users yet).** Originally recorded as not complete; open items below are waived or carried to Phase 7. API crons fixed in 3b14e19a (cron routers mounted before authMiddleware, GET accepted). Backend flipped 2026-10-03 14:29Z, web flipped 15:08Z, CI repointed; final tenant checks on data, storage and auth show no rh_/gecko_ regression (scripts/portfolio-migration/reports/portfolio-cutover-final.json). Open: (a) mobile flip not achieved: iOS unreleased, Android submitted to Play but Play Console state unconfirmed, app never device-tested against portfolio (checklist waived); (b) API crons return 401 (pre-existing since at least 2026-09-29, not caused by the flip); (c) AI chat never verified on portfolio (Anthropic balance empty, waived throughout); (d) Preview/Development Vercel env scopes of shared web records may still hold ziko values and SUPABASE_PUBLISHABLE_KEY on ziko-web untouched; (e) CI verify secrets point at scratch, two remote timing specs skip on CI (PR #40); (f) credential retirement (06-20 Task 3) pending. Verdict lines: SCRATCH CUTOVER REHEARSAL PASS, PREVIEW SMOKE PASS, CUTOVER DELTA PASS, BACKEND FLIP SMOKE PASS, WEB FLIP SMOKE PASS (W-01/W-04 by scripted coverage), CI REPOINT PASS, MOBILE INTERNAL CHECKLIST WAIVED, MOBILE FLIP NOT ACHIEVED. Phase closed with the mobile flip and device checklist waived.

**Plans**: 20 plans (18 complete incl. 06-18 with waiver; 06-19 partial; 06-20 Tasks 1-2 done)

Plans:
- [x] 06-01-PLAN.md — Wave 0 TDD: 12-codemod-tables.mjs, map-driven table/RPC/embed(alias)/realtime codemod with fail-closed scan and repo-wide --check (CUTOVER-01)
- [x] 06-02-PLAN.md — Wave 0: 13-cutover-delta.mjs single-gate delta orchestrator (auth -> reload -> add-only storage -> --check all) + tests (CUTOVER-03, CUTOVER-04)
- [x] 06-03-PLAN.md — Wave 0: lib-cutover + 14-signup-isolation + 15-smoke-core-flows, self-cleaning temp users (CUTOVER-03, CUTOVER-04)
- [x] 06-04-PLAN.md — Wave 0: 16-ci-migration-guard, frozen legacy manifest, migrate-supabase replaced by dormant ref-locked migrate-portfolio (CUTOVER-05)
- [x] 06-05-PLAN.md — Wave 0: 17-env-switch (local/Vercel/EAS, audited matrix, flip = rollback with --target) (CUTOVER-01, CUTOVER-02)
- [x] 06-06-PLAN.md — RLS fixture app flag (D-18), smoke checklist (17 carried items + core flows), authorization log, RUNBOOK Phase 6 (CUTOVER-03, CUTOVER-04)
- [x] 06-07-PLAN.md — [BLOCKING] Disable auto-chain; merge working line into main with migrate job dormant (typed phrase) (CUTOVER-05, CUTOVER-03)
- [x] 06-08-PLAN.md — gsd/phase-6-cutover: apply bucket + table codemods, fkey hint map, zero residuals, green checks (CUTOVER-01)
- [x] 06-09-PLAN.md — Signup flag at every call-site (D-14); 6 deferred coach routes become real harness cases (CUTOVER-03, CUTOVER-04)
- [x] 06-10-PLAN.md — Checkpoint PAT; scratch rehearsal: delta, RLS suite, full harness, isolation, local core flows (CUTOVER-03, CUTOVER-04)
- [x] 06-11-PLAN.md — Local env files -> portfolio; local backend/web/mobile run proofs, read-only (CUTOVER-01)
- [x] 06-12-PLAN.md — [BLOCKING] Vercel previews with branch-scoped env -> portfolio; scripted smoke + tenant diff (typed phrase) (CUTOVER-02, CUTOVER-03, CUTOVER-04)
- [x] 06-13-PLAN.md — Read-only delta pre-flight, pre-cutover baselines, typed-phrase checkpoint (CUTOVER-03, CUTOVER-04)
- [x] 06-14-PLAN.md — [BLOCKING] Final delta on portfolio + --check all; human review (CUTOVER-03, CUTOVER-04)
- [x] 06-15-PLAN.md — [BLOCKING] Backend flip: API prod env, merge cutover PR, pin web, prod API smoke, rollback path (CUTOVER-02, CUTOVER-03, CUTOVER-04)
- [x] 06-16-PLAN.md — [BLOCKING] Web flip: prod env, rebuild + promote, scripted + manual web smoke (CUTOVER-02, CUTOVER-03, CUTOVER-04)
- [x] 06-17-PLAN.md — [BLOCKING] CI repoint: secrets + PORTFOLIO_MIGRATIONS_ENABLED, proving CI run (CUTOVER-05)
- [x] 06-18-PLAN.md — [BLOCKING] Mobile flip: EAS env, version 1.5.0, internal build, device checklist + signup-landing proof (CUTOVER-03, CUTOVER-04) — COMPLETE WITH WAIVER: the device checklist (M-01..M-12, W-05) was waived by the user, `MOBILE INTERNAL CHECKLIST: WAIVED`, never device-tested against portfolio
- [x] 06-19-PLAN.md — [BLOCKING] v1.5.0 store release via release.yml; submission states (CUTOVER-03) — PARTIAL, `MOBILE FLIP: NOT ACHIEVED`: v1.5.0 failed at Setup EAS, v1.5.1 built Android but iOS failed (provisioning profile lacks Sign in with Apple); Android 1.5.0 (versionCode 16) was submitted manually to the Play production track (user decision), iOS unreleased, Play Console state unconfirmed
- [x] 06-20-PLAN.md — Final tenant regression, leftovers, crons; docs + Phase 7 hand-off; credential retirement on every path (CUTOVER-01..05) — Tasks 1-2 done, Task 3 (credential retirement) pending

### Phase 7: Monitoring & Decommission
**Goal**: ziko is retired and deleted only after a monitored rollback window, full per-table/per-bucket verification, and a second, separate human confirmation — never bundled with cutover sign-off
**Depends on**: Phase 6
**Requirements**: DECOM-01, DECOM-02, DECOM-03, DECOM-04, DECOM-05
**Success Criteria** (what must be TRUE):
  1. ziko is kept live in read-only mode for the defined rollback window, tied to mobile binary renewal rather than a fixed calendar date (WAIVED by user 2026-10-04, D-01: no rollback window; write-freeze before backup instead)
  2. A cold backup (`pg_dump` + storage export) of ziko has been taken and confirmed restorable
  3. The full per-table/per-bucket checklist (no sampling) has been completed and passes for every `ziko_*` table and bucket
  4. **The user has given an explicit, separate confirmation — distinct from and after cutover sign-off — specifically authorizing deletion of the `ziko` project**
  5. The `ziko` project is deleted only after criteria 1-4 above are all satisfied, and the deletion is logged as the final, deliberate action of the milestone
**Plans**: 22 plans

Plans:
- [x] 07-01-PLAN.md — Wave 0 TDD: 18-decom-guard (ref guards, 10-key gate file, D-15 plain-yes checker), 07-AUTHORIZATIONS.md, backup .gitignore (DECOM-04, DECOM-05)
- [x] 07-02-PLAN.md — DECOM-01 recorded as WAIVED by hand (REQUIREMENTS/ROADMAP/STATE), RUNBOOK Phase 7 section (DECOM-01)
- [ ] 07-03-PLAN.md — Wave 0 TDD: 19-decom-freeze (grant snapshot, REVOKE/replay, signup toggle, T0==T1 proof) (DECOM-02)
- [ ] 07-04-PLAN.md — Wave 0: lib-decom-storage + 20-decom-backup primitives (pg_dump argv/env, manifest, checksums, gpg AES256 encrypt/decrypt) (DECOM-02)
- [ ] 07-05-PLAN.md — Wave 0 TDD: 22-decom-verify evaluators (PK subset, post-flip extras, row content digest, object subset, tenant delta) (DECOM-03)
- [ ] 07-06-PLAN.md — Wave 0 TDD: 23-decom-env-audit (Vercel all scopes, EAS, CI by fingerprint/ref, gated remediation) (DECOM-05)
- [ ] 07-07-PLAN.md — Wave 0 TDD: 24-decom-delete fail-closed delete/confirm-gone/log for ziko|scratch (DECOM-04, DECOM-05)
- [ ] 07-08-PLAN.md — Wave 0 TDD: 21-decom-restore-proof (scratch wipe, restore, same-name verify) (DECOM-02)
- [ ] 07-09-PLAN.md — Checkpoint: install pg client tools; live probes (pg_dump, project identity/Vercel-managed, freeze rehearsal on scratch) (DECOM-02, DECOM-05)
- [ ] 07-10-PLAN.md — Freeze ziko (REVOKE + signup off) and T0 snapshot (DECOM-02)
- [ ] 07-11-PLAN.md — Cold backup encrypted + verified, freeze proof, second copy checkpoint (DECOM-02)
- [ ] 07-12-PLAN.md — Restore proof on wiped scratch (DECOM-02)
- [ ] 07-13-PLAN.md — Full frozen-ziko vs portfolio verification, verify_pass gate or STOP (DECOM-03)
- [ ] 07-14-PLAN.md — [BLOCKING] Env scope audit + approved remediation (D-12a) (DECOM-05)
- [ ] 07-15-PLAN.md — [BLOCKING] CI off scratch, green CI, stale token ziko-ci-portfolio revoked (D-12b) (DECOM-05)
- [ ] 07-16-PLAN.md — [BLOCKING] Scratch project deletion with its own approval (DECOM-05)
- [ ] 07-17-PLAN.md — [BLOCKING] D-15 explicit separate confirmation: plain yes to delete ziko, own plan (DECOM-04)
- [ ] 07-18-PLAN.md — [BLOCKING] Fail-closed ziko delete via Management API, dashboard fallback, confirm gone (DECOM-05)
- [ ] 07-19-PLAN.md — [BLOCKING] Credential retirement after deletion (D-14), user revokes PAT (DECOM-05)
- [ ] 07-20-PLAN.md — Docs close-out, then deletion log as the final milestone action (DECOM-01..05)
- [ ] 07-21-PLAN.md — Wave 0: 20-decom-backup CLI (--init-passphrase, --probe-tools, --schema-probe, --run with pg_dump + COPY layer + storage export, --verify-archive); runs in wave 3 (DECOM-02)
- [ ] 07-22-PLAN.md — Wave 0: 22-decom-verify CLI (guards, read-only live collection, existing integrity/auth/tenant verifiers as child steps); runs in wave 4 (DECOM-03)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 (Phase 5 may run concurrently with 2-4 once Phase 1's bucket inventory is complete)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Inventory & Pre-Flight Audit | 2/2 | Complete   | 2026-09-22 |
| 2. Schema Rename & Function/RLS Rewrite | 7/7 | Complete    | 2026-10-01 |
| 3. Auth Merge | 13/13 | Complete    | 2026-10-01 |
| 4. Data Copy & Integrity Verification | 7/7 | Complete    | 2026-10-02 |
| 5. Storage Migration | 11/11 | Complete    | 2026-10-02 |
| 6. Cutover | 20/20 | Complete (mobile flip and device checklist waived; PAT revocation by user pending) | 2026-10-04 |
| 7. Monitoring & Decommission | 2/22 | In Progress|  |
