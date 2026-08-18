---
phase: 1
slug: data-foundation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `01-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map
> is filled in by the planner/executor once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v3 (already configured in both `backend/api` and `apps/web`) |
| **Config file** | `backend/api/vitest.config.ts` · `apps/web/vitest.config.ts` |
| **Quick run command** | `cd backend/api && npm run test:rls -- waitlist-rls.spec.ts` |
| **Full suite command** | `npx turbo run test` |
| **Estimated runtime** | ~30–60 seconds (RLS suite hits a real Supabase project) |

**Two distinct quick commands** — this phase splits validation across two packages:

| Concern | Package | Command |
|---------|---------|---------|
| RLS deny-all, dedupe | `backend/api` | `npm run test:rls -- waitlist-rls.spec.ts` |
| app_config deny-all, counter, erasure, sequence reset | `backend/api` | `npm run test:rls -- waitlist-config-rpc.spec.ts` |
| Concurrency cap, non-disclosure | `apps/web` | `npx vitest run test/actions/waitlist.concurrency.test.ts` |

**Every command above requires `SUPABASE_TEST_URL` to be exported and to equal `SUPABASE_URL`.**
Without it the specs skip and exit 0 — green but proving nothing. Check the reporter for "skipped".

---

## Sampling Rate

- **After every task commit:** Run the quick command for the package that task touched
- **After every plan wave:** Run `npx turbo run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 T1 | 01-01 | 1 | — | — | One-way schema contract confirmed before it is authored | checkpoint:decision | *(human gate — no automated command)* | n/a | ⬜ pending |
| 01-01 T2 | 01-01 | 1 | DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07 | T-01-01, T-01-02, T-01-03, T-01-04 | Rank from `nextval`; deny-all RLS; explicit revoke/grant; `is_new` filter before any other field | integration | `cd apps/web && npx vitest run test/actions/waitlist.concurrency.test.ts` | ❌ created by this task | ⬜ pending |
| 01-02 T1 | 01-02 | 2 | DATA-05, DATA-06 | T-01-09, T-01-10, T-01-11, T-01-14 | `app_config` deny-all; threshold arbitration inside the database | integration | `cd backend/api && npm run test:rls -- waitlist-config-rpc.spec.ts` | ❌ created by this task | ⬜ pending |
| 01-02 T2 | 01-02 | 2 | DATA-05, DATA-06 | T-01-11, T-01-12, T-01-13 | Erasure preserves the rank; sequence reset is `service_role`-only with no dynamic SQL | integration | `cd backend/api && npm run test:rls -- waitlist-config-rpc.spec.ts` | ✅ after 01-02 T1 | ⬜ pending |
| 01-02 T3 | 01-02 | 2 | DATA-05, DATA-06 | T-01-26 | [BLOCKING] final schema applied to the `SUPABASE_TEST_*` project before any wave-3 proof | checkpoint:human-verify | *(human gate — `npm run test:rls -- waitlist-config-rpc.spec.ts` must report executed, not skipped)* | n/a | ⬜ pending |
| 01-03 T1 | 01-03 | 3 | DATA-05, DATA-06 | T-01-16, T-01-17, T-01-18, T-01-21, T-01-22 | Anon and authenticated denied on read and write; all five RPCs closed to anon | integration | `cd backend/api && npm run test:rls -- waitlist-rls.spec.ts` | ❌ created by this task | ⬜ pending |
| 01-03 T2 | 01-03 | 3 | DATA-01, DATA-04 | T-01-19, T-01-20 | Normalized dedupe burns no second rank; Gmail-only dot rule; `email_normalized` invariant | integration | `cd backend/api && npm run test:rls -- waitlist-rls.spec.ts` | ✅ after 01-03 T1 | ⬜ pending |
| 01-04 T1 | 01-04 | 3 | DATA-02, DATA-03, DATA-07 | T-01-23, T-01-24, T-01-25 | Exactly five founders across the 200 boundary; no rank held twice; neutral duplicate response through the Server Action | integration | `cd apps/web && npx vitest run test/actions/waitlist.concurrency.test.ts` | ✅ after 01-01 T2 | ⬜ pending |
| 01-04 T2 | 01-04 | 3 | DATA-02, DATA-03, DATA-07 | T-01-25, T-01-26, T-01-28 | CI applies the migration to the test project before either suite; no production secret in the waitlist jobs | structural | `test "$(grep -c $'\t' .github/workflows/test-rls.yml)" -eq 0 && grep -q 'web-waitlist' .github/workflows/test-rls.yml && grep -q 'supabase db push' .github/workflows/test-rls.yml && grep -q 'ARCH-03 violation' .github/workflows/test-rls.yml` | ✅ exists, modified | ⬜ pending |
| 01-04 T3 | 01-04 | 3 | DATA-01..07 | all | Phase acceptance — full suite green against the test project and on CI, skip guard confirmed in both directions | checkpoint:human-verify | *(human gate — `npx turbo run test`)* | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test binding (from RESEARCH.md, pre-task)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DATA-02, DATA-03 | Two simultaneous signups near spot 200 never both get founder status | integration | `npx vitest run test/actions/waitlist.concurrency.test.ts` | ❌ W0 |
| DATA-04 | Case-insensitive + normalized dedupe — no duplicate row, no second rank | integration | `npm run test:rls -- waitlist-rls.spec.ts` | ❌ W0 |
| DATA-05 | RLS deny-all — anon/authenticated get zero rows / write errors | integration | `npm run test:rls -- waitlist-rls.spec.ts` | ❌ W0 |
| DATA-01, DATA-06 | Fields captured only through the `SECURITY DEFINER` RPC | integration | both commands above | ❌ W0 |
| DATA-07 | Duplicate submission never discloses founder status **via the Server Action** | integration | `npx vitest run test/actions/waitlist.concurrency.test.ts` | ❌ W0 |

---

## Wave 0 Requirements

- [ ] `backend/api/test/rls/waitlist-rls.spec.ts` — stubs for DATA-04, DATA-05, DATA-01, DATA-06
- [ ] `apps/web/test/actions/waitlist.concurrency.test.ts` — stubs for DATA-02, DATA-03, DATA-07
- [x] Sequence fast-forward helper — **RESOLVED at planning.** Option (a): the migration ships
      `public.reset_waitlist_founder_sequence(p_next_value BIGINT)` — `SECURITY DEFINER`,
      `service_role`-only, one hardcoded sequence target, no dynamic SQL (plan 01-02 Task 2).
      Rationale: no new npm dependency and no new secret, and ROADMAP Phase 6 criterion 1 needs a
      sequence reset at go-live anyway, so this is a production artefact rather than a test
      backdoor. Option (b) (a direct Postgres connection) was rejected: it adds a `pg`
      devDependency `apps/web` does not have plus a connection-string secret no workflow holds. The
      choice is presented for confirmation at plan 01-01 Task 1's `checkpoint:decision`.
- [x] `apps/web/vitest.config.ts` — **no change needed.** Only one DB-mutating spec lands under
      `apps/web/test/actions/`, and Vitest runs tests within a file sequentially by default. The
      conditional in this row was not met, so the config stays untouched.
- [ ] **Production-safety guard on every DB-mutating spec (discovered at planning).** The root CI
      `verify` job runs `npx turbo run test` with the *production* Supabase secrets and the backend
      `test` script includes `test/rls/**`. A waitlist spec running there would consume real founder
      ranks. Every new spec therefore computes
      `RUN_DB = Boolean(SUPABASE_TEST_URL) && SUPABASE_TEST_URL === SUPABASE_URL` and wraps its
      describes in `describe.skipIf(!RUN_DB)`.
- [ ] **`server-only` mock in the web spec (discovered at planning).** `apps/web/src/lib/supabase/admin.ts`
      opens with `import 'server-only'`, whose default export throws outside a React Server
      Component — so importing `claimWaitlistSpot` under plain Vitest fails without a hoisted
      `vi.mock('server-only', () => ({}))`. This is a second testability hazard alongside the
      `next/headers` one RESEARCH.md already flagged. (mirrors `backend/api`'s existing config)

*Framework install: not required — Vitest v3 is already configured in both packages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied to `SUPABASE_TEST_*` project before the RLS suite runs | DATA-05 | RESEARCH.md flags that `.github/workflows/test-rls.yml` has **no migration-apply step** — new migrations are not pushed to the test project automatically | Covered three ways: plan 01-02 Task 3 is a `[BLOCKING] checkpoint:human-verify` confirming the applied state; plan 01-03 Task 1 adds a `beforeAll` preflight that fails by naming `20260812_waitlist_founder_offer.sql`; plan 01-04 Task 2 adds conditional `supabase db push` steps to the workflow itself. |
| Test project holds no stale waitlist rows before the concurrency proof | DATA-02, DATA-03 | The "no founder rank issued twice" assertion scans the whole table, and a leftover row in the 140-220 band collides with the unique partial index | Plan 01-02 Task 3's checkpoint includes the count query; plan 01-04 Task 1 adds a `beforeAll` that fails with an explicit message when stale ranks exist in that band. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Sequence fast-forward helper resolved (not `exec_sql`-by-assumption)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
