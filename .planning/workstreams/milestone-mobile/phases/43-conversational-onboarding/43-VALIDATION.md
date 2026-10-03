---
phase: 43
slug: conversational-onboarding
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-01
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v3 (`backend/api/vitest.config.ts`) |
| **Config file** | `backend/api/vitest.config.ts` |
| **Quick run command** | `cd backend/api && npx vitest run test/rls/athlete-decisions.spec.ts test/rls/athlete-state.spec.ts` |
| **Full suite command** | `cd backend/api && npm run test` (also `npm run test:rls` for the RLS-specific subset) |
| **Estimated runtime** | ~30-60 seconds (RLS/RPC specs require `SUPABASE_TEST_URL`; guarded by `RUN_DB`/`describe.skipIf(!RUN_DB)` — a pre-existing environment gap from Phase 42, not introduced by this phase) |

---

## Sampling Rate

- **After every task commit:** Run the targeted new spec file (`npx vitest run <new spec file>`)
- **After every plan wave:** `cd backend/api && npm run test:rls` (RLS/RPC changes are the highest-risk surface this phase touches)
- **Before `/gsd:verify-work`:** Full `cd backend/api && npm run test` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-T1 | 43-01 | 1 | ONBOARD-01 | — | `ONBOARDING_MAX_STEPS` scoped to onboarding, shared chat cap untouched | source assertion | `grep -c "ONBOARDING_MAX_STEPS = 8" backend/api/src/config/models.ts` | ✅ | ⬜ pending |
| 43-01-T2 | 43-01 | 1 | ONBOARD-02, ONBOARD-03, ONBOARD-05 | T-43-01/02/03/05, V5 | `assess_profile` enum contract matches the DB CHECK; RPC-only write; `{success:false}` surfaced | unit | `cd backend/api && npx vitest run test/tools/onboarding.spec.ts` | ❌ created by 43-01 | ⬜ pending |
| 43-01-T3 | 43-01 | 1 | ONBOARD-02 | T-43-04, V4 | Tool executable via `getToolExecutor` but absent from `allToolSchemas` | source assertion | `cd backend/api && npx tsc --noEmit` | ✅ | ⬜ pending |
| 43-02-T1 | 43-02 | 1 | ONBOARD-04 | — | 16 `coach.onboarding.*` keys present in both fr and en | source assertion | node i18n parity check (see 43-02 Task 1 verify) | ✅ | ⬜ pending |
| 43-02-T2 | 43-02 | 1 | ONBOARD-06 | T-43-07/08 | Lazy retroactive trigger fires once per app open, never blocks load | unit / type-check | `cd apps/mobile && npx tsc --noEmit` | ✅ | ⬜ pending |
| 43-02-T3 | 43-02 | 1 | ONBOARD-01 | T-43-06, V4 | `(auth)/_layout.tsx` redirect requires both `onboarding_done` and `athleteOnboardingComplete` | manual QA (no mobile RTL/Jest infra) | — | ❌ manual | ⬜ pending |
| 43-03-T1 | 43-03 | 2 | ONBOARD-01 | — | `plugin_context` tagging additive; existing chat callers unaffected | type-check | `cd backend/api && npx tsc --noEmit` | ✅ | ⬜ pending |
| 43-03-T2 | 43-03 | 2 | ONBOARD-01, ONBOARD-02, ONBOARD-03 | T-43-10/11/12/13/15, V2/V4 | Uncredited route, single-tool surface, ownership+tag gate, cap_reached signal | source assertion + integration | `cd backend/api && npx vitest run test/routes/onboarding.spec.ts` | ❌ created by 43-03 | ⬜ pending |
| 43-03-T3 | 43-03 | 2 | ONBOARD-01, ONBOARD-02 | T-43-10/11 | 403 `conversation_forbidden` on foreign or untagged conversation id | integration | `cd backend/api && npx vitest run test/routes/onboarding.spec.ts` | ❌ created by 43-03 | ⬜ pending |
| 43-04-T1 | 43-04 | 3 | ONBOARD-06 | T-43-17/18/19 | Guards before any model call; evidence carries real 90-day aggregates; `p_source='app_open_fallback'` | unit | `cd backend/api && npx vitest run test/tools/retroactive-recompute.spec.ts` | ❌ created by 43-04 | ⬜ pending |
| 43-04-T2 | 43-04 | 3 | ONBOARD-06 | T-43-16 | userId derived from bearer token only; skips return HTTP 200 | source assertion | `cd backend/api && npx tsc --noEmit` | ✅ | ⬜ pending |
| 43-04-T3 | 43-04 | 3 | ONBOARD-05 | V4 | RPC write yields `status='active'`, level/tier 1, `onboarding_profile` JSONB; direct client write denied | integration (RLS/RPC) | `cd backend/api && npx vitest run test/rls/onboarding-profile.spec.ts` | ❌ created by 43-04 | ⬜ pending |
| 43-05-T1 | 43-05 | 3 | ONBOARD-01 | T-43-21 | step-7 routes to ziko-chat; stack keeps `gestureEnabled: false` | source assertion | `cd apps/mobile && npx tsc --noEmit` + grep gates in 43-05 Task 1 | ✅ | ⬜ pending |
| 43-05-T2 | 43-05 | 3 | ONBOARD-01 | — | No credit/community surfaces; UI-SPEC spacing/type conformance | source assertion | grep gates in 43-05 Task 2 | ✅ | ⬜ pending |
| 43-05-T3 | 43-05 | 3 | ONBOARD-01, ONBOARD-02 | T-43-23/24 | Locale sent explicitly; all six SSE event forms handled; resume via tagged conversation | source assertion + manual QA | `cd apps/mobile && npx tsc --noEmit` | ✅ / ❌ manual for resume | ⬜ pending |
| 43-06-T1 | 43-06 | 4 | ONBOARD-03 | T-43-28 | Deep-link routes come from a module constant, not server strings | source assertion | grep gates in 43-06 Task 1 | ✅ | ⬜ pending |
| 43-06-T2 | 43-06 | 4 | ONBOARD-04, ONBOARD-05 | T-43-25/26 | Celebration set only from a real log-row query; refreshProfile awaited before navigation | source assertion + manual QA | grep gates in 43-06 Task 2 | ✅ | ⬜ pending |
| 43-06-T3 | 43-06 | 4 | ONBOARD-01..06 | — | End-to-end flow, tone, animation, resume-not-skip, no-celebration-without-log | manual QA (blocking checkpoint) | — | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled in by the planner 2026-09-01. Each Wave-0 spec file is created by the plan listed in its row rather than by a separate scaffolding plan, so no spec sits red across a wave boundary.*

---

## Wave 0 Requirements

- [ ] `backend/api/test/routes/onboarding.spec.ts` — route-level coverage for credit exemption, single-tool scoping, and the ownership/tag gate (created by plan 43-03 Task 3)
- [ ] `backend/api/test/rls/onboarding-profile.spec.ts` — covers ONBOARD-02/ONBOARD-05, following `athlete-decisions.spec.ts`'s exact house shape (`RUN_DB` guard, `getAdminClient`/`createTestUser`/`cleanupTestUsers` fixtures)
- [ ] `backend/api/test/tools/onboarding.spec.ts` — unit coverage for the `assess_profile` executor and micro-action pool selection logic
- [ ] `backend/api/test/tools/retroactive-recompute.spec.ts` — covers ONBOARD-06's real-activity-grounded evidence requirement

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mandatory-gate resume-not-skip after app kill mid-chat | ONBOARD-01 / Pitfall-1 fix | No dedicated mobile RTL/Jest test infra confirmed present for `(auth)/_layout.tsx` | Start Ziko chat, force-kill the app before answering all questions, relaunch, confirm the chat resumes (not skipped to home tab) |
| Full-screen Ziko celebration renders after real micro-action completion | ONBOARD-03/04 | Visual/animation behavior, not practically unit-testable | Complete onboarding, tap through to the target plugin, log the micro-action, return to the flow, confirm celebration fires only after the real row exists |
| Ziko question tone (playful, tutoiement, no emoji) matches CONTEXT.md D-06/D-10 | ONBOARD-02 | Subjective tone/voice QA, not an automatable assertion | Run through onboarding chat in both fr and en, confirm no emoji, informal `tu`, and coverage of the 3 required signal categories |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-09-01 — every task has an <automated> verify or an explicitly-classified manual QA row; no 3 consecutive tasks lack automated feedback; no watch-mode flags; latency under 60s
