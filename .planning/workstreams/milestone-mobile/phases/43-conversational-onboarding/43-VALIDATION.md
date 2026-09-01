---
phase: 43
slug: conversational-onboarding
status: draft
nyquist_compliant: false
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
| 43-XX-XX | TBD | TBD | ONBOARD-01 | — | ≤4-question flow terminates and calls `assess_profile` within `ONBOARDING_MAX_STEPS` | integration | `npx vitest run test/routes/onboarding.spec.ts` | ❌ W0 | ⬜ pending |
| 43-XX-XX | TBD | TBD | ONBOARD-02 | V5 | `assess_profile` input validates against enum/required-field contract (readiness values match DB CHECK) | unit | `npx vitest run test/tools/onboarding.spec.ts` | ❌ W0 | ⬜ pending |
| 43-XX-XX | TBD | TBD | ONBOARD-05 | V4 | `record_athlete_decision()` call results in `athlete_state.status='active'`, correct `onboarding_profile` JSONB | integration | `npx vitest run test/rls/onboarding-profile.spec.ts` | ❌ W0 | ⬜ pending |
| 43-XX-XX | TBD | TBD | ONBOARD-06 | — | Retroactive path only fires when `onboarding_done=true` AND no `athlete_state` row exists; writes `p_source='app_open_fallback'` with real evidence | integration | `npx vitest run test/tools/retroactive-recompute.spec.ts` | ❌ W0 | ⬜ pending |
| 43-XX-XX | TBD | TBD | Mandatory-gate fix (Pitfall 1) | V4 | `(auth)/_layout.tsx` redirect requires both `profile.onboarding_done` AND `athlete_state.status==='active'` | manual QA (mobile RTL/Jest infra not confirmed present) | — | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs/Plan/Wave columns filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

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

**Approval:** pending
