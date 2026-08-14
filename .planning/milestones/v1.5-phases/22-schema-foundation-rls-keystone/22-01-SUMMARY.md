---
phase: 22-schema-foundation-rls-keystone
plan: 01
subsystem: test-infrastructure
tags: [vitest, rls, supabase, ci, foundation, wave-0]
dependency_graph:
  requires: []
  provides:
    - "Vitest v3 runner usable by all backend/api/test/** specs"
    - "Reusable Supabase test fixtures (admin/anon/authed clients + createTestUser/cleanupTestUsers)"
    - "CI gate (test-rls.yml) for PRs touching supabase migrations or RLS specs"
    - "ARCH-03 spatial confinement: service-role key only loaded under backend/api/test/"
  affects:
    - "Phases 22-02, 22-03, 22-04 (every DDL plan now has a way to author RLS spec files)"
    - "Future Phase 24+ coach modules (CI guard prevents service-role leak into src/)"
tech_stack:
  added:
    - "vitest@^3.2.4"
    - "@vitest/coverage-v8@^3.2.4"
    - "dotenv@^17.4.2"
  patterns:
    - "TDD RED → GREEN gate sequence (test commit then feat commit)"
    - "fileParallelism: false to serialize RLS mutations on auth.users"
    - "per-test randomUUID()-suffixed @ziko.test emails to avoid collisions"
    - "FK CASCADE on auth.users for one-call cleanup of dependent rows"
key_files:
  created:
    - "backend/api/vitest.config.ts"
    - "backend/api/test/setup.ts"
    - "backend/api/test/rls/fixtures.ts"
    - "backend/api/test/rls/fixtures.test.ts"
    - "backend/api/.env.test.example"
    - ".github/workflows/test-rls.yml"
  modified:
    - "backend/api/package.json"
    - "backend/api/.gitignore"
decisions:
  - "Add `--passWithNoTests` flag to test/test:rls scripts so empty suites exit 0 (Vitest v3 default is exit-1 on empty discovery)"
  - "Pin @vitest/coverage-v8 to ^3 to match vitest@^3 peer (npm latest is v4 which conflicts)"
  - "Leave root package-lock.json out of plan commits per user constraint; lockfile update from npm install is a working-tree change for the user to commit separately"
  - "Keep `SUPABASE_PUBLISHABLE_KEY` naming consistent with CLAUDE.md (not `SUPABASE_ANON_KEY`)"
metrics:
  duration_seconds: 540
  completed_date: "2026-05-14"
  tasks_completed: 3
  files_changed: 8
  commits: 4
---

# Phase 22 Plan 01: Vitest Foundation + RLS Test Scaffolding Summary

One-liner: Vitest v3 installed in backend/api with a 4-export test-fixtures module (admin/anon/authed Supabase clients + createTestUser/cleanupTestUsers), a self-test green against the live project, and a path-filtered CI workflow gating PRs that touch supabase/migrations or RLS specs.

## What Was Built

### Task 22-01-01 — Test runner scaffold (commit `0a14f8e`)
- Installed `vitest@^3.2.4`, `@vitest/coverage-v8@^3.2.4`, `dotenv@^17.4.2` as devDeps under `backend/api/`.
- Added `test`, `test:watch`, `test:rls` npm scripts (`test` and `test:rls` use `--passWithNoTests` so an empty suite still exits 0).
- Created `backend/api/vitest.config.ts` with node env, 30s timeouts, `setupFiles: ['./test/setup.ts']`, `fileParallelism: false`, sequential test order — RLS suite mutates `auth.users` so parallelism would race.
- Created `backend/api/test/setup.ts` loading `.env.test` via dotenv and asserting `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are present. File header carries `SERVICE-ROLE ONLY IN TESTS` banner.
- Created `backend/api/.env.test.example` documenting the three required vars (no secrets).
- Appended `.env.test` and `coverage/` to `backend/api/.gitignore`; explicitly whitelisted `.env.test.example` so the docs example stays tracked.

### Task 22-01-02 — Fixtures + self-test (TDD RED `268b999` → GREEN `e20832a`)
- Created `backend/api/test/rls/fixtures.test.ts` first (RED) — failed to load (`Failed to load url ./fixtures`) confirming the gate.
- Created `backend/api/test/rls/fixtures.ts` (GREEN) exporting:
  - `TestUser` interface (`{ id, email, password, client }`)
  - `getAdminClient()` — service-role client with `autoRefreshToken: false`, `persistSession: false`
  - `getAnonClient()` — publishable-key client
  - `getAuthedClient(email, password)` — anon client signed in via `signInWithPassword`
  - `createTestUser(prefix)` — `auth.admin.createUser` with `email_confirm: true`, then signs in; email is `${prefix}-${randomUUID().slice(0,8)}@ziko.test`
  - `cleanupTestUsers(ids)` — iterates `auth.admin.deleteUser`; relies on FK CASCADE for `user_profiles` (handle_new_user trigger creates the row; we do not insert it manually)
- Self-test runs all 4 cases against the live Supabase project (`slkobhavpwsubnsmuhya.supabase.co`) — pass in ~2s.
- Grep audit: `SUPABASE_SERVICE_ROLE_KEY|service[_-]role` returns zero matches under `backend/api/src/` — ARCH-03 spatial confinement holds.

### Task 22-01-03 — CI workflow (commit `5ffb62a`)
- Created `.github/workflows/test-rls.yml` with:
  - `pull_request` path filter scoped to `supabase/migrations/**`, `backend/api/test/rls/**`, `backend/api/vitest.config.ts`, `backend/api/package.json`, and the workflow itself.
  - `workflow_dispatch` for manual runs.
  - Steps: checkout → setup-node@v4 (Node 20, npm cache) → `npm ci` in `backend/api/` → write `.env.test` from `SUPABASE_TEST_*` secrets → `npm run test:rls -- --run` → ARCH-03 guard step that greps `backend/api/src/` for service-role references and fails the build on any match.
  - Header comment documents that until repo secrets `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` are set, runs will fail-skip — acceptable for Wave 0 since no DDL ships here.
- YAML parses cleanly (js-yaml validation).

## Acceptance Criteria — Verified

- `test -f backend/api/vitest.config.ts` ✔
- `test -f backend/api/test/setup.ts` ✔
- `test -f backend/api/test/rls/fixtures.ts` ✔
- `test -f backend/api/test/rls/fixtures.test.ts` ✔
- `test -f backend/api/.env.test.example` ✔
- `test -f .github/workflows/test-rls.yml` ✔
- `grep -q '"vitest"' backend/api/package.json` ✔
- `grep -q '"test:rls"' backend/api/package.json` ✔
- `grep -q 'setupFiles.*setup\.ts' backend/api/vitest.config.ts` ✔
- `grep -qE '^\.env\.test$' backend/api/.gitignore` ✔
- `grep -q 'SERVICE-ROLE ONLY IN TESTS' backend/api/test/rls/fixtures.ts` ✔
- `grep -E 'export (async )?function (createTestUser|getAdminClient|cleanupTestUsers|getAuthedClient)' backend/api/test/rls/fixtures.ts` → 4 matches ✔
- `grep -rE 'SUPABASE_SERVICE_ROLE_KEY|service[_-]role' backend/api/src/` → no matches ✔
- `npm run --prefix backend/api test` → exit 0, 4/4 passing ✔
- `npm run --prefix backend/api test:rls` → exit 0, 4/4 passing ✔
- All path filters, `npm run test:rls -- --run`, and "service-role reference detected" guard string present in `test-rls.yml` ✔

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@vitest/coverage-v8` peer-dep collision**
- **Found during:** Task 22-01-01 install step.
- **Issue:** `npm install -D vitest@^3 @vitest/coverage-v8 dotenv` failed: npm resolved `@vitest/coverage-v8@4.1.6` which requires `vitest@4.1.6`, conflicting with `vitest@^3` request.
- **Fix:** Pinned coverage to `^3` explicitly: `@vitest/coverage-v8@^3`. Both now resolve to `3.2.4` together.
- **Files modified:** `backend/api/package.json`
- **Commit:** `0a14f8e`

**2. [Rule 3 - Blocking] Vitest exits non-zero on empty suite**
- **Found during:** Task 22-01-01 verify step (`npm run test` against empty `test/`).
- **Issue:** Plan acceptance criteria requires exit 0 with "No test files found", but Vitest v3 default behavior is exit-1.
- **Fix:** Added `--passWithNoTests` to both `test` and `test:rls` scripts. This is forward-safe because once Task 02 adds real tests, the flag is a no-op.
- **Files modified:** `backend/api/package.json`
- **Commit:** `0a14f8e`

### Documentation/cosmetic adjustments

**3. Lowercased "service-role" in CI guard echo string**
- **Reason:** Plan acceptance criteria `grep -q "service-role reference detected"` is case-sensitive; my first write used "Service-role" (capital S).
- **Fix:** Changed echo to lowercase.
- **Commit:** `5ffb62a`

### Constraint compliance — root `package-lock.json`

- The npm install in Task 1 mutated the root `package-lock.json` (+1703/-185 lines of transitive deps for vitest, @vitest/coverage-v8, dotenv).
- Per the user's hard constraint (`Do NOT touch [package-lock.json]`), I did NOT include the lockfile in any task commit.
- **Implication for downstream consumer:** `npm ci` at root will currently fail until the lockfile change is committed separately, or installed deps will not be reproducible from the lockfile alone. The user owns this decision because they explicitly carved package-lock.json out of scope.
- **Recommended follow-up (for the user, not this plan):** Run `git add package-lock.json && git commit -m "chore: lockfile from 22-01 vitest install"` after reviewing the unrelated pre-existing dirty changes in the working tree.

### Pre-existing dirty working tree — left untouched

Per user constraint, the following remain untouched throughout this plan:
- `apps/mobile/app.json` (M)
- `apps/mobile/app/(app)/index.tsx` (M)
- `apps/mobile/eas.json` (M)
- `apps/mobile/package.json` (M)
- `apps/mobile/src/hooks/` (??)
- `package-lock.json` (M) — see note above
- `supabase/.temp/**` (??)
- `docs/superpowers/plans/2026-05-11-*.md` (??)

## Auth Gates Encountered

None. The local `backend/api/.env.local` already carried `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_KEY` (legacy name); I copied these into a new gitignored `backend/api/.env.test` mapping `SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` per Phase 22 naming. The 4 fixture self-tests passed on the first GREEN run against the linked project (`slkobhavpwsubnsmuhya.supabase.co`).

## TDD Gate Compliance

Plan-level test type: per-task `tdd="true"` on Task 02. Verified in git log:
- RED: `268b999` `test(22-01): add failing fixture self-tests (RED)` — fails to load (`Failed to load url ./fixtures`)
- GREEN: `e20832a` `feat(22-01): implement RLS test fixtures (GREEN)` — 4/4 pass
- REFACTOR: not needed (fixtures implementation matched the planned shape; no cleanup commit).

## Threat Surface — Mitigations Applied

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-22-09 (E — service-role leak into runtime source) | mitigate | `SERVICE-ROLE ONLY IN TESTS` banner in `fixtures.ts` + `setup.ts`; CI guard step in `test-rls.yml` greps `backend/api/src/` for `SUPABASE_SERVICE_ROLE_KEY` or `service[_-]role` and fails build on match. Audit at commit time: 0 matches under `src/`. |
| T-22-09b (I — `.env.test` accidentally committed) | mitigate | `.env.test` added to `backend/api/.gitignore`; `git check-ignore backend/api/.env.test` returns ignored. Only `.env.test.example` (no secrets) tracked. |
| (low-risk S — email collisions in parallel runs) | accept | `fileParallelism: false`, `sequence.concurrent: false`, per-call `randomUUID()` suffix on `@ziko.test` (non-routable). |

## Known Stubs

None. The fixtures module is fully functional and self-tested against a live Supabase target.

## Local Supabase Target

- **Project:** linked to `slkobhavpwsubnsmuhya.supabase.co` (per `supabase/.temp/linked-project.json`, untracked).
- **Mode:** remote linked project, NOT `supabase start` local stack.
- **Test users created:** `fixture-*@ziko.test` and `fixture-delete-*@ziko.test` — all cleaned up by `afterAll` hook (verified by `cleanupTestUsers actually deletes the user` case).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `0a14f8e` | chore | Install vitest v3 + scaffold test runner config |
| `268b999` | test | Add failing fixture self-tests (RED) |
| `e20832a` | feat | Implement RLS test fixtures (GREEN) |
| `5ffb62a` | feat | Add RLS suite CI workflow |

## Self-Check: PASSED

- ✔ `backend/api/vitest.config.ts` exists
- ✔ `backend/api/test/setup.ts` exists
- ✔ `backend/api/test/rls/fixtures.ts` exists
- ✔ `backend/api/test/rls/fixtures.test.ts` exists
- ✔ `backend/api/.env.test.example` exists
- ✔ `.github/workflows/test-rls.yml` exists
- ✔ commit `0a14f8e` in git log
- ✔ commit `268b999` in git log
- ✔ commit `e20832a` in git log
- ✔ commit `5ffb62a` in git log
- ✔ `npm run --prefix backend/api test` exits 0 (4 passing)
- ✔ `npm run --prefix backend/api test:rls` exits 0 (4 passing)
- ✔ `grep -rE 'SUPABASE_SERVICE_ROLE_KEY|service[_-]role' backend/api/src/` returns no matches
