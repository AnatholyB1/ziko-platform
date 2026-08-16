---
phase: 5
slug: waitlist-page-entry-points
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v3.2.4 (`apps/web/package.json:53`) |
| **Config file** | `apps/web/vitest.config.ts` (`environment: 'node'`, `environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']]`, `passWithNoTests: true`) |
| **Quick run command** | `cd apps/web && npx vitest run <touched test file>` |
| **Full suite command** | `cd apps/web && npm run test` (`vitest run --passWithNoTests`) |
| **Estimated runtime** | ~30 seconds (existing suite size; DB-gated suites skip without `RUN_DB`) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run <touched test file>`
- **After every plan wave:** Run `cd apps/web && npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

*Populated by the planner as tasks are created — each task's `<verify>` command should map to one
row of the Requirement → Test file below.*

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|--------------------|-------------|
| WAIT-01 | `/fondateurs` renders FR+EN, matches `generateStaticParams` pattern | unit/smoke | `npx vitest run test/app/fondateurs.metadata.test.ts` | ❌ Wave 0 |
| WAIT-02 | Email field hidden until role chosen | component (happy-dom) | `npx vitest run test/components/WaitlistRoleForm.test.tsx` | ❌ Wave 0 |
| WAIT-03 | Form submits only `email`+`audience`+`locale` (no extra required fields) | component | same file as WAIT-02 | ❌ Wave 0 |
| WAIT-04 | Malformed / disposable-domain email rejected with a clear message | unit | `npx vitest run test/actions/waitlist.validation.test.ts` | ❌ Wave 0 |
| WAIT-05/WAIT-06 | Success state identical for new vs. duplicate signup | integration (DB-gated, `RUN_DB`) | `npx vitest run test/actions/waitlist.concurrency.test.ts` | ✅ existing — extend, don't replace |
| WAIT-07/WAIT-08 | Page uses theme tokens, stays static except counter | manual/visual (UI-SPEC gate) + smoke test on `revalidate` export | same file as WAIT-01 | ❌ Wave 0 |
| FOND-01–FOND-06 | Threshold arbitration, monotonicity, complete state | integration (DB-gated) | `npx vitest run test/app/api/waitlist-count.test.ts` | ❌ Wave 0 |
| ENTRY-01/ENTRY-02 | Homepage section + `/coachs` CTAs link to `/fondateurs` | component | `npx vitest run test/components/entry-points.test.tsx` | ❌ Wave 0 |
| ENTRY-03 | Header/footer nav links present | component | same file as ENTRY-01/02 | ❌ Wave 0 |
| ENTRY-04 | OG/Twitter metadata correct | unit | same file as WAIT-01 | ❌ Wave 0 |
| ENTRY-05 | `/fondateurs` present in `sitemap.ts` output | unit | `npx vitest run test/app/sitemap.test.ts` | ❌ Wave 0 |
| ENTRY-06 | Conversion tracked (analytics call or UTM columns populated) | unit/integration | depends on planner's ENTRY-06 mechanism choice | ❌ Wave 0 |
| Consent recording (Pitfall 2) | `consent_given_at`/`consent_version` non-null after a real submission | integration (DB-gated) | extend `test/actions/waitlist.concurrency.test.ts` | ✅ extend existing |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/app/fondateurs.metadata.test.ts` — covers WAIT-01, WAIT-07/08, ENTRY-04
- [ ] `test/components/WaitlistRoleForm.test.tsx` — covers WAIT-02, WAIT-03
- [ ] `test/actions/waitlist.validation.test.ts` — covers WAIT-04 (mailchecker/Zod rejection paths)
- [ ] `test/app/api/waitlist-count.test.ts` — covers FOND-01 through FOND-06
- [ ] `test/components/entry-points.test.tsx` — covers ENTRY-01, ENTRY-02, ENTRY-03
- [ ] `test/app/sitemap.test.ts` — covers ENTRY-05
- [ ] Extend `test/actions/waitlist.concurrency.test.ts` — add rate-limit/bot/consent assertions
      without breaking its existing `vi.mock('server-only', ...)` importability (RESEARCH.md Pitfall 3)
- [ ] Framework install: none — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual/interaction fidelity of the profile picker, homepage section, and complete-state message | WAIT-02, WAIT-07, FOND-05 | UI-SPEC phase (`/gsd-ui-phase 5`) governs visual execution; not unit-testable | Compare rendered page against `05-UI-SPEC.md` once produced |
| DB-gated integration suites (`RUN_DB`) actually executing against a real database | WAIT-05/06, FOND-01–06, consent recording | No `SUPABASE_TEST_URL`/`SUPABASE_SERVICE_ROLE_KEY` available in this session, per `STATE.md`'s known gap (same limitation Phase 1 carried) | Run `RUN_DB=1 npx vitest run test/actions/waitlist.concurrency.test.ts` with real test-project credentials in an environment that has them |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
