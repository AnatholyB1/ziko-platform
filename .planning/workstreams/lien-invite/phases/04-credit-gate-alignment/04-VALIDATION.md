---
phase: 04
slug: credit-gate-alignment
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
plans_created: 2026-08-16
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `backend/api/vitest.config.ts` (`include: ['test/**/*.{spec,test}.ts', 'src/**/*.test.ts']`, `fileParallelism: false`) |
| **Quick run command** | `cd backend/api && npx vitest run src/middleware/creditGate.test.ts src/services/creditService.test.ts` |
| **Full suite command** | `cd backend/api && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend/api && npx vitest run src/middleware/creditGate.test.ts src/services/creditService.test.ts`
- **After every plan wave:** Run `cd backend/api && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Additional phase gate:** A manual re-verification of the CRED-01 production count
  (`SELECT count(*) FROM public.user_profiles WHERE tier='premium';` via Supabase MCP) immediately
  before the bypass-deletion task runs — not merely once at phase start, since time may have passed
  since the discuss-phase resolution (0, recorded in 04-CONTEXT.md D-01).
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

All backend commands below are prefixed with placeholder credentials, because
`backend/api/test/setup.ts` throws on missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` before any test runs (the Phase 3 blocker recorded in STATE.md).
`dotenv` does not override variables already in `process.env`, so the prefix is safe with or
without a real `.env.test`, and leaving `SUPABASE_TEST_URL` unset keeps the RUN_DB specs skipped.

`ENVP` below stands for:
`SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_PUBLISHABLE_KEY=test-publishable SUPABASE_SERVICE_ROLE_KEY=test-service-role`

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-04-01 | 04-01 | 1 | CRED-01 | T-04-S4 | Production count re-verified 0 and recorded on disk before any credit-gate source file changes; nonzero halts the phase | manual (Supabase MCP) + scripted artifact assertion | `grep -qE '^premium_tier_count: 0$' .planning/workstreams/lien-invite/phases/04-credit-gate-alignment/04-CRED-01-AUDIT.md` | ✅ created by T-04-01 | ⬜ pending |
| T-04-02 | 04-01 | 1 | CRED-02 | T-04-S1 | Premium user with flag=true, quota exhausted and balance below cost gets 402 with the same body a free user gets, and no `user_profiles` read occurs on that path | unit | `cd backend/api && ENVP npx vitest run src/middleware/creditGate.test.ts` | ✅ created by T-04-02 | ⬜ pending |
| T-04-02 | 04-01 | 1 | CRED-05 | T-04-S1, T-04-S2, T-04-S3, T-04-S6 | Flag defaults false; flag=false reproduces today's behavior for BOTH premium (bypass) and free (402 when exhausted); flag=true enforces balance; a failed flag read degrades to flag-off | unit | `cd backend/api && ENVP npx vitest run src/middleware/creditGate.test.ts` | ✅ created by T-04-02 | ⬜ pending |
| T-04-03 | 04-01 | 1 | CRED-04 | T-04-S5 | `is_lifetime_premium` exists, defaults false, and is never written by any Phase 4 code path | schema smoke test (RUN_DB-guarded) | `cd backend/api && ENVP npx vitest run test/rls/premium-credit-gate.spec.ts` | ✅ created by T-04-03 | ⬜ pending |
| T-04-03 | 04-01 | 1 | CRED-06 | — | `branding/page.tsx`'s `isPro` check is untouched, still reads `tier` the same way; nothing under `apps/mobile` or `plugins` changed | negative-change check | `git diff --quiet HEAD -- "apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx" apps/mobile plugins` | N/A — negative-change check | ⬜ pending |
| T-04-04 | 04-02 | 2 | CRED-03 | T-04-S7, T-04-S8 | The grant RPC adds exactly the amount once per calendar month, claims the ledger row before funding, and is `service_role`-only | integration (RUN_DB-guarded) | `cd backend/api && ENVP npx vitest run test/rls/premium-grant-rpc.spec.ts` | ✅ created by T-04-04 | ⬜ pending |
| T-04-05 | 04-02 | 2 | CRED-03 | — | `grantMonthlyPremiumCredits` calls the grant RPC with `PREMIUM_MONTHLY_GRANT` by default and never throws on a duplicate or an RPC error | unit | `cd backend/api && ENVP npx vitest run src/services/creditService.test.ts` | ✅ created by T-04-05 | ⬜ pending |
| T-04-06 | 04-02 | 2 | CRED-03 | T-04-S9, T-04-S10, T-04-S11, T-04-S12 | The cron route runs on the shared secret with no user JWT, 401s on a wrong secret, survives per-user failures, and its scheduled URL matches its mount | unit + structural | `cd backend/api && ENVP npx vitest run src/routes/credits-cron.test.ts` | ✅ created by T-04-06 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Threat IDs are `T-04-S<n>` to keep them out of the `T-04-<nn>` task-ID namespace; they are defined
in the `<threat_model>` block of the owning plan.*

---

## Wave 0 Requirements

No separate Wave 0 exists: every missing test file is created inside the task that needs it, tests
first (`tdd="true"` with an explicit `<behavior>` block), so there is no task whose `<automated>`
verify references a file that does not yet exist at the moment the task runs.

- [ ] `backend/api/src/middleware/creditGate.test.ts` — created by T-04-02, covers CRED-02, CRED-05
- [ ] `backend/api/test/rls/premium-credit-gate.spec.ts` — created by T-04-03, covers CRED-04 and `app_config` deny-all
- [ ] `backend/api/test/rls/premium-grant-rpc.spec.ts` — created by T-04-04, covers CRED-03's SQL idempotency
- [ ] `backend/api/src/services/creditService.test.ts` — created by T-04-05, covers CRED-03's grant wrapper
- [ ] `backend/api/src/routes/credits-cron.test.ts` — created by T-04-06, covers the cron auth scope and the schedule/mount agreement

No framework install is needed — Vitest 3.x is already configured across `backend/api`.

The two `test/rls/*.spec.ts` files are `describe.skipIf(!RUN_DB)`-guarded and only execute against
the dedicated test project via `.github/workflows/test-rls.yml`, whose trigger paths already cover
`supabase/migrations/**` and `backend/api/test/rls/**` — no workflow edit is required. Locally they
collect and skip, which still proves they parse, import, and register.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production `tier='premium'` count | CRED-01 | Reads live production data via Supabase MCP; not a repo-runnable automated test | Run `SELECT count(*) FROM public.user_profiles WHERE tier='premium';` against project `slkobhavpwsubnsmuhya` immediately before the bypass-deletion task; if nonzero, halt and escalate the grandfather question rather than proceeding |
| `branding/page.tsx` non-regression | CRED-06 | Confirms a file was NOT touched — a negative-change check, not a positive test assertion | `git diff` on the file at phase end; expect zero lines changed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 6 tasks carry one
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — zero gaps
- [x] Wave 0 covers all MISSING references — each test file is created by the task that verifies against it
- [x] No watch-mode flags — every command is `vitest run`
- [x] Feedback latency < 30s — the per-task suites are single-file unit runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-signed 2026-08-16
