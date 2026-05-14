---
phase: 22
slug: schema-foundation-rls-keystone
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-14
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for the RLS keystone. Every cross-user RLS policy and the `is_coach_of()` function must be proven correct on every PR that touches `supabase/migrations/**` or this spec for the rest of v1.5.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (TBD version — Wave 0 installs in `backend/api/`) |
| **Config file** | `backend/api/vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npm run --prefix backend/api test:rls` |
| **Full suite command** | `npm run --prefix backend/api test` |
| **Estimated runtime** | ~30 seconds (4 mandated cases + 6 additional scenarios + setup/teardown) |
| **Target database** | Local `supabase start` for dev; Supabase branch for CI |

---

## Sampling Rate

- **After every task commit (post-DDL):** Run `npm run --prefix backend/api test:rls`
- **After Wave 1 completes:** Run full RLS suite (`test:rls`)
- **Before `/gsd-verify-work`:** Full RLS suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> The planner populates this table during planning. Each task that touches DDL or the RPC must reference a test case in the RLS spec; each non-DDL task (e.g., Vitest config) is a Wave-0 dependency for downstream tests.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | ARCH-07 (infra) | — | Vitest installed + config valid | unit | `npm run --prefix backend/api test -- --run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 0 | ARCH-07 (infra) | — | Test fixture utilities (createTestUser, getJwtClient, cleanup) compile | unit | `npm run --prefix backend/api test -- backend/api/test/rls/fixtures.test.ts --run` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | ARCH-07 | T-22-01 (role escalation) | `user_profiles.role` defaults to 'client'; CHECK rejects other values | integration | `npm run --prefix backend/api test -- backend/api/test/rls/role.spec.ts --run` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | ARCH-07 | — | `coach_profiles` RLS owner-only enforced | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-profiles.spec.ts --run` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | ARCH-07 | T-22-02 (cross-coach data leak) | `is_coach_of()` returns TRUE for active linked client | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "linked client" --run` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 2 | ARCH-07 | T-22-02 | `is_coach_of()` returns FALSE for unlinked client | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "unlinked client" --run` | ❌ W0 | ⬜ pending |
| 22-03-03 | 03 | 2 | ARCH-07 | T-22-03 (revocation bypass) | Coach loses read access immediately on revoked_at SET | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "revocation immediate" --run` | ❌ W0 | ⬜ pending |
| 22-03-04 | 03 | 2 | ARCH-07 | T-22-04 (expired = revoked) | Coach loses read access when expires_at < now() | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "expired = revoked" --run` | ❌ W0 | ⬜ pending |
| 22-03-05 | 03 | 2 | ARCH-07 | T-22-05 (privilege escalation) | Coach INSERT/UPDATE/DELETE on cross-user tables BLOCKED | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "coach cannot write" --run` | ❌ W0 | ⬜ pending |
| 22-03-06 | 03 | 2 | ARCH-07 | — | Partial UNIQUE `(coach_id, client_id) WHERE revoked_at IS NULL` enforced | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "partial unique" --run` | ❌ W0 | ⬜ pending |
| 22-03-07 | 03 | 2 | ARCH-07 | — | `is_coach_of(NULL, NULL)` returns FALSE (no crash) | integration | `npm run --prefix backend/api test -- backend/api/test/rls/coach-rls.spec.ts -t "null safety" --run` | ❌ W0 | ⬜ pending |
| 22-03-08 | 03 | 2 | ARCH-07 | T-22-06 (timing leak) | `redeem_invitation_code` returns within timing variance < 20ms p95 across all error codes (CI-jitter tolerance; research suggests ~10ms typical, Upstash rate limit is primary defense in Phase 25) | integration | `npm run --prefix backend/api test -- backend/api/test/rls/redeem-rpc.spec.ts -t "constant time" --run` | ❌ W0 | ⬜ pending |
| 22-03-09 | 03 | 2 | ARCH-07 | T-22-07 (self-link) | `redeem_invitation_code` rejects coach redeeming their own code (SELF_INVITATION) | integration | `npm run --prefix backend/api test -- backend/api/test/rls/redeem-rpc.spec.ts -t "self invitation" --run` | ❌ W0 | ⬜ pending |
| 22-04-01 | 04 | 3 | ARCH-07 | — | `workout_programs` extension FKs ON DELETE SET NULL: deleting coach preserves rows | integration | `npm run --prefix backend/api test -- backend/api/test/rls/workout-programs.spec.ts --run` | ❌ W0 | ⬜ pending |
| 22-04-02 | 04 | 3 | ARCH-07 | — | `ai_imports` owner-only RLS enforced (coach cannot read athlete's import) | integration | `npm run --prefix backend/api test -- backend/api/test/rls/ai-imports.spec.ts --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Threat refs map to PLAN.md `<threat_model>` blocks. T-22-* IDs are placeholders until plans are written.*

---

## Wave 0 Requirements

Wave 0 is the test-infrastructure foundation. **No DDL ships before Wave 0 is green**, otherwise the smoke test cannot run on subsequent waves.

- [ ] `backend/api/vitest.config.ts` — Vitest config with `test.environment = "node"`, `test.testTimeout = 30000`, env loader for Supabase URL/keys
- [ ] `backend/api/test/rls/fixtures.ts` — shared fixtures: `createTestUser`, `getAuthedClient(email, password)`, `getAdminClient`, `cleanupTestUsers`
- [ ] `backend/api/test/rls/.gitignore` — excludes any local test artifacts (none expected, but defensive)
- [ ] `backend/api/package.json` updates — add Vitest devDep + `test`, `test:rls`, `test:watch` scripts
- [ ] `.env.test` (gitignored) or CI secrets — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (test-environment only)
- [ ] `.github/workflows/test-rls.yml` (or extend existing CI) — runs `test:rls` on PRs that touch `supabase/migrations/**` or `backend/api/test/rls/**`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 035 `SET LOCAL lock_timeout = '5s'` does not block on a production-sized `user_profiles` table | ARCH-07 (deploy-time) | Production data volume is not reproducible in Vitest | Pre-deploy: on Supabase branch with `pg_dump --schema-only` + a synthetic row count matching prod (e.g., 100k user_profiles rows seeded), run migration 035; confirm completion under 30s |
| `apply_migration` MCP tool writes the SQL file under `supabase/migrations/` exactly as authored (no silent rewrites) | D-16 (process) | The MCP tool's file-write is out of band of Vitest | After each migration applied, manually diff the file on disk against the intended SQL; flag any drift |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: every Wave 1+ task has a corresponding test ID in this map
- [ ] Wave 0 covers all MISSING references (Vitest install, fixtures, CI workflow)
- [ ] No watch-mode flags (all commands use `--run`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter once plans are checker-approved

**Approval:** pending — to be flipped to approved once the planner + checker complete and the test-IDs above are 1:1 with task IDs.
