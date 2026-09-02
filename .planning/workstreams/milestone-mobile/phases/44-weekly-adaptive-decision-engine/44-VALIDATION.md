---
phase: 44
slug: weekly-adaptive-decision-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`^3.x`, backend workspace) |
| **Config file** | `backend/api/vitest.config.ts` (`fileParallelism: false` — RLS suite mutates `auth.users`, must stay serialized) |
| **Quick run command** | `npx vitest run test/tools/coaching-engine.spec.ts` |
| **Full suite command** | `npm run test` (from `backend/api/`) — `vitest run --passWithNoTests` |
| **Estimated runtime** | ~30s quick / ~3min full suite |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <file> -t "<name>"` for the file(s) touched
- **After every plan wave:** Run `npm run test` (full backend suite, from `backend/api/`)
- **Before `/gsd:verify-work`:** Full suite must be green, plus a manual/scripted duplicate-fire simulation (call the review-check or cron-simulation path twice in quick succession for the same athlete/week) confirming exactly one `athlete_decisions` row — mirrors Phase 42-04's own live empirical verification approach
- **Max feedback latency:** 30 seconds (quick command)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-XX-XX | TBD | TBD | ENGINE-01 | — | Real-activity comparison reads only the focus-mapped table(s) | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "activity aggregation"` | ❌ Wave 0 | ⬜ pending |
| 44-XX-XX | TBD | TBD | ENGINE-02 | — | `generateObject` decision call produces a valid, sanitized-schema structured decision | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "decision schema"` | ❌ Wave 0 | ⬜ pending |
| 44-XX-XX | TBD | TBD | ENGINE-03 | — | Escalate/hold/de-escalate correctly updates `readiness` | unit | `npx vitest run test/tools/coaching-engine.spec.ts -t "trajectory"` | ❌ Wave 0 | ⬜ pending |
| 44-XX-XX | TBD | TBD | ENGINE-04 | T-44-01 | Running the review twice for the same athlete/week produces exactly one decision | integration | `npx vitest run test/rls/athlete-decisions.spec.ts -t "weekly_focus idempotency"` | ⚠️ File exists, new test case needed | ⬜ pending |
| 44-XX-XX | TBD | TBD | ENGINE-05 | — | Weekly engine's `ai_cost_log` row has `source='weekly_review_cron'`/`'app_open_fallback'`, never touches `creditCheck`/`creditDeduct` | integration | `npx vitest run test/routes/coaching-engine.spec.ts -t "cost logging"` | ❌ Wave 0 | ⬜ pending |
| 44-XX-XX | TBD | TBD | ENGINE-06 | T-44-02 | `create_goal`/`create_program` callable identically from cron path and `/ai/chat` tool-call path | integration | `npx vitest run test/tools/coaching-engine.spec.ts -t "shared apply path"` | ❌ Wave 0 | ⬜ pending |
| 44-XX-XX | TBD | TBD | D-09 (`athlete_goals` RLS) | T-44-03 | Athlete reads own goals only; no client write path | RLS integration | `npx vitest run test/rls/athlete-goals.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are TBD — the planner fills in exact `{plan}-{task}` IDs once PLAN.md files exist; this table's requirement/test-command mapping is the binding contract.*

---

## Wave 0 Requirements

- [ ] `backend/api/test/tools/coaching-engine.spec.ts` — covers ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-06 (mirror `test/tools/onboarding.spec.ts` + `retroactive-recompute.spec.ts` structure)
- [ ] `backend/api/test/routes/coaching-engine.spec.ts` — covers ENGINE-05, the `review-check` route's due/not-due branching, and the `CRON_SECRET` guard on the safety-net cron (mirror `test/routes/onboarding.spec.ts`)
- [ ] `backend/api/test/rls/athlete-goals.spec.ts` — new table RLS (mirror `test/rls/athlete-state.spec.ts`)
- [ ] Extend `backend/api/test/rls/athlete-decisions.spec.ts` with a `weekly_focus` idempotency case (existing file covers `onboarding_profile`-shaped decisions only)
- [ ] A disposable-`auth.users`-row fixture path for the two functional-correctness RPC assertions Phase 42-04 deferred (`success: true` round-trip, duplicate-`weekly_focus`-returns-`error:'duplicate'`) — reuse `backend/api/test/rls/fixtures.ts`'s GoTrue Admin API user-creation helper

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate-fire simulation under real concurrent app-open + cron-safety-net overlap | ENGINE-04 | Requires a live `auth.users` test row + simulated concurrent trigger timing, not purely unit-testable | Trigger the review-check path twice in quick succession for the same seeded athlete/week (or call the cron-simulation path immediately after), then assert exactly one `athlete_decisions` row with `decision_type='weekly_focus'` for that `week_of` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
