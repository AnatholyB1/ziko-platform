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
| Concurrency cap, non-disclosure | `apps/web` | `npx vitest run test/actions/waitlist.concurrency.test.ts` |

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
| *(populated by planner — task IDs do not exist yet)* | — | — | — | — | — | — | — | — | ⬜ pending |

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
- [ ] Sequence fast-forward helper — **UNRESOLVED, planner must decide.** RESEARCH.md flags that no
      generic SQL-exec RPC was found in this codebase. Options: (a) a narrowly-scoped,
      `service_role`-only test-support function shipped in the same migration, or (b) `setval` via a
      direct Postgres connection in `beforeAll`. Do not assume `exec_sql` exists.
- [ ] `apps/web/vitest.config.ts` — add `fileParallelism: false` if more than one DB-mutating spec
      lands under `apps/web/test/actions/` (mirrors `backend/api`'s existing config)

*Framework install: not required — Vitest v3 is already configured in both packages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied to `SUPABASE_TEST_*` project before the RLS suite runs | DATA-05 | RESEARCH.md flags that `.github/workflows/test-rls.yml` has **no migration-apply step** — new migrations are not pushed to the test project automatically | Apply the phase-1 migration to the test project, then run `npm run test:rls`. Planner must add an explicit checkpoint task for this. |

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
