---
phase: 04
slug: credit-gate-alignment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-15
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CRED-01 | — | Production count re-verified 0 before bypass deletion | manual/scripted | `SELECT count(*) FROM public.user_profiles WHERE tier='premium';` | N/A — planning-time check | ⬜ pending |
| TBD | TBD | TBD | CRED-02 | TBD | Premium user with flag=true and balance=0 gets 402, same as a free user | unit | `npx vitest run src/middleware/creditGate.test.ts -t "premium user exhausted balance"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CRED-03 | TBD | Monthly grant RPC adds exactly the configured allowance and is idempotent on re-run same month | unit + integration | `npx vitest run src/services/creditService.test.ts -t "grantMonthlyPremiumCredits"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CRED-04 | TBD | `is_lifetime_premium` column exists, defaults false, never written by any Phase 4 code path | schema smoke test | `SELECT column_name FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_lifetime_premium';` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CRED-05 | TBD | Flag defaults false; flag=false behavior matches pre-phase bypass exactly; flag=true enforces balance | unit | `npx vitest run src/middleware/creditGate.test.ts -t "feature flag"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CRED-06 | — | `branding/page.tsx`'s `isPro` check is untouched, still reads `tier` the same way | manual code diff review | `git diff "apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx"` (expect empty) | N/A — negative-change check | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs, plan numbers, and wave numbers are filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] `backend/api/src/middleware/creditGate.test.ts` — new file, covers CRED-02, CRED-05 (no existing coverage of `creditGate.ts` at all)
- [ ] `backend/api/src/services/creditService.test.ts` — new file, covers CRED-03's grant wrapper

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production `tier='premium'` count | CRED-01 | Reads live production data via Supabase MCP; not a repo-runnable automated test | Run `SELECT count(*) FROM public.user_profiles WHERE tier='premium';` against project `slkobhavpwsubnsmuhya` immediately before the bypass-deletion task; if nonzero, halt and escalate the grandfather question rather than proceeding |
| `branding/page.tsx` non-regression | CRED-06 | Confirms a file was NOT touched — a negative-change check, not a positive test assertion | `git diff` on the file at phase end; expect zero lines changed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
